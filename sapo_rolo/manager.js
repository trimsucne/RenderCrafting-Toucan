// Archivo secundario: detección de colisiones, puntaje, tiempo,
// detección de victoria o derrota y las pantallas de cada estado.
//
// Uso rápido (desde sapo_rolo.js):
//   startLevel(frog);                                   // al cargar un nivel
//   const result = manageCollisions(frog, obstacles);   // cada frame
//   // result: "DIE" (sin vidas), "WIN" (llegó a la meta) o null
//
// Las pantallas usan los elementos de UI de background.js:
//   drawInitialUI(), win(level), lose(level), pause()


// Puntos que da cada cosa.
const POINTS = {
  STEP: 10,      // por cada fila nueva que avanza el sapo
  GOAL: 100,     // por llegar a la meta
  SECOND: 10     // por cada segundo que sobra al llegar
};

// Segundos de tiempo por cada fila del nivel.
const SECONDS_PER_ROW = 2.5;

// Clave del récord en el almacenamiento del navegador.
const HIGH_SCORE_KEY = "sapo_rolo_high_score";

// Estado de la partida.
let score = 0;
let highScore = loadHighScore();
let bestRow = 0;          // fila más alta alcanzada en este nivel
let timeLimit = 30;       // segundos por vida en este nivel
let timeLeft = 30;


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

function get_time_fraction() {
  return timeLimit > 0 ? timeLeft / timeLimit : 0;
}


// Nivel

// Prepara puntaje y reloj para un nivel recién cargado.
function startLevel(player) {
  bestRow = player.row;
  timeLimit = GRID.ROWS * SECONDS_PER_ROW;
  timeLeft = timeLimit;
}

// El sapo pierde una vida. Se sincroniza la variable global 'lifes'
// (de sapo_rolo.js) para que el HUD y el siguiente nivel la vean.
function killPlayer(player, cause) {
  player.die(cause);
  lifes = player.lifes;
}


// Colisiones

// Revisa al jugador contra los obstáculos y el terreno.
// Devuelve "DIE" si se acabaron las vidas, "WIN" si llegó a la meta
// o null si el juego sigue.
function manageCollisions(player, obstacles) {
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
    timeLeft = timeLimit;
    return null;
  }

  // 2. Reloj.
  timeLeft -= min(deltaTime, 50) / 1000;
  if (timeLeft <= 0) {
    timeLeft = 0;
    killPlayer(player, "time");
    return null;
  }

  // 3. Vehículos: se revisa la posición real (también en el aire,
  //    porque el sapo puede chocar a mitad de salto).
  const hits = Obstacle.touching(
    obstacles,
    player.x,
    player.y,
    player.hitboxWidth(),
    player.hitboxHeight()
  );
  if (hits.some((o) => o.deadly)) {
    killPlayer(player, "hit");
    return null;
  }

  // En el aire no se cae al agua ni cuenta como llegada.
  if (player.isHopping()) {
    return null;
  }

  const row = player.row;

  // 4. Río: tiene que tener el centro sobre un tronco; si no, se ahoga.
  if (GRID.isRiver(row)) {
    const log = obstacles.find((o) =>
      o.rideable &&
      o.overlaps(player.x, player.y, player.width * 0.3, 1)
    );

    if (log === undefined) {
      killPlayer(player, "water");
      return null;
    }

    player.ride(log.lastDX);

    if (player.isOutOfBounds()) {
      killPlayer(player, "drift");
      return null;
    }
  }

  // 5. Puntos por avanzar a filas nuevas (no se repiten al morir).
  if (row < bestRow) {
    addScore(POINTS.STEP * (bestRow - row));
    bestRow = row;
  }

  // 6. Meta.
  if (GRID.GOAL.includes(row)) {
    addScore(POINTS.GOAL + POINTS.SECOND * floor(timeLeft));
    return "WIN";
  }

  return null;
}


// Pantallas

function drawInitialUI() {
  // Mostrar la intro primero.
  if (showIntro) {
    image(introGif, width/2, height/2, width, height);

    // Esperar 34 segundos antes de mostrar el menú.
    if (millis() - introStartTime >= 34000) {
      showIntro = false;
    }

    return 0;
  }

  // Mostrar el menú sobre el GIF, sin tapar su fondo.
  image(menuGif, width/2, height/2, width, height);

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
    fill(18, 48, 28, hover ? 240 : 200);
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
  text("Cruza la carretera y el río hasta la META", width / 2, buttonY + 75);

  fill("#a5d6a7");
  text("Flechas o WASD: saltar    P: pausa", width / 2, buttonY + 103);

  fill("#fff176");
  text("Récord: " + nf(highScore, 5), width / 2, buttonY + 135);
  
  pop();
}

// Devuelve la dificultad correspondiente a la posición del ratón.
// Devuelve 0 si no se ha pulsado ningún botón.
function getSelectedDifficulty() {
  const buttonW = 150;
  const buttonH = 48;
  const gap = 20;
  const totalW = buttonW * 3 + gap * 2;
  const startX = (width - totalW) / 2;
  const buttonY = height * 0.7;

  for (let i = 0; i < 3; i++) {
    // Centro del botón, igual que al dibujarlo.
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
    backdrop: "#1b3a24",
    title: "¡Nivel " + currentLevel + " (" +
      getLocalityName(level) + ") completado!",
    titleSize: 30,
    titleColor: "#a5d6a7",
    frogs: true,
    lines: [
      "Puntos: " + nf(score, 5) + "    Récord: " + nf(highScore, 5),
      "Vidas: " + lifes,
      {
        text: "Presiona ENTER para el nivel " + nextLevel + " (" +
          getLocalityName(level + 1) + ")",
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
    title: "¡Perdiste!",
    titleColor: "#ef9a9a",
    lines: [
      {
        text: "Llegaste hasta el nivel " + currentLevel + " (" +
          getLocalityName(level) + ")",
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
