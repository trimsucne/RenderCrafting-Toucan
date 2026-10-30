// Archivo secundario: reglas de las colisiones, puntaje, tiempo,
// detección de victoria o derrota y las pantallas de cada estado.
//
// Desde yo_por_alla_no_voy.js:
//   startLevel(game.taxi, level.time);        // al cargar un nivel
//   const result = manageCollisions(game.taxi);   // cada frame
//   // result: "DIE" (sin vidas), "WIN" (aguantó todo el tiempo) o null
//
// Los contactos entre cuerpos los avisa physics.js a las funciones
// onCollisionStart() y onCollisionActive() (Game las conecta al cargar
// el nivel). Las pantallas usan los elementos de UI de background.js:
//   drawInitialUI(), win(level), lose(level), pause()


// Puntos que da cada cosa.
const POINTS = {
  SECOND: 5,     // por cada segundo que sobrevive
  RAM: 15,       // por aturdir a alguien embistiéndolo con el taxi
  HORN: 5,       // por cada persona aturdida con el pito
  BUS: 30,       // por cada persona que se lleva un bus
  GOAL: 100,     // por terminar el nivel
  LIFE: 50       // por cada vida que sobra al terminar
};

// Velocidad relativa (píxeles por paso) a partir de la cual el taxi
// embiste a alguien en vez de dejar que lo agarre.
const RAM_SPEED = 3;

// Clave del récord en el almacenamiento del navegador.
const HIGH_SCORE_KEY = "yo_por_alla_no_voy_high_score";

// Estado de la partida.
let score = 0;
let highScore = loadHighScore();
let timeLimit = 30;       // segundos que hay que aguantar en este nivel
let timeLeft = 30;
let scoreClock = 0;       // segundos acumulados para dar puntos por tiempo


// Puntaje

function get_score() {
  return score;
}

function get_high_score() {
  return highScore;
}

function resetScore() {
  score = 0;
}

function addScore(points) {
  score += points;
  if (score > highScore) {
    highScore = score;
    saveHighScore();
  }
}

// El récord se guarda en el navegador (si se puede).
function loadHighScore() {
  try {
    return parseInt(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}

function saveHighScore() {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  } catch (e) {
    // Sin almacenamiento: el récord dura solo esta sesión.
  }
}


// Tiempo

function get_time_left() {
  return timeLeft;
}

// Fracción del tiempo que falta (1 al empezar, 0 al terminar).
function get_time_fraction() {
  return timeLimit > 0 ? timeLeft / timeLimit : 0;
}

// Fracción del pito ya recuperada (1 significa que está listo).
function get_horn_fraction() {
  return game.taxi !== undefined ? game.taxi.hornFraction() : 1;
}


// Nivel

// Prepara el reloj para un nivel recién cargado. 'seconds' es el
// tiempo que hay que aguantar.
function startLevel(player, seconds) {
  timeLimit = seconds;
  timeLeft = seconds;
  scoreClock = 0;
}

// El taxista pierde una vida. Se sincroniza 'game.lifes' (de
// yo_por_alla_no_voy.js) para que el HUD y el siguiente nivel la vean.
function killPlayer(player, cause) {
  player.die(cause);
  game.lifes = player.lifes;

  game.shake = 12;
  playGameSound(Game.sounds.crash);

  game.effects.push(new Shockwave(player.x, player.y, 90, "#ff5252"));
  game.effects.push(
    new Bubble(
      player,
      cause === "bus" ? "¡Ese Transmilenio!" : "¡Me abordaron!"
    )
  );
}


// Colisiones

// Devuelve el primero de a y b que sea de la clase indicada
// (o undefined si ninguno lo es).
function pickOwner(a, b, type) {
  if (a instanceof type) {
    return a;
  }

  if (b instanceof type) {
    return b;
  }

  return undefined;
}

// Se llama cuando dos cuerpos empiezan a tocarse (physics.js).
function onCollisionStart(a, b) {
  const taxi = pickOwner(a, b, Player);
  const person = pickOwner(a, b, Person);
  const bus = pickOwner(a, b, Bus);

  if (taxi !== undefined && person !== undefined) {
    ramPerson(taxi, person);
  } else if (taxi !== undefined && bus !== undefined) {
    // Un bus no perdona (salvo que acabe de reaparecer).
    if (taxi.isVulnerable()) {
      killPlayer(taxi, "bus");
    }
  } else if (person !== undefined && bus !== undefined) {
    launchPerson(person, bus);
  }
}

// Se llama en cada paso mientras dos cuerpos siguen tocándose.
function onCollisionActive(a, b) {
  const taxi = pickOwner(a, b, Player);
  const person = pickOwner(a, b, Person);

  if (taxi === undefined || person === undefined) {
    return;
  }

  // Solo agarra quien está persiguiendo (no quien está aturdido)
  // y no quien acaba de ser embestido.
  if (person.state !== "chasing" || relativeSpeed(taxi, person) >= RAM_SPEED) {
    return;
  }

  taxi.addGrab(
    PhysicsWorld.STEP / 1000 * Player.GRAB_RATE * person.grabRate
  );
}

// Velocidad relativa entre dos cuerpos (píxeles por paso).
function relativeSpeed(a, b) {
  return dist(
    a.body.velocity.x,
    a.body.velocity.y,
    b.body.velocity.x,
    b.body.velocity.y
  );
}

// Si el taxi choca rápido contra alguien lo embiste: lo aturde
// más tiempo mientras más fuerte sea el golpe. Si choca despacio,
// no pasa nada aquí (la persona lo agarra, ver onCollisionActive).
function ramPerson(taxi, person) {
  const speed = relativeSpeed(taxi, person);

  if (taxi.isDying() || speed < RAM_SPEED) {
    return;
  }

  const time = (0.6 + 0.25 * (speed - RAM_SPEED)) / person.resist;

  if (person.daze(time)) {
    addScore(POINTS.RAM);
    game.shake = max(game.shake, 3);
    playGameSound(Game.sounds.hit);
  }
}

// El bus se lleva por delante a quien toque: lo lanza hacia el lado
// de su carril en el que está y lo deja aturdido.
function launchPerson(person, bus) {
  const v = bus.velocity;
  const speed = Math.hypot(v.x, v.y);

  // Lado de la línea del bus en el que está la persona.
  let side = bus.horizontal
    ? Math.sign(person.y - bus.y)
    : Math.sign(person.x - bus.x);

  if (side === 0) {
    side = random([-1, 1]);
  }

  Body.setVelocity(person.body, {
    x: v.x * 0.4 + (bus.horizontal ? 0 : side * speed * 0.9),
    y: v.y * 0.4 + (bus.horizontal ? side * speed * 0.9 : 0)
  });

  person.daze(1.6);

  if (!person.hitByBus) {
    person.hitByBus = true;
    addScore(POINTS.BUS);
  }
}

// Revisa al jugador y el reloj. Devuelve "DIE" si se acabaron las
// vidas, "WIN" si aguantó todo el tiempo o null si el juego sigue.
function manageCollisions(player) {
  if (player === undefined) {
    return null;
  }

  // 1. Muriendo: se espera a que termine la animación y luego
  //    se reaparece o se pierde.
  if (player.isDying()) {
    if (!player.deathFinished()) {
      return null;
    }
    if (player.isDead()) {
      return "DIE";
    }

    player.respawn();

    // Al reaparecer la gente cercana sale despedida (sin puntos).
    game.crowd.blast(player.x, player.y, 230, 3.2, false);
    game.effects.push(new Shockwave(player.x, player.y, 230, "#ffffff"));
    return null;
  }

  // 2. Reloj: el nivel se gana aguantando hasta que llegue a cero.
  const dt = min(deltaTime, 50) / 1000;

  timeLeft -= dt;
  scoreClock += dt;

  while (scoreClock >= 1) {
    scoreClock -= 1;
    addScore(POINTS.SECOND);
  }

  // 3. Agarre: con demasiada gente encima lo abordan.
  if (player.grab >= 1) {
    killPlayer(player, "swarm");
    return null;
  }

  // 4. Meta.
  if (timeLeft <= 0) {
    timeLeft = 0;
    addScore(POINTS.GOAL + POINTS.LIFE * player.lifes);
    return "WIN";
  }

  return null;
}


// Pantallas

function drawInitialUI() {
  // Imagen del menú; si no está, un fondo liso con el título.
  if (spriteReady(Game.menuImg)) {
    image(Game.menuImg, width / 2, height / 2, width, height);
  } else {
    background("#1d1f2b");

    push();
    textFont("monospace");
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    noStroke();

    fill(0, 0, 0, 170);
    textSize(54);
    text("¡YO POR ALLÁ NO VOY!", width / 2 + 3, height * 0.28 + 3);
    fill("#f9d71c");
    text("¡YO POR ALLÁ NO VOY!", width / 2, height * 0.28);
    pop();

    Taxi.drawIcon(width * 0.14, height * 0.28, 80, -0.25);
    Taxi.drawIcon(width * 0.86, height * 0.28, 80, 0.25);
  }

  push();
  rectMode(CORNER);

  // Botones para seleccionar la dificultad.
  let buttonW = 150;
  let buttonH = 48;
  let gap = 20;
  let totalW = buttonW * 3 + gap * 2;
  let startX = (width - totalW) / 2;
  let buttonY = height * 0.7;

  let difficulty = ["FÁCIL", "NORMAL", "DIFÍCIL"]

  for (let i = 0; i < 3; i++) {
    let x = startX + i * (buttonW + gap);
    let hover =
      mouseX >= x &&
      mouseX <= x + buttonW &&
      mouseY >= buttonY &&
      mouseY <= buttonY + buttonH;

    // Fondo semitransparente para los botones.
    fill(30, 30, 40, hover ? 240 : 200);
    stroke(255);
    strokeWeight(2);
    rect(x, buttonY, buttonW, buttonH, 10);

    // Texto de la dificultad.
    noStroke();
    fill(hover ? "#fff176" : "#ffffff");
    textAlign(CENTER, CENTER);
    textSize(20);
    text(difficulty[i], x + buttonW / 2, buttonY + buttonH / 2);
  }

  // Instrucciones debajo de los niveles.
  textAlign(CENTER, CENTER);
  textSize(16);
  stroke("#000000");
  strokeWeight(5);

  fill("#ffffff");
  text("Aguanta hasta que se cansen de perseguirte", width / 2, buttonY + 75);

  fill("#ffcc80");
  text(
    "Flechas o WASD: manejar    ESPACIO: pitar    P: pausa",
    width / 2,
    buttonY + 103
  );

  fill("#fff176");
  text("Récord: " + nf(highScore, 5), width / 2, buttonY + 135);

  pop();
}

// Devuelve la dificultad correspondiente a la posición del ratón.
// Devuelve -1 si no se ha pulsado ningún botón.
function getSelectedDifficulty() {
  const buttonW = 150;
  const buttonH = 48;
  const gap = 20;
  const totalW = buttonW * 3 + gap * 2;
  const startX = (width - totalW) / 2;
  const buttonY = height * 0.7;

  for (let i = 0; i < 3; i++) {
    const x = startX + i * (buttonW + gap);

    if (
      mouseX >= x &&
      mouseX <= x + buttonW &&
      mouseY >= buttonY &&
      mouseY <= buttonY + buttonH
    ) {
      return i;
    }
  }

  return -1;
}

function win(level) {
  const currentLevel = level + 1;
  const nextLevel = level + 2;

  new Screen({
    backdrop: "#26301c",
    title: "¡Te escapaste! (nivel " + currentLevel + ")",
    titleSize: 30,
    titleColor: "#ffe082",
    taxis: true,
    lines: [
      "Dejaste atrás " + getStopName(level),
      "Puntos: " + nf(score, 5) + "    Récord: " + nf(highScore, 5),
      "Vidas: " + game.lifes,
      {
        text: "Presiona ENTER para el nivel " + nextLevel + " (" +
          getStopName(level + 1) + ")",
        color: "#fff176",
        blink: true
      }
    ]
  }).draw();
}

function lose(level) {
  const currentLevel = level + 1;

  new Screen({
    backdrop: "#3a1414",
    title: "¡Te abordaron!",
    titleColor: "#ef9a9a",
    lines: [
      {
        text: "Llegaste hasta el nivel " + currentLevel + " (" +
          getStopName(level) + ")",
      },
      "Puntos: " + nf(score, 5) + "    Récord: " + nf(highScore, 5),
      {
        text: "Presiona ENTER para intentar de nuevo",
        color: "#fff176",
        blink: true
      }
    ]
  }).draw();
}

function pause() {
  new Screen({
    overlay: [0, 0, 0, 150],
    title: "PAUSA",
    titleColor: "#ffffff",
    lines: [
      "P: continuar",
      "R: volver al inicio",
      "B: nivel anterior"
    ]
  }).draw();
}
