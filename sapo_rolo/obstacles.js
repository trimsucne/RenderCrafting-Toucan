// Obstáculos móviles: carros, camiones y troncos, organizados en
// carriles (Lane) dentro de una cuadrícula de filas.
//
// Uso rápido (desde sapo_rolo.js):
//   obstacles = createObstacles(level.obstacles);
//
// El nivel contiene la configuración de los obstáculos y esta función
// crea las instancias que luego serán actualizadas y dibujadas
// por el draw() principal.


// Obstacle (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Obstacle {
  static preload() {
    Obstacle.img = undefined;
  }
  // Tamaño de un pixel del sprite en pantalla.
  // Los sprites originales tienen 8 píxeles de alto.
  static pixelSize() {
    return GRID.rowHeight() * 0.8 / 8;
  }

  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // Imagen del obstáculo.
    this.img = undefined;
    this.velocityX = 0;          // píxeles por segundo
    this.velocityY = 0;

    // Comportamiento frente al jugador
    this.deadly = false;         // true: si lo toca, el sapo muere
    this.rideable = false;       // true: el sapo se puede subir encima
    this.hitbox = 1;             // fracción del tamaño usada en colisión

    // Cuánto se movió en el último update (para arrastrar al sapo)
    this.lastDX = 0;
    this.lastDY = 0;

    // Opcionales (pueden añadir más que utilicen internamente)
    // en las hijas.
    this.tint = undefined;
    this.fallbackColor = color(200, 0, 200);
  }

  update() {
    // Movimiento genérico, independiente de los FPS (se limita el
    // delta para que no "teletransporte" al volver a la pestaña).
    const dt = min(deltaTime, 50) / 1000;

    this.lastDX = this.velocityX * dt;
    this.lastDY = this.velocityY * dt;

    this.x += this.lastDX;
    this.y += this.lastDY;

    this.wrap();
  }

  // Al salir por un borde reaparece por el otro.
  wrap() {
    const span = width + this.width;

    if (this.velocityX > 0 &&
        this.x - this.width / 2 > width) {
      this.x -= span;
    } else if (this.velocityX < 0 &&
               this.x + this.width / 2 < 0) {
      this.x += span;
    }
  }

  // ¿Se cruza con el rectángulo (x, y, w, h)? Coordenadas de centro,
  // igual que imageMode(CENTER).
  overlaps(x, y, w, h) {
    const myW = this.width * this.hitbox;
    const myH = this.height * this.hitbox;

    return abs(this.x - x) < (myW + w) / 2 &&
      abs(this.y - y) < (myH + h) / 2;
  }

  // Lista de obstáculos de 'list' que tocan el rectángulo dado.
  static touching(list, x, y, w, h) {
    return list.filter((o) => o.overlaps(x, y, w, h));
  }

  // Calcula las dimensiones en pantalla a partir de la imagen.
  // Se conserva la proporción original del sprite.
  static imageSize(img) {
    const height = GRID.rowHeight() * 0.8;
    const width = height * img.width / img.height;

    return { width, height };
  }

  draw() {
    push();

    imageMode(CENTER);
    rectMode(CENTER);

    // Sin suavizado para que el pixelart se vea nítido.
    drawingContext.imageSmoothingEnabled = false;

    if (this.tint !== undefined) {
      tint(this.tint);
    }

    if (this.img !== undefined) {
      image(
        this.img,
        this.x,
        this.y,
        this.width,
        this.height
      );
    } else {
      noStroke();
      fill(this.fallbackColor);
      rect(
        this.x,
        this.y,
        this.width,
        this.height
      );
    }

    pop();
  }
}


// Implementaciones hijas


// Vehículos (base común: matan al tocarlos).
class Vehicle extends Obstacle {
  static preload() {
    Vehicle.img = undefined;
  }
  constructor(x, y, img) {
    const size = Obstacle.imageSize(img);

    super(
      x,
      y,
      size.width,
      size.height
    );

    this.deadly = true;
    this.hitbox = 0.85;          // un poco permisivo, como el arcade
    this.img = img;
  }
}


// Car
class Car extends Vehicle {
  static images = {};

  static preload() {
    Car.images = {
      yellow: {
        left: loadImage("img/obstacles/car_yellow_left.png"),
        right: loadImage("img/obstacles/car_yellow_right.png")
      },
      pink: {
        left: loadImage("img/obstacles/car_pink_left.png"),
        right: loadImage("img/obstacles/car_pink_right.png")
      },
      white: {
        left: loadImage("img/obstacles/car_white_left.png"),
        right: loadImage("img/obstacles/car_white_right.png")
      },
      blue: {
        left: loadImage("img/obstacles/car_blue_left.png"),
        right: loadImage("img/obstacles/car_blue_right.png")
      }
    };
  }

  // direction: 1 derecha, -1 izquierda.
  constructor(x, y, direction = 1, colorName = "yellow") {
    const images = Car.images[colorName] || Car.images.yellow;
    const img = images[direction < 0 ? "left" : "right"];

    super(x, y, img);
  }
}


// Carro de carreras: pequeño y muy rápido.
class RaceCar extends Vehicle {
  static images = {};

  static preload() {
    RaceCar.images = {
      left: loadImage("img/obstacles/race_left.png"),
      right: loadImage("img/obstacles/race_right.png")
    };
  }

  constructor(x, y, direction = 1) {
    const img = RaceCar.images[
      direction < 0 ? "left" : "right"
    ];

    super(x, y, img);
  }
}


// Camión: largo y lento.
class Truck extends Vehicle {
  static images = {};

  static preload() {
    Truck.images = {
      left: loadImage("img/obstacles/truck_left.png"),
      right: loadImage("img/obstacles/truck_right.png")
    };
  }

  constructor(x, y, direction = 1) {
    const img = Truck.images[
      direction < 0 ? "left" : "right"
    ];

    super(x, y, img);
  }
}


// Log (tronco): no mata, el sapo se sube y lo arrastra.
// Lo que mata en el río es el agua (eso lo revisa el manager).
class Log extends Obstacle {
  static images = {};

  static preload() {
    Log.images = {
      small: loadImage("img/obstacles/log_small.png"),
      medium: loadImage("img/obstacles/log_medium.png"),
      long: loadImage("img/obstacles/log_long.png")
    };
  }

  constructor(x, y, direction = 1, size = "medium") {
    const img = Log.images[size] || Log.images.medium;
    const dimensions = Obstacle.imageSize(img);

    super(
      x,
      y,
      dimensions.width,
      dimensions.height
    );

    this.rideable = true;

    // Los troncos no tienen dirección visual.
    // La dirección se utiliza para su movimiento en el carril.
    this.img = img;
  }
}


// Lane (carril): una fila con obstáculos iguales, igual de separados,
// todos a la misma velocidad y dirección.
class Lane {
  // row: fila de GRID, make: función (x, y, dir) => obstáculo nuevo,
  // speed: fracción del ancho del canvas por segundo.
  constructor(row, make, direction, speed, count) {
    this.row = row;
    this.direction = direction;
    this.obstacles = [];

    const y = GRID.rowY(row);
    const sample = make(0, y, direction);
    const span = width + sample.width;

    // Que siempre quede un hueco de al menos 1.5 veces el obstáculo.
    count = max(
      1,
      min(count, floor(span / (sample.width * 2.5)))
    );

    const offset = random(span);

    for (let i = 0; i < count; i++) {
      const o = i === 0
        ? sample
        : make(0, y, direction);

      o.x =
        -o.width / 2 +
        (offset + i * span / count) % span;

      o.velocityX = direction * speed * sizeX(1);

      this.obstacles.push(o);
    }
  }
}


// Crea los obstáculos a partir de la configuración guardada
// en un nivel.
//
// El nivel decide qué obstáculos existen, su fila, dirección,
// velocidad, cantidad y demás parámetros. Este archivo solamente
// convierte esa configuración en objetos del juego.
function createObstacles(obstacleConfig) {
  const result = [];

  for (const cfg of obstacleConfig) {
    let make;

    if (cfg.type === "log") {
      make = (x, y, d) => {
        return new Log(x, y, d, cfg.size);
      };
    } else if (cfg.type === "car") {
      make = (x, y, d) => {
        return new Car(x, y, d, cfg.color);
      };
    } else if (cfg.type === "truck") {
      make = (x, y, d) => {
        return new Truck(x, y, d);
      };
    } else if (cfg.type === "race") {
      make = (x, y, d) => {
        return new RaceCar(x, y, d);
      };
    } else {
      continue;
    }

    const lane = new Lane(
      cfg.row,
      make,
      cfg.dir,
      cfg.speed,
      cfg.count
    );

    result.push(...lane.obstacles);
  }

  return result;
}
