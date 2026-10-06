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

  // Los sprites son dibujos en pixelart definidos como texto:
  // cada caracter es un pixel y su color sale de la paleta
  // ('.' es transparente). Se dibujan una sola vez en una imagen
  // pequeña y luego se escalan, así no se recalculan cada frame.
  static spriteCache = {};

  static buildSprite(key, rows, palette, flip) {
    const cacheKey = key + (flip ? "<" : ">");

    if (Obstacle.spriteCache[cacheKey] === undefined) {
      const g = createGraphics(rows[0].length, rows.length);
      g.pixelDensity(1);
      g.noStroke();

      for (let j = 0; j < rows.length; j++) {
        const line = flip
          ? [...rows[j]].reverse().join("")
          : rows[j];

        for (let i = 0; i < line.length; i++) {
          if (line[i] !== ".") {
            g.fill(palette[line[i]]);
            g.rect(i, j, 1, 1);
          }
        }
      }

      Obstacle.spriteCache[cacheKey] = g;
    }

    return Obstacle.spriteCache[cacheKey];
  }

  // Tamaño de un pixel del sprite en pantalla (8 pixeles de alto
  // ocupan el 80% de la fila).
  static pixelSize() {
    return GRID.rowHeight() * 0.8 / 8;
  }

  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // A definir en las implementaciones
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

  draw() {
    push();

    imageMode(CENTER);
    rectMode(CENTER);

    // Sin suavizado para que el pixelart se vea nítido
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


// Vehículos (base común: matan al tocarlos)
class Vehicle extends Obstacle {
  constructor(x, y, rows, palette, key, direction) {
    const p = Obstacle.pixelSize();

    super(
      x,
      y,
      rows[0].length * p,
      rows.length * p
    );

    this.deadly = true;
    this.hitbox = 0.85;          // un poco permisivo, como el arcade

    this.img = Obstacle.buildSprite(
      key,
      rows,
      palette,
      direction < 0
    );
  }
}


// Car
class Car extends Vehicle {
  static preload() {
    Car.img = undefined;
    // Si se hace un png:
    // loadImage("img/obstacles/car.png")
  }

  static rows = [
    "...KK......KK...",
    ".BBBBBBBBBBBBBB.",
    "RBBBWWBBBBWWWBBY",
    "BBBDWWBBBBWWWBBB",
    "BBBDWWBBBBWWWBBB",
    "RBBBWWBBBBWWWBBY",
    ".BBBBBBBBBBBBBB.",
    "...KK......KK...",
  ];

  static colors = {
    yellow: ["#f4d03f", "#b7950b"],
    pink:   ["#ec7ab8", "#a8457a"],
    white:  ["#ecf0f1", "#95a5a6"],
    blue:   ["#3498db", "#1f618d"],
  };

  // direction: 1 derecha, -1 izquierda
  constructor(x, y, direction = 1, colorName = "yellow") {
    const [body, dark] = Car.colors[colorName];

    const palette = {
      B: body,
      D: dark,
      W: "#aee3f5",
      K: "#1b1b1b",
      Y: "#fff6a0",
      R: "#e74c3c"
    };

    super(
      x,
      y,
      Car.rows,
      palette,
      "car-" + colorName,
      direction
    );

    if (Car.img !== undefined) {
      this.img = Car.img;
    }
  }
}


// Carro de carreras: pequeño y muy rápido
class RaceCar extends Vehicle {
  static rows = [
    "..KKK......KKK..",
    "..KKK.DDDD.KKK..",
    "DDBBBBBBBBBBBBB.",
    "DBBBBBWWBBBBBBBY",
    "DBBBBBWWBBBBBBBY",
    "DDBBBBBBBBBBBBB.",
    "..KKK.DDDD.KKK..",
    "..KKK......KKK..",
  ];

  constructor(x, y, direction = 1) {
    const palette = {
      B: "#e74c3c",
      D: "#922b21",
      W: "#1b1b1b",
      K: "#1b1b1b",
      Y: "#fff6a0"
    };

    super(
      x,
      y,
      RaceCar.rows,
      palette,
      "race",
      direction
    );
  }
}


// Camión: largo y lento
class Truck extends Vehicle {
  static rows = [
    "...KKK...KKK.............KKK....",
    "TTTTTTTTTTTTTTTTTTTTTT.BBBBBBB..",
    "TLLLLLLLLLLLLLLLLLLLLT.BBBWWBBB.",
    "TLLLLLLLLLLLLLLLLLLLLTDBBBWWBBBY",
    "TLLLLLLLLLLLLLLLLLLLLTDBBBWWBBBY",
    "TLLLLLLLLLLLLLLLLLLLLT.BBBWWBBB.",
    "TTTTTTTTTTTTTTTTTTTTTT.BBBBBBB..",
    "...KKK...KKK.............KKK....",
  ];

  constructor(x, y, direction = 1) {
    const palette = {
      T: "#7f8c8d",
      L: "#d5d8dc",
      B: "#2e86c1",
      D: "#1b4f72",
      W: "#aee3f5",
      K: "#1b1b1b",
      Y: "#fff6a0"
    };

    super(
      x,
      y,
      Truck.rows,
      palette,
      "truck",
      direction
    );
  }
}


// Log (tronco): no mata, el sapo se sube y lo arrastra.
// Lo que mata en el río es el agua (eso lo revisa el manager).
class Log extends Obstacle {
  // Se arma con: punta izquierda + N tramos del medio + punta derecha
  static leftEnd = [
    ".OO",
    "OEE",
    "OEC",
    "OEC",
    "OEC",
    "OEC",
    "OEE",
    ".OO"
  ];

  static middle = [
    "OOOO",
    "ALAA",
    "AAAS",
    "SAAA",
    "AASA",
    "AAAA",
    "LAAS",
    "OOOO"
  ];

  static rightEnd = [
    "OO.",
    "EEO",
    "CEO",
    "CEO",
    "CEO",
    "CEO",
    "EEO",
    "OO."
  ];

  static palette = {
    O: "#4a2a12",
    A: "#8b5a2b",
    L: "#a9743f",
    S: "#6b4220",
    E: "#d9b38c",
    C: "#b5895a"
  };

  static sizes = {
    small: 4,
    medium: 6,
    long: 9
  };

  constructor(x, y, direction = 1, size = "medium") {
    const n = Log.sizes[size];

    const rows = Log.middle.map((mid, j) =>
      Log.leftEnd[j] +
      mid.repeat(n) +
      Log.rightEnd[j]
    );

    const p = Obstacle.pixelSize();

    super(
      x,
      y,
      rows[0].length * p,
      rows.length * p
    );

    this.rideable = true;

    // Los troncos no tienen dirección visual, no hace falta voltear
    this.img = Obstacle.buildSprite(
      "log-" + size,
      rows,
      Log.palette,
      false
    );
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

    // Que siempre quede un hueco de al menos 1.5 veces el obstáculo
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
