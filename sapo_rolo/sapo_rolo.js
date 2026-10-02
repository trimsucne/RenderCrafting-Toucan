// Archivo principal: Modelo global de datos, estado y niveles.

const MARGINX = 0, MARGINY = 0;

let state, lifes, frog, landscape,
  obstacles = [], ui = [];

function preload() {
  // Preloads de las implementaciones de los modelos.
  //Model1.preload(); ...
}

// Inicialización principal
function setup() {
  createCanvas(850, 600);
  
  imageMode(CENTER);
  rectMode(CENTER);
  
  state = new StateManager();
  
  lifes = 3;
  landscape = new Background(mapX(0), mapY(0),
    sizeX(1), sizeY(1));
  frog = new Player(mapX(0.5), mapY(0.95),
    sizeX(0.05), sizeY(0.04), lifes);
  
}

// Renderizado principal
function draw() {
  background(192);
  
  landscape.update();
  landscape.draw();
  
  for (const obstacle of obstacles) {
    obstacle.update();
    obstacle.draw();
  }
  
  frog.update();
  frog.draw();
  
  for (const element of ui) {
    element.update()
    element.draw();
  }

}

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
  return y * (height - 2 * MARGINY);;
}

function keyPressed() {
  //player.keyPressed(key);
}

// Clases auxiliares

// State Manager
class StateManager {
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
          return new InitState({level: 0});
        },
      BACK: (parent) => {
          parent.level -= 1;
          return new PlayState(parent);
        },
      START: (parent) => {
          return parent.parent;
        }
    }
  };
  
  constructor() {
    this.curName = "initial";
    this.current = new InitState({level: 0});
  }

}

// States Classes

// Initial State
class InitState {
  constructor(parent) {
    this.level = parent.level;
  }
}

// Playing State
class PlayState {
  constructor(parent) {
    this.level = parent.level;
  }
}

// Win State
class GoodEndState {
  constructor(parent) {
    this.level = parent.level;
  }
}

// Lose State
class BadEndState {
  constructor(parent) {
    this.level = parent.level;
  }
}

// Pause State
class PauseState {
  constructor(parent) {
    this.level = parent.level;
  }
}

// Level
class LevelManager {
  static levels = [];
  
  constructor() {
    this.current = 0;
  }
  
  getLevel(i) {
    while (i >= levels.length) {
      this.generateLevel();
    }
    return this.levels[i];
  }
  
  generateLevel() {
    //append a levels
  }
}
