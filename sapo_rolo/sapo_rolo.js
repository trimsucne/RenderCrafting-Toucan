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
  
  for (const obstacles of obstacles) {
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
  static const states = {
    initial: {
      PLAY: PlayState,
    },
    playing: {
      DIE: BadEndState,
    },
    win: {
      
    },
    lose: {
      
    }
  };
  
  constructor() {
    this.curName = "initial";
    this.current = new InitState();
  }

}

// States Classes

// Initial State
class InitState {
  constructor() {
    
  }
}

// Playing State
class PlayState {
  constructor() {
    
  }
}

// Win State
class GoodEndState {
  constructor() {
    
  }
}

// Lose State
class BadEndState {
  constructor() {
    
  }
}

// Level
class Level {
  constructor() {
    
  }
}
