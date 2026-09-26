// Archivo principal: Modelo global de datos, estado y niveles.

let lifes, frog, landscape, obstacles = [];

function preload() {
  // Preloads de las implementaciones de los modelos.
  //Model1.preload(); ...
}

// Inicialización principal
function setup() {
  createCanvas(850, 600);
  
  imageMode(CENTER);
  
}

// Renderizado principal
function draw() {
  background(192);
  
  //back.draw();
  
  //for (const obstacles of obstacles) {
  //  obstacle.draw();
  //}
  
  //player.draw();

}

function keyPressed() {
  //player.keyPressed(key);
}

// Clases auxiliares

// State
class State {
  constructor() {
    
  }
}

// Level
class Level {
  constructor() {
    
  }
}
