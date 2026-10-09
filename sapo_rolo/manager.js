// Archivo secundario: detección de colisiones, puntaje, tiempo,
// detección de victoria o derrota y las pantallas de cada estado.
//
// Uso rápido (desde sapo_rolo.js):
//   startLevel(frog);                                   // al cargar un nivel
//   const result = manageCollisions(frog, obstacles);   // cada frame
//   // result: "DIE" (sin vidas), "WIN" (llegó a la meta) o null
//
// Las pantallas usan la clase Screen de background.js:
//   drawInitialUI(), win(level), lose(level), pause()


// Puntos.
const POINTS_PER_ROW = 10;       // por cada fila nueva que avanza el sapo
const POINTS_GOAL = 100;         // por llegar a la meta
const POINTS_PER_SECOND = 10;    // por cada segundo que sobra al llegar

// Segundos de tiempo por cada fila del nivel.
const SECONDS_PER_ROW = 2.5;

// Estado de la partida.
let score = 0;
let highScore = 0;
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
  }
}


// Tiempo

function get_time_fraction() {
  return timeLeft / timeLimit;
}


// Nivel

// Prepara puntaje y reloj para un nivel recién cargado.
function startLevel(player) {
  bestRow = player.row;
  timeLimit = GRID.ROWS * SECONDS_PER_ROW;
  timeLeft = timeLimit;
}

// El sapo pierde una vida. También se actualiza la variable global
// 'lifes' (sapo_rolo.js) para que el HUD y el siguiente nivel la vean.
function killPlayer(player, cause) {
  player.die(cause);
  lifes = player.lifes;
}


// Colisiones

// Revisa al jugador contra los obstáculos y el terreno.
// Devuelve "DIE" si se acabaron las vidas, "WIN" si llegó a la meta
// o null si el juego sigue.
function manageCollisions(player, obstacles) {
  // 1. Si está muriendo, se espera a que termine la animación y luego
  //    reaparece (o se pierde si no quedan vidas).
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

  // 3. Carros, motos, buses y ciclistas (también en el aire: si salta
  //    contra un carro, lo atropella a mitad del salto).
  const touching = Obstacle.touching(
    obstacles,
    player.x,
    player.y,
    player.hitboxWidth(),
    player.hitboxHeight()
  );

  for (const o of touching) {
    if (o.deadly) {
      killPlayer(player, "hit");
      return null;
    }
  }

  // En el aire no se cae al agua, no lo empujan y no cuenta como llegada.
  if (player.isHopping()) {
    return null;
  }

  // 4. Peatones: no matan, pero empujan.
  for (const o of touching) {
    if (o.pushes) {
      player.pushedBy(o.lastDX);
    }
  }

  const row = player.row;

  // 5. Río: el centro del sapo tiene que estar sobre un tronco.
  if (GRID.isRiver(row)) {
    let log = undefined;
    for (const o of obstacles) {
      if (o.rideable && o.overlaps(player.x, player.y, player.width * 0.3, 1)) {
        log = o;
      }
    }

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

  // 6. Puntos por avanzar a filas nuevas (subir = fila más pequeña).
  if (row < bestRow) {
    addScore(POINTS_PER_ROW * (bestRow - row));
    bestRow = row;
  }

  // 7. Meta.
  if (GRID.GOAL.includes(row)) {
    addScore(POINTS_GOAL + POINTS_PER_SECOND * floor(timeLeft));
    return "WIN";
  }

  return null;
}


// Pantallas

function drawInitialUI() {
  new Screen({
    backdrop: "#12301c",
    title: "SAPO ROLO",
    titleColor: "#fff176",
    frogs: true,
    lines: [
      "Cruza las 20 localidades de Bogotá",
      "Flechas o WASD: saltar    P: pausa",
      "Récord: " + nf(highScore, 5),
      "Presiona ENTER para comenzar"
    ]
  }).draw();
}

function win(level) {
  const name = LevelManager.LOCALIDADES[level].name;

  // Última localidad: se acabó el recorrido.
  if (level === LevelManager.LOCALIDADES.length - 1) {
    new Screen({
      backdrop: "#1b3a24",
      title: "¡Recorriste todo Bogotá!",
      titleColor: "#fff176",
      frogs: true,
      lines: [
        "Cruzaste las 20 localidades, ¡qué sapo tan berraco!",
        "Puntos: " + nf(score, 5) + "    Récord: " + nf(highScore, 5),
        "Presiona ENTER para volver al inicio"
      ]
    }).draw();
    return;
  }

  const nextName = LevelManager.LOCALIDADES[level + 1].name;

  new Screen({
    backdrop: "#1b3a24",
    title: "¡Cruzaste " + name + "!",
    titleColor: "#a5d6a7",
    frogs: true,
    lines: [
      "Puntos: " + nf(score, 5) + "    Récord: " + nf(highScore, 5),
      "+1 vida   (vidas: " + lifes + ")",
      "Presiona ENTER para ir a " + nextName
    ]
  }).draw();
}

function lose(level) {
  const name = LevelManager.LOCALIDADES[level].name;

  new Screen({
    backdrop: "#3a1414",
    title: "¡Perdiste en " + name + "!",
    titleColor: "#ef9a9a",
    frogs: false,
    lines: [
      "Llegaste hasta la localidad " + (level + 1) + " de 20",
      "Puntos: " + nf(score, 5) + "    Récord: " + nf(highScore, 5),
      "Presiona ENTER para intentar de nuevo"
    ]
  }).draw();
}

function pause() {
  new Screen({
    overlay: true,
    title: "PAUSA",
    titleColor: "#ffffff",
    frogs: false,
    lines: [
      "R: volver al inicio",
      "B: localidad anterior",
      "P: continuar"
    ]
  }).draw();
}
