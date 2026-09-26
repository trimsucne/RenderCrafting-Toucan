// Player (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Player {
  static preload() {
    Player.img = undefined;
  }
  
  constructor(x, y, width, height, lifes) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.lifes = lifes;

    // A definir en las implementaciones
    this.velocityX = 0;
    this.velocityY = 0;
    this.img = undefined;

    // Opcionales (pueden añadir más que utilicen internamente)
    // en las hijas.
    this.tint = undefined;
  }

  update(key) {
    // Comportamiento general de movimiento que
    // recibe la tecla oprimida.
    // Se podrían definir funciones auxiliares para moveLeft(),
    // moveRight(), rotar y así...
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
  
  collide() {
    this.lifes -= 1;
  }
  
  isDead() {
    return lifes <= 0;
  }
}

// Implementaciones hijas (pueden añadir todas las que quieran,
// esta es de ejemplo básico del constructor).

// FrogGreen
class FrogGreen extends Player {
  static preload() {
    FrogGreen.img = loadImage("img/player/frog.png");  // No existe
  }
  
  constructor(x, y, lifes) {
    super(x, y, 40, 40, lifes);
    this.velocityX = 1;
    this.velocityY = 2;
    this.img = FrogGreen.img;
  }
}

// (Otras podrían ser sapos de otros colores, otra especie, pero no
// es obligatorio hacer más...)
