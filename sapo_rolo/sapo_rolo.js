// Archivo principal: Modelo global de datos, estado y niveles.

// Márgenes generales del mapa.
const MARGINX = 0, MARGINY = 0;

// Cuadrícula del mapa (filas contadas de arriba hacia abajo)
// (También podría ser procedimental después)
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
  // Obstacle.preload();
  // Player.preload();
  // Background.preload();
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
}


// Conversión de coordenadas normalizadas a píxeles.
function mapX(x) {
  return MARGINX + (x * (width - MARGINX));
}

function mapY(y) {
  return MARGINY + (y * (height - MARGINY));
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
  // Obstáculos del nivel (obstacles.js).
  obstacles = createObstacles(level.obstacles);

  // Jugador (player.js)
  // frog = createPlayer(level.player, lifes);
  // Auxiliar para probar mientras tanto:
  frog = new Player(
    mapX(0.5),
    mapY(0.95),
    sizeX(0.05),
    sizeY(0.04),
    lifes
  );
  
  // Background (background.js)
  // landscape = createBackground(level.background);
  // Auxiliar para probar mientras tanto:
  landscape = new Background(
    mapX(0),
    mapY(0),
    sizeX(1),
    sizeY(1)
  );

  // UI (background.js o manager.js)
  // ui = createUI(level.ui);
  // Auxiliar para probar mientras tanto:
  ui = [];
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
        return new PlayState(parent);
      }
    },
    pause: {
      INIT: (parent) => {
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
    background(192);

    // TODO:
    // Implementar la pantalla inicial en manager.js.
    //
    // Ejemplo:
    // drawInitialUI();

    // Auxiliar para probar mientras tanto:
    push();

    textAlign(CENTER, CENTER);
    textSize(32);
    fill(0);
    text("Sapo Rolo", width / 2, height / 2 - 40);

    textSize(18);
    text("Presiona ENTER para comenzar", width / 2, height / 2 + 10);

    pop();
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
    // Colisiones

    // TODO:
    // La lógica de colisiones debería estar en manager.js.
    //
    // Ejemplo:
    //
    // const result = manageCollisions(frog, obstacles);
    //
    // if (result === "DIE") {
    //   state.change("DIE");
    // }
    //
    // if (result === "WIN") {
    //   state.change("WIN");
    // }

    // UI
    for (const element of ui) {
      element.update();
      element.draw();
    }
  }

  // Entrada durante la partida.
  keyPressed(key) {

    // TODO:
    // La entrada específica del jugador debería delegarse a
    // player.js.
    //
    // Ejemplo:
    //
    // frog.keyPressed(key);

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
    background(192);

    // TODO:
    // La pantalla de victoria debería ser implementada por manager.js.
    //
    // Ejemplo:
    // win(this.level);

    // Auxiliar para probar mientras tanto:
    push();

    textAlign(CENTER, CENTER);
    textSize(32);
    fill(0);
    text("¡Nivel completado!", width / 2, height / 2 - 40);

    textSize(18);
    text(
      "Presiona ENTER para continuar",
      width / 2,
      height / 2 + 10
    );

    pop();
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
    background(192);

    // TODO:
    // La pantalla de derrota debería ser implementada por manager.js.
    //
    // Ejemplo:
    // lose(this.level, lifes);

    // Auxiliar para probar mientras tanto:
    push();

    textAlign(CENTER, CENTER);
    textSize(32);
    fill(0);
    text("Perdiste", width / 2, height / 2 - 40);

    textSize(18);
    text(
      "Presiona ENTER para intentar de nuevo",
      width / 2,
      height / 2 + 10
    );

    pop();
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

    // UI de pausa.
    //
    // TODO:
    // Implementar en manager.js.
    //
    // Ejemplo:
    // pause();

    // Auxiliar para probar mientras tanto:
    push();

    fill(0, 150);
    rect(width / 2, height / 2, width, height);

    fill(255);
    textAlign(CENTER, CENTER);
    textSize(32);
    text("PAUSA", width / 2, height / 2 - 20);

    textSize(18);
    text(
      "Presiona P para continuar",
      width / 2,
      height / 2 + 30
    );

    pop();
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
    const level = {
      number: number,
      // Configuración de obstáculos.
      obstacles: this.generateObstacleConfig(number),
      // Configuración del jugador.
      //
      // TODO:
      // Cuando player.js tenga su sistema de configuración,
      // se agregarán aquí sus parámetros.
      //
      // player: {
      //   x: 0.5,
      //   y: 0.95,
      //   width: 0.05,
      //   height: 0.04
      // },

      // Configuración del background.
      //
      // TODO:
      // Cuando background.js tenga su sistema de configuración,
      // se agregarán aquí sus parámetros.
      //
      // background: {
      //   ...
      // },

      // Configuración de la UI.
      //
      // TODO:
      // Cuando background.js tenga...
      //
      // ui: {
      //   ...
      // }
    };

    this.levels.push(level);
    return level;
  }

  // Generación procedimental de la configuración de obstáculos.
  generateObstacleConfig(level) {
    const speedFactor = min(1 + 0.15 * level, 2.5);
    const extraCars = floor(level / 2);
    const logShrink = min(floor(level / 3), 2);
    const logOrder = [
      "small",
      "medium",
      "long"
    ];
    
    // Configuración base de los carriles.
    const baseLanes = [
      {
        row: 1,
        type: "log",
        size: "medium",
        dir: -1,
        speed: 0.09,
        count: 3
      },
      {
        row: 2,
        type: "log",
        size: "long",
        dir: 1,
        speed: 0.07,
        count: 2
      },
      {
        row: 3,
        type: "log",
        size: "small",
        dir: -1,
        speed: 0.12,
        count: 4
      },
      {
        row: 4,
        type: "log",
        size: "long",
        dir: 1,
        speed: 0.10,
        count: 2
      },
      {
        row: 5,
        type: "log",
        size: "medium",
        dir: -1,
        speed: 0.06,
        count: 3
      },
      {
        row: 7,
        type: "truck",
        dir: -1,
        speed: 0.07,
        count: 2
      },
      {
        row: 8,
        type: "race",
        dir: 1,
        speed: 0.30,
        count: 1
      },
      {
        row: 9,
        type: "car",
        color: "pink",
        dir: -1,
        speed: 0.12,
        count: 3
      },
      {
        row: 10,
        type: "car",
        color: "white",
        dir: 1,
        speed: 0.09,
        count: 3
      },
      {
        row: 11,
        type: "car",
        color: "yellow",
        dir: -1,
        speed: 0.10,
        count: 3
      }
    ];

    const result = [];

    for (const base of baseLanes) {
      // Copia para no modificar la configuración base.
      const cfg = { ...base };
      // Troncos
      if (cfg.type === "log") {
        const originalIndex = logOrder.indexOf(cfg.size);
        const index = max(
          0,
          originalIndex - logShrink
        );
        cfg.size = logOrder[index];
      }
      // Vehículos
      else {
        cfg.count += extraCars;
      }
      // Dificultad
      cfg.speed *= speedFactor;
      result.push(cfg);
    }

    return result;
  }
}
