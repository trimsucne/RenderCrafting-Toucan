// Background y UI (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Background {
  static preload() {
    Background.img = undefined;
  }
  
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // A definir en las implementaciones
    this.img = undefined;        // Recuerden que si ponen texturas,
                                 // la idea es que sea pixelart
                                 // (por lo que es arcade).

    // Opcionales (pueden añadir más que utilicen internamente)
    // en las hijas.
    this.tint = undefined;
    this.text = undefined;
  }

  update() {
    // Implementación general.
    // El escenario normalmente no necesita actualizarse,
    // pero si se hacen personas o algo así, podrían moverse.
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

// Landscape / Ground
class Landscape extends Background {
  static preload() {
    Landscape.img = loadImage("img/background/landscape.png");  // No existe
  }
  
  constructor(x, y) {
    super(x, y, width, height);
    this.img = Landscape.img;
  }
}

// (Otras podrían ser las carreteras, troncos, postes, elementos de UI...)
