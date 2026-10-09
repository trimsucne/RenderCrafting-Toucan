// Archivo principal: Modelo global de datos, estado y niveles.

// Márgenes generales del mapa.
const MARGINX = 0, MARGINY = 0;

// Cuadrícula del mapa (filas contadas de arriba hacia abajo)
// Definición por defecto que es reemplazada procedimentalmente
const GRID = {
  ROWS: 13,
  GOAL: [0],
  RIVER: [1, 2, 3, 4, 5],
  MEDIAN: [6],
  ROAD: [7, 8, 9, 10, 11],
  START: [12],

  // Centro vertical (en píxeles) de una fila
  rowY(row) {
    return mapY((row + 0.5) / GRID.ROWS);
  },

  // Alto de una fila en píxeles
  rowHeight() {
    return sizeY(1 / GRID.ROWS);
  },

  // Fila en la que está una coordenada y (en píxeles)
  rowOf(y) {
    return constrain(
      floor((y - MARGINY) / GRID.rowHeight()),
      0,
      GRID.ROWS - 1
    );
  },

  isRiver(row) {
    return GRID.RIVER.includes(row);
  },

  isRoad(row) {
    return GRID.ROAD.includes(row);
  },

  // Actualiza la estructura de la grilla con la configuración
  // correspondiente al nivel actual.
  set(config) {
    GRID.ROWS = config.ROWS;
    GRID.GOAL = config.GOAL;
    GRID.RIVER = config.RIVER;
    GRID.MEDIAN = config.MEDIAN;
    GRID.ROAD = config.ROAD;
    GRID.START = config.START;
  }
};


// Modelo global de datos.
let state;
let levelManager;

let lifes;
let frog;
let landscape;

let obstacles = [];
let ui = [];


function preload() {
  // Preloads de las implementaciones de los modelos.
  Obstacle.preload();
  Player.preload();
  Background.preload();
}


// Inicialización principal.
function setup() {
  createCanvas(850, 600);

  imageMode(CENTER);
  rectMode(CENTER);

  lifes = 3;
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
  state.keyPressed(key);

  // Evita que las flechas y la barra espaciadora desplacen la página.
  if ([UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW, 32].includes(keyCode)) {
    return false;
  }
}


// Reinicia lo que se acumula entre niveles (vidas y puntaje).
function resetGame() {
  lifes = 3;
  resetScore();
}


// Conversión de coordenadas normalizadas a píxeles.
function mapX(x) {
  return MARGINX + (x * (width - 2 * MARGINX));
}

function mapY(y) {
  return MARGINY + (y * (height - 2 * MARGINY));
}

function sizeX(x) {
  return x * (width - 2 * MARGINX);
}

function sizeY(y) {
  return y * (height - 2 * MARGINY);
}


// Carga de niveles

// Carga un nivel completo a partir de su configuración.
// La configuración pertenece al LevelManager.
// Los objetos concretos se crean aquí desde sus respectivos módulos.
function loadLevel(level) {
  // Grilla del nivel.
  GRID.set(level.grid);

  // Obstáculos del nivel (obstacles.js).
  obstacles = createObstacles(level.obstacles);

  // Jugador (player.js)
  frog = createPlayer(level.player, lifes);

  // Background (background.js)
  landscape = createBackground(level.background);

  // UI (background.js)
  ui = createUI(level.ui);

  // Puntaje y reloj del nivel (manager.js)
  startLevel(frog);
}


// State Manager.
class StateManager {
  // Transiciones permitidas entre estados.
  // Cada evento recibe el StateManager como parent y devuelve
  // la nueva instancia del estado correspondiente.
  static states = {
    initial: {
      PLAY: (parent) => {
        return new PlayState(parent);
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
}


// States

// Initial State
class InitState {
  constructor(parent) {
    this.level = parent.level;
  }

  // Renderizado de la pantalla inicial.
  draw() {
    drawInitialUI();
  }

  // Entrada de la pantalla inicial.
  keyPressed(key) {
    if (key === "Enter") {
      state.change("PLAY");
    }
  }
}


// Playing State
class PlayState {
  constructor(parent) {
    this.level = parent.level;
    // Configuración guardada del nivel.
    const level = levelManager.getLevel(this.level);
    loadLevel(level);
  }


  // Renderizado principal del juego.
  draw() {
    // Background
    if (landscape !== undefined) {
      landscape.update();
      landscape.draw();
    }
    // Obstáculos
    for (const obstacle of obstacles) {
      obstacle.update();
      obstacle.draw();
    }
    // Jugador
    if (frog !== undefined) {
      frog.update();
      frog.draw();
    }
    // Colisiones (manager.js)
    const result = manageCollisions(frog, obstacles);

    if (result === "DIE") {
      state.change("DIE");
    }

    if (result === "WIN") {
      state.change("WIN");
    }

    // UI
    for (const element of ui) {
      element.update();
      element.draw();
    }
  }

  // Entrada durante la partida.
  keyPressed(key) {
    // Movimiento del jugador (player.js).
    if (frog !== undefined) {
      frog.keyPressed(key);
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

    // El juego que estaba debajo.
    if (landscape !== undefined) {
      landscape.draw();
    }
    for (const obstacle of obstacles) {
      obstacle.draw();
    }
    if (frog !== undefined) {
      frog.draw();
    }
    for (const element of ui) {
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

  // Máximo de filas que puede tener un nivel.
  static MAX_ROWS = 20;

  constructor() {
    this.current = 0;
    this.levels = LevelManager.levels;
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
    const grid = this.generateGridConfig(number);
    const level = {
      number: number,
      // Configuración de la grilla.
      grid: grid,
      // Configuración de obstáculos.
      obstacles: this.generateObstacleConfig(number, grid),
      // Configuración del jugador (player.js): columna inicial
      // (normalizada) y especie, que se alterna en cada nivel.
      player: {
        x: 0.5,
        type: number % 2 === 0 ? "green" : "golden"
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

  // Generación procedimental de la estructura de la grilla.
  // La dificultad del nivel modifica la cantidad de filas
  // peligrosas y de zonas seguras.
  // Siempre se mantienen las reglas mínimas:
  // - una fila de inicio.
  // - una fila de meta.
  // - mínimo dos filas de río.
  // - mínimo dos filas de carretera.
  // - mínimo un andén entre las zonas peligrosas.
  generateGridConfig(level) {

    // El nivel determina directamente la cantidad total de filas
    // (con un máximo para que las filas no queden diminutas).
    const rows = min(12 + level, LevelManager.MAX_ROWS);

    const river = [];
    const road = [];
    const median = [];

    // Se reservan la primera fila para la meta y la última
    // para el inicio.
    const availableRows = rows - 2;

    let row = 1;

    // La estructura se construye desde la meta hacia el inicio.
    // Cada bloque peligroso tiene como mínimo dos filas.
    // Los bloques están separados por al menos un andén.
    let currentType = random() < 0.5 ? "road" : "river";

    let remainingRows = availableRows;

    while (remainingRows > 0) {

      // Si quedan muy pocas filas, se utilizan como zona segura.
      if (remainingRows === 1) {
        median.push(row++);
        remainingRows--;
        continue;
      }

      // Bloque peligroso.
      const maxBlockSize = level + 2;

      // El tamaño del bloque es aleatorio, pero siempre
      // tiene como mínimo dos filas.
      // Nunca más filas de las que quedan (si no, el bloque
      // se comería la fila de inicio o se saldría de la grilla).
      const count = min(
        floor(random(2, maxBlockSize + 1)),
        remainingRows
      );

      for (let i = 0; i < count; i++) {

        if (currentType === "river") {
          river.push(row++);
        } else {
          road.push(row++);
        }

      }

      remainingRows -= count;

      // Si todavía quedan filas, se agrega un andén.
      if (remainingRows > 0) {
        median.push(row++);
        remainingRows--;
      }

      // Alternamos entre río y carretera.
      currentType = currentType === "river"
        ? (random() < 0.8 ? "road" : "river")
        : (random() < 0.3 ? "road" : "river");
    }

    return {
      ROWS: rows,
      GOAL: [0],
      RIVER: river,
      MEDIAN: median,
      ROAD: road,
      START: [rows - 1]
    };
  }
  
  // Generación procedimental de la configuración de obstáculos.
  generateObstacleConfig(level, grid) {
    const speedFactor = min(1 + 0.15 * level, 2.5);
    const extraCars = floor(level / 2);
    const logShrink = min(floor(level / 3), 2);
    const logOrder = [
      "small",
      "medium",
      "long"
    ];

    const result = [];

    // Carriles del río.
    for (const row of grid.RIVER) {
      const sizes = [
        "small",
        "medium",
        "long"
      ];

      const size = sizes[
        floor(random(sizes.length))
      ];

      result.push({
        row: row,
        type: "log",
        size: logOrder[
          max(
            0,
            logOrder.indexOf(size) - logShrink
          )
        ],
        dir: random() < 0.5 ? -1 : 1,
        speed: random(0.06, 0.13) * speedFactor,
        count: floor(random(2, 5))
      });
    }

    // Carriles de la carretera.
    for (const row of grid.ROAD) {
      const vehicleTypes = [
        "car",
        "car",
        "truck",
        "race"
      ];

      const type = random(vehicleTypes);

      const colors = [
        "yellow",
        "pink",
        "white",
        "blue"
      ];

      const cfg = {
        row: row,
        type: type,
        dir: random() < 0.5 ? -1 : 1,
        speed: 0,
        count: 0
      };

      // Cada tipo de vehículo tiene una dificultad base
      // diferente.
      if (type === "car") {
        cfg.color = random(colors);
        cfg.speed = random(0.08, 0.15);
        cfg.count = floor(random(2, 4)) + extraCars;
      }

      else if (type === "truck") {
        cfg.speed = random(0.05, 0.09);
        cfg.count = floor(random(1, 3)) + extraCars;
      }

      else if (type === "race") {
        cfg.speed = random(0.20, 0.32);
        cfg.count = max(1, floor(random(1, 2)) + extraCars);
      }

      cfg.speed *= speedFactor;

      result.push(cfg);
    }

    return result;
  }
}
