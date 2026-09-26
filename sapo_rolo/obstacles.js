// Obstacle (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Obstacle {
  static preload() {
    Obstacle.img = undefined;
  }
  
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // A definir en las implementaciones
    this.img = undefined;
    this.velocityX = 0;
    this.velocityY = 0;

    // Opcionales (pueden añadir más que utilicen internamente)
    // en las hijas.
    this.tint = undefined;
  }

  update() {
    // Movimiento genérico
    this.x += this.velocityX;
    this.y += this.velocityY;
  }

  draw() {
    push();

    if (this.tint !== undefined) {
      tint(this.tint);
    }

    if (this.img !== undefined) {
      image(this.img, this.x, this.y, this.width, this.height);
    }

    pop();
  }
}

// Implementaciones hijas (pueden añadir todas las que quieran,
// esta es de ejemplo básico del constructor).

// Car
class Car extends Obstacle {
  static preload() {
    Car.img = loadImage("img/obstacles/car.png");  // No existe
  }
  
  constructor(x, y) {
    super(x, y, 80, 40);
    this.velocityX = 4;
    this.img = Car.img;
  }
}

// (Otras podrían ser el río (sin troncos), el metro, bicicletas,
// algún ladrón...)
