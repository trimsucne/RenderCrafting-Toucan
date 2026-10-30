// Archivo principal: Modelo global de datos, estado y niveles.

// Tramos del recorrido asignados a los primeros 20 niveles.
const ROUTE_STOPS = [
  "Parque Simón Bolívar",
  "Calle 63",
  "Av. Carrera 68",
  "Av. Boyacá",
  "Av. NQS",
  "Av. Caracas",
  "Calle 26",
  "Av. El Dorado",
  "Av. Ciudad de Cali",
  "Av. Primero de Mayo",
  "Av. Las Américas",
  "Autopista Sur",
  "Av. Jiménez",
  "Av. Suba",
  "Autopista Norte",
  "Av. Calle 80",
  "Av. Calle 100",
  "Av. Carrera 7",
  "Av. Circunvalar",
  "Av. Ciudad de Quito"
];

function getStopName(level) {
  return ROUTE_STOPS[level] || "infinito";
}


// Utilidades

// Carga una imagen sin que una imagen faltante bloquee el juego.
// En p5 1.5 un archivo que no existe deja el preload esperando para
// siempre, así que aquí se libera la espera si falla. Mientras la
// imagen no esté lista (o si no existe), cada clase dibuja su figura
// de respaldo.
function loadSprite(path) {
  const img = loadImage(
    path,
    () => {
      img.ready = true;
    },
    () => {
      console.log("Imagen no encontrada: " + path);
      (p5.instance || window)._decrementPreload();
    }
  );

  return img;
}

function spriteReady(img) {
  return img !== undefined && img.ready === true;
}

// Gira el ángulo 'from' hacia 'to' una fracción 'amount' del camino
// más corto (los ángulos están en radianes).
function lerpAngle(from, to, amount) {
  const diff = ((to - from + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;

  return from + diff * amount;
}

function playGameSound(sound, loop = false) {
  if (!sound || !sound.paused) {
    return;
  }

  sound.loop = loop;
  sound.volume = 0.5;

  sound.play().catch(() => {
    // El navegador puede bloquear la reproducción.
    console.log("Reproducción de audio bloqueada");
  });
}


// Game: las constantes del juego y todo lo que existe durante una
// partida (física, taxi, gente, obstáculos, escenario y HUD).
class Game {
  // Tamaño del canvas.
  static WIDTH = 850;
  static HEIGHT = 600;

  // Franja superior reservada para el HUD.
  static HUD_HEIGHT = 36;

  // Tamaño de un pixel del arte en pantalla (los sprites son pixel art).
  static PIXEL = 3;

  // Grosor de la valla que rodea el área (6 píxeles de arte).
  static FENCE = 18;

  // Vidas al comenzar una partida.
  static LIVES = 3;

  // Área donde ocurre el juego: dentro de la valla y bajo el HUD.
  static ARENA = {
    left: 18,
    top: 36 + 18,
    right: 850 - 18,
    bottom: 600 - 18
  };

  // Sonidos e imagen del menú (se cargan en preload).
  static sounds = {};
  static menuImg = undefined;

  static preload() {
    Game.menuImg = loadSprite("img/menu.gif");

    Game.sounds = {
      horn: new Audio("aud/player/horn.mp3"),
      crash: new Audio("aud/player/crash.mp3"),
      hit: new Audio("aud/crowd/hit.mp3"),
      festival: new Audio("aud/background/festival.mp3")
    };
  }

  constructor() {
    this.lifes = Game.LIVES;

    // Dificultad seleccionada en el menú: 0 fácil, 1 normal, 2 difícil.
    this.selectedDifficulty = 1;

    // Lo que contiene el nivel actual (se crea en load()).
    this.physics = undefined;
    this.landscape = undefined;
    this.taxi = undefined;
    this.crowd = undefined;
    this.obstacles = [];
    this.traffic = undefined;
    this.ui = [];
    this.effects = [];

    // Intensidad del temblor de pantalla (píxeles).
    this.shake = 0;
  }

  // Carga un nivel completo a partir de su configuración.
  // La configuración pertenece al LevelManager.
  // Los objetos concretos se crean aquí desde sus respectivos módulos.
  load(level) {
    // Física del nivel (physics.js). Los demás objetos agregan sus
    // cuerpos a este mundo al crearse.
    this.physics = new PhysicsWorld(Game.ARENA);
    this.physics.onStart = onCollisionStart;
    this.physics.onActive = onCollisionActive;

    // Background (background.js)
    this.landscape = createBackground(level.background);

    // Obstáculos estáticos y buses del nivel (obstacles.js).
    this.obstacles = createObstacles(level.obstacles);
    this.traffic = createTraffic(level.traffic);

    // Jugador (player.js). Va antes que la gente porque ella aparece
    // lejos del taxi.
    this.taxi = createPlayer(level.player, this.lifes);

    // Gente (crowd.js)
    this.crowd = createCrowd(level.crowd);

    // UI (background.js)
    this.ui = createUI(level.ui);

    this.effects = [];
    this.shake = 0;

    // Puntaje y reloj del nivel (manager.js)
    startLevel(this.taxi, level.time);
  }

  // Actualiza todo lo que hay en juego un frame.
  update() {
    const dt = min(deltaTime, 50) / 1000;

    this.landscape.update();
    this.taxi.update(dt);
    this.crowd.update(dt);
    this.traffic.update(dt);

    // La física avanza con pasos fijos. Antes de cada paso los
    // objetos deciden cómo moverse; después, se revisa el agarre.
    this.physics.update(
      dt * 1000,
      () => {
        this.taxi.control();
        this.crowd.steer(this.taxi);
        this.traffic.drive();
      },
      () => {
        this.taxi.endStep();
      }
    );

    for (const effect of this.effects) {
      effect.update();
    }
    this.effects = this.effects.filter((effect) => !effect.done());

    this.shake = max(0, this.shake - 30 * dt);
  }

  // Dibuja el escenario y todo lo que hay en juego (sin el HUD).
  draw() {
    push();

    // Temblor de pantalla (golpes y pitazos).
    if (this.shake > 0) {
      translate(
        random(-this.shake, this.shake),
        random(-this.shake, this.shake)
      );
    }

    this.landscape.draw();

    // Avisos debajo de todo, para que no tapen a nadie.
    this.crowd.drawWarnings();
    this.traffic.drawWarnings();

    for (const obstacle of this.obstacles) {
      obstacle.draw();
    }

    this.crowd.draw();
    this.taxi.draw();
    this.traffic.draw();

    for (const effect of this.effects) {
      effect.draw();
    }

    pop();
  }
}


// Modelo global de datos.
let state;
let levelManager;
let game;
let citySoundStarted = false;

function preload() {
  Game.preload();

  Player.preload();
  Taxi.preload();

  Rockero.preload();
  Fan.preload();
  Metalero.preload();

  Barrier.preload();
  Stall.preload();
  Speaker.preload();
  Bus.preload();

  Background.preload();
  Landscape.preload();
}


// Inicialización principal.
function setup() {
  createCanvas(Game.WIDTH, Game.HEIGHT);

  imageMode(CENTER);
  rectMode(CENTER);

  game = new Game();
  levelManager = new LevelManager();
  state = new StateManager();
}


// Renderizado principal.
// Cada estado implementa su propio draw().
function draw() {
  background(192);
  state.draw();
}


// Entrada principal.
// Igual que draw(), la entrada se delega al estado actual.
function keyPressed() {
  if (!citySoundStarted) {
    playGameSound(Game.sounds.festival, true);
    citySoundStarted = true;
  }

  state.keyPressed(key);

  // Evita que las flechas y la barra espaciadora desplacen la página.
  if ([UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW, 32].includes(keyCode)) {
    return false;
  }
}


// Entrada del ratón.
// La entrada se delega al estado actual.
function mousePressed() {
  state.mousePressed();

  // Evita que el navegador gestione el clic por defecto.
  return false;
}


// Reinicia lo que se acumula entre niveles (vidas y puntaje).
function resetGame() {
  game.lifes = Game.LIVES;
  resetScore();
}


// Carga de niveles

// Carga un nivel completo a partir de su configuración.
// Todo el trabajo lo hace la clase Game.
function loadLevel(level) {
  game.load(level);
}


// State Manager.
class StateManager {
  // Transiciones permitidas entre estados.
  // Cada evento recibe el StateManager como parent y devuelve
  // la nueva instancia del estado correspondiente.
  static states = {
    initial: {
      PLAY: (parent) => {
        parent.level = 0;
        levelManager.setDifficulty(game.selectedDifficulty);
        return new PlayState(parent, 0);
      }
    },
    playing: {
      DIE: (parent) => {
        return new BadEndState(parent);
      },
      WIN: (parent) => {
        return new GoodEndState(parent);
      },
      PAUSE: (parent) => {
        return new PauseState(parent);
      }
    },
    win: {
      NEXT: (parent) => {
        parent.level += 1;
        return new PlayState(parent);
      }
    },
    lose: {
      RETRY: (parent) => {
        resetGame();
        return new PlayState(parent);
      }
    },
    pause: {
      INIT: (parent) => {
        parent.level = 0;
        resetGame();
        return new InitState(parent);
      },
      BACK: (parent) => {
        parent.level = max(0, parent.level - 1);
        return new PlayState(parent);
      },
      START: (parent) => {
        return parent.previous;
      }
    }
  };


  constructor() {
    // Nombre del estado actual.
    this.curName = "initial";
    // Nivel actual.
    this.level = 0;
    // Estado anterior.
    this.previous = null;
    // Estado actual.
    this.current = new InitState(this);
  }


  // Cambia de estado utilizando uno de los eventos definidos
  // en StateManager.states.
  change(event) {
    const transitions = StateManager.states[this.curName];
    if (transitions === undefined) {
      return;
    }
    const transition = transitions[event];
    if (transition === undefined) {
      return;
    }
    const nextState = transition(this);
    if (nextState === undefined || nextState === null) {
      return;
    }
    // Guardamos el estado anterior antes de cambiar.
    this.previous = this.current;
    this.current = nextState;
    this.curName = this.getStateName(nextState);
  }

  // Obtiene el nombre asociado a una instancia de State.
  getStateName(stateObject) {
    if (stateObject instanceof InitState) {
      return "initial";
    }
    if (stateObject instanceof PlayState) {
      return "playing";
    }
    if (stateObject instanceof GoodEndState) {
      return "win";
    }
    if (stateObject instanceof BadEndState) {
      return "lose";
    }
    if (stateObject instanceof PauseState) {
      return "pause";
    }
    return "initial";
  }


  // Delegación del renderizado al estado actual.
  draw() {
    if (this.current !== undefined &&
        this.current.draw !== undefined) {
      this.current.draw();
    }
  }


  // Delegación de la entrada al estado actual.
  keyPressed(key) {
    if (this.current !== undefined &&
        this.current.keyPressed !== undefined) {
      this.current.keyPressed(key);
    }
  }


  // Delegación de la entrada del ratón al estado actual.
  mousePressed() {
    if (this.current !== undefined &&
        this.current.mousePressed !== undefined) {
      this.current.mousePressed();
    }
  }
}


// States

// Initial State
class InitState {
  constructor(parent) {
    this.parent = parent;
    this.level = parent.level;
  }

  // Renderizado de la pantalla inicial.
  draw() {
    drawInitialUI();
  }

  // Entrada de la pantalla inicial.
  keyPressed(key) {
    // ENTER inicia el nivel seleccionado.
    if (key === "Enter") {
      this.parent.change("PLAY");
    }
  }

  // Entrada del ratón en la pantalla inicial.
  mousePressed() {
    const difficulty = getSelectedDifficulty();

    if (difficulty > -1) {
      game.selectedDifficulty = difficulty;
      this.parent.change("PLAY");
    }
  }
}


// Playing State
class PlayState {
  constructor(parent, level = parent.level) {
    this.level = level;
    parent.level = level;
    // Configuración guardada del nivel.
    const levelConfig = levelManager.getLevel(this.level);
    loadLevel(levelConfig);
  }


  // Renderizado principal del juego.
  draw() {
    // Física, gente, obstáculos y jugador (Game).
    game.update();
    game.draw();

    // Colisiones y reloj (manager.js)
    const result = manageCollisions(game.taxi);

    if (result === "DIE") {
      state.change("DIE");
    }

    if (result === "WIN") {
      state.change("WIN");
    }

    // UI
    for (const element of game.ui) {
      element.update();
      element.draw();
    }
  }

  // Entrada durante la partida.
  keyPressed(key) {
    // Pitar (player.js).
    if (game.taxi !== undefined) {
      game.taxi.keyPressed(key);
    }

    // Pausa general del juego.
    if (key === "p" || key === "P") {
      state.change("PAUSE");
    }
  }
}


// Win State
class GoodEndState {
  constructor(parent) {
    this.level = parent.level;
  }

  // Renderizado de la pantalla de victoria.
  draw() {
    win(this.level);
  }

  // Entrada de la pantalla de victoria.
  keyPressed(key) {
    if (key === "Enter") {
      state.change("NEXT");
    }
  }
}


// Lose State
class BadEndState {
  constructor(parent) {
    this.level = parent.level;
  }

  // Renderizado de la pantalla de derrota.
  draw() {
    lose(this.level);
  }

  // Entrada de la pantalla de derrota.
  keyPressed(key) {
    if (key === "Enter") {
      state.change("RETRY");
    }
  }
}


// Pause State
class PauseState {
  constructor(parent) {
    this.level = parent.level;
  }

  // Renderizado de la pantalla de pausa.
  draw() {

    // El juego que estaba debajo (sin actualizarlo).
    game.draw();
    for (const element of game.ui) {
      element.draw();
    }

    // UI de pausa (manager.js).
    pause();
  }

  // Entrada durante la pausa.
  keyPressed(key) {

    if (key === "p" || key === "P") {
      state.change("START");
    }

    // Reiniciar desde el principio.
    if (key === "r" || key === "R") {
      state.change("INIT");
    }

    // Volver al nivel anterior.
    if (key === "b" || key === "B") {
      state.change("BACK");
    }
  }
}


// Level Manager
class LevelManager {
  // Configuraciones de niveles ya generadas.
  // Se almacenan los "generadores" y no los objetos.
  static levels = [];

  // Máximo de personas sueltas en un nivel (límite de rendimiento).
  static MAX_PEOPLE = 80;

  constructor() {
    this.current = 0;
    this.levels = LevelManager.levels;
    this.difficulty = 1;
  }

  // Cambia la dificultad y descarta niveles generados con otra
  // configuración.
  setDifficulty(difficulty) {
    if (this.difficulty === difficulty) {
      return;
    }

    this.difficulty = difficulty;
    this.current = 0;
    this.levels = [];
    LevelManager.levels = this.levels;
  }

  // Obtiene la configuración de un nivel.
  // Si todavía no existe, genera todos los niveles necesarios
  // hasta llegar al solicitado.
  getLevel(i) {
    while (i >= this.levels.length) {
      this.generateLevel(this.levels.length);
    }
    this.current = i;
    return this.levels[i];
  }

  // Genera y guarda un nuevo nivel.
  generateLevel(number) {
    // Qué tanto se complica el nivel según la dificultad elegida.
    const difficultyFactor = [0.85, 1, 1.2][this.difficulty];

    const level = {
      number: number,
      // Segundos que hay que aguantar para pasar el nivel.
      time: min(25 + 5 * number, 70),
      // Configuración de obstáculos (obstacles.js).
      obstacles: this.generateObstacleConfig(number),
      // Configuración de los buses (obstacles.js).
      traffic: this.generateTrafficConfig(number),
      // Configuración de la gente (crowd.js).
      crowd: this.generateCrowdConfig(number, difficultyFactor),
      // Configuración del jugador (player.js): posición inicial
      // como fracción del área de juego.
      player: {
        x: 0.5,
        y: 0.5
      },
      // Configuración del background (background.js): la paleta
      // cambia cada dos niveles (día, atardecer, noche).
      background: {
        theme: ["day", "sunset", "night"][floor(number / 2) % 3]
      },
      // Configuración de la UI (background.js).
      ui: {
        level: number,
        timer: true
      }
    };

    this.levels.push(level);
    return level;
  }

  // Generación procedimental de la gente.
  // La dificultad y el nivel modifican cuánta gente hay, qué tan
  // rápida es, cada cuánto llegan oleadas y qué tipos aparecen.
  generateCrowdConfig(level, difficultyFactor) {
    return {
      // Multiplicador de velocidad de toda la gente (con un máximo
      // para que ninguno sea más rápido que el taxi).
      speed: min((1 + 0.03 * level) * difficultyFactor, 1.3),

      // Máximo de gente suelta a la vez y gente que ya está
      // esperando al empezar.
      max: min(25 + 6 * level, LevelManager.MAX_PEOPLE),
      start: floor(min(5 + 2 * level, 20) * difficultyFactor),

      // Gente que va llegando poco a poco (personas por segundo).
      rate: (0.6 + 0.12 * level) * difficultyFactor,

      // Oleadas: primera, cada cuánto, de cuántas personas y
      // segundos de aviso.
      firstWave: 6,
      waveEvery: max(5, 11 - 0.5 * level),
      waveSize: floor((5 + level) * difficultyFactor),
      warn: 1.4,

      // Pesos de cada tipo: los fans aparecen desde el nivel 2
      // y los metaleros desde el 3.
      mix: {
        rockero: 1,
        fan: level >= 1 ? min(0.2 + 0.05 * level, 0.45) : 0,
        metalero: level >= 2 ? min(0.05 + 0.03 * level, 0.22) : 0
      }
    };
  }

  // Generación procedimental de los buses: aparecen desde el nivel 2
  // y cada vez pasan más seguido, más rápido y avisan menos.
  generateTrafficConfig(level) {
    return {
      enabled: level >= 1,
      first: 5,
      every: max(4, 9 - 0.5 * level),
      warn: max(1, 1.7 - 0.05 * level),
      speed: 480 + 12 * level
    };
  }

  // Generación procedimental de los obstáculos estáticos.
  // Siempre quedan lejos del centro (donde aparece el taxi) y
  // separados entre sí para que se pueda pasar entre ellos.
  generateObstacleConfig(level) {
    const a = Game.ARENA;
    const cx = (a.left + a.right) / 2;
    const cy = (a.top + a.bottom) / 2;

    const types = ["barrier", "barrier", "stall", "speaker"];
    const count = min(3 + floor(level * 0.7), 9);

    const result = [];
    let attempts = 0;

    while (result.length < count && attempts < 300) {
      attempts++;

      const type = random(types);
      const radius = Obstacle.radiusOf(type);

      const x = random(a.left + 80, a.right - 80);
      const y = random(a.top + 80, a.bottom - 80);

      // Lejos del punto de aparición del taxi.
      if (dist(x, y, cx, cy) < radius + 110) {
        continue;
      }

      // Separado de los demás obstáculos.
      if (result.some((o) => dist(x, y, o.x, o.y) < radius + o.radius + 70)) {
        continue;
      }

      result.push({
        type: type,
        x: x,
        y: y,
        angle: type === "barrier" ? random([0, HALF_PI, PI / 6, -PI / 6]) : 0,
        radius: radius
      });
    }

    return result;
  }
}
