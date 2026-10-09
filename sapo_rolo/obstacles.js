// Obstáculos móviles de Bogotá: Spark GT (y taxis), motos NS 200,
// buses SITP, TransMilenio, ciclistas, peatones y troncos,
// organizados en carriles (Lane) dentro de una cuadrícula de filas.
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
        let line = rows[j];
        if (flip) {
          line = line.split("").reverse().join("");
        }

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
    this.pushes = false;         // true: empuja al sapo (peatones)
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


// Spark GT: el carro chiquito más rolo de todos. Con la pintura
// "taxi" sale como taxi amarillo.
class SparkGT extends Vehicle {
  static rows = [
    "..KK....KK...",
    ".BBBBBBBBBBB.",
    "RBBWWBBBWWBBY",
    "BBBWWDDDWWBBB",
    "BBBWWDDDWWBBB",
    "RBBWWBBBWWBBY",
    ".BBBBBBBBBBB.",
    "..KK....KK..."
  ];

  // [color de la carrocería, color del techo]
  static colors = {
    rojo:   ["#c62828", "#8e0000"],
    blanco: ["#eceff1", "#90a4ae"],
    gris:   ["#78909c", "#455a64"],
    azul:   ["#1e88e5", "#0d47a1"],
    taxi:   ["#f7c600", "#222222"]
  };

  // direction: 1 derecha, -1 izquierda
  constructor(x, y, direction = 1, colorName = "rojo") {
    const colors = SparkGT.colors[colorName];

    const palette = {
      B: colors[0],
      D: colors[1],
      W: "#aee3f5",
      K: "#1b1b1b",
      Y: "#fff6a0",
      R: "#e74c3c"
    };

    super(
      x,
      y,
      SparkGT.rows,
      palette,
      "spark-" + colorName,
      direction
    );
  }
}


// Moto NS 200 con su piloto: pequeña y muy rápida.
class Moto extends Vehicle {
  static rows = [
    "..........",
    "..........",
    "....JJ....",
    "KKMJHHJMKY",
    "KKMMHHMMKY",
    "....JJ....",
    "..........",
    ".........."
  ];

  static colors = {
    roja:  "#d32f2f",
    negra: "#37474f",
    azul:  "#1e88e5"
  };

  constructor(x, y, direction = 1, colorName = "roja") {
    const palette = {
      M: Moto.colors[colorName],
      K: "#1b1b1b",
      J: "#5d4037",
      H: "#111111",
      Y: "#fff6a0"
    };

    super(x, y, Moto.rows, palette, "moto-" + colorName, direction);

    // Solo la mitad del dibujo es moto (el resto es transparente).
    this.hitbox = 0.6;
  }
}


// Bus del SITP: largo, azul y lento.
class Bus extends Vehicle {
  static rows = [
    "..KKK...............KKK.....",
    "BBBBBBBBBBBBBBBBBBBBBBBBBBB.",
    "BLLLLLLLLLLLLLLLLLLLLLLLLBWY",
    "BLLAALLLLLLLAALLLLLLLLLLLBWB",
    "BLLAALLLLLLLAALLLLLLLLLLLBWB",
    "BLLLLLLLLLLLLLLLLLLLLLLLLBWY",
    "BBBBBBBBBBBBBBBBBBBBBBBBBBB.",
    "..KKK...............KKK....."
  ];

  constructor(x, y, direction = 1) {
    const palette = {
      B: "#1565c0",
      L: "#90caf9",
      A: "#607d8b",
      W: "#aee3f5",
      K: "#1b1b1b",
      Y: "#fff6a0"
    };

    super(x, y, Bus.rows, palette, "bus", direction);
  }
}


// TransMilenio articulado: dos vagones rojos unidos por un fuelle.
// Se arma igual que el tronco: parte de atrás + fuelle + parte de
// adelante.
class TransMilenio extends Vehicle {
  static back = [
    "..KKK.........KKK...",
    "RRRRRRRRRRRRRRRRRRRR",
    "RLLLLLLLLLLLLLLLLLLR",
    "RLLAALLLLLLLLAALLLLR",
    "RLLAALLLLLLLLAALLLLR",
    "RLLLLLLLLLLLLLLLLLLR",
    "RRRRRRRRRRRRRRRRRRRR",
    "..KKK.........KKK..."
  ];

  static joint = [
    "..",
    "GG",
    "GG",
    "GG",
    "GG",
    "GG",
    "GG",
    ".."
  ];

  static front = [
    "..KKK.........KKK...",
    "RRRRRRRRRRRRRRRRRRR.",
    "RLLLLLLLLLLLLLLLLRWY",
    "RLLAALLLLLLLLLLLLRWR",
    "RLLAALLLLLLLLLLLLRWR",
    "RLLLLLLLLLLLLLLLLRWY",
    "RRRRRRRRRRRRRRRRRRR.",
    "..KKK.........KKK..."
  ];

  constructor(x, y, direction = 1) {
    const rows = [];
    for (let j = 0; j < 8; j++) {
      rows.push(
        TransMilenio.back[j] +
        TransMilenio.joint[j] +
        TransMilenio.front[j]
      );
    }

    const palette = {
      R: "#c8102e",
      L: "#ef5350",
      A: "#9e9e9e",
      G: "#424242",
      W: "#aee3f5",
      K: "#1b1b1b",
      Y: "#fff6a0"
    };

    super(x, y, rows, palette, "transmilenio", direction);
  }
}


// Ciclista de la ciclovía: anda por los parques. Más lento que un
// carro, pero igual tumba al sapo.
class Cyclist extends Vehicle {
  static rows = [
    "........",
    "........",
    "...JJ...",
    "KKFHHFKK",
    "KKFHHFKK",
    "...JJ...",
    "........",
    "........"
  ];

  static shirts = ["#fdd835", "#43a047", "#e53935", "#00acc1"];

  constructor(x, y, direction = 1, shirtIndex = 0) {
    const palette = {
      K: "#1b1b1b",
      F: "#9e9e9e",
      H: "#fafafa",
      J: Cyclist.shirts[shirtIndex]
    };

    super(x, y, Cyclist.rows, palette, "cyclist-" + shirtIndex, direction);

    this.hitbox = 0.6;
  }
}


// Peatones de los andenes. No matan, pero empujan al sapo cuando
// pasan por encima de él. Hay de todo, como en cualquier andén de
// Bogotá: oficinistas, estudiantes, señoras con sombrilla,
// vendedores de tinto, habitantes de calle y perros.
class Pedestrian extends Obstacle {
  static kinds = {
    oficinista: {
      rows: [
        "........",
        "........",
        "..SSSS..",
        ".SSHHSS.",
        ".SSHHSSB",
        "..SSSS.B",
        "........",
        "........"
      ],
      palette: { S: "#37474f", H: "#3e2723", B: "#795548" }
    },
    estudiante: {
      rows: [
        "........",
        "........",
        "MMSSSS..",
        "MMSHHSS.",
        "MMSHHSS.",
        "MMSSSS..",
        "........",
        "........"
      ],
      palette: { S: "#8e24aa", H: "#212121", M: "#ff7043" }
    },
    sombrilla: {
      rows: [
        "..UUUU..",
        ".UUUUUU.",
        "UUUUUUUU",
        "UUUUKUUU",
        "UUUUUUUU",
        ".UUUUUU.",
        "..UUUU..",
        "........"
      ],
      palette: { U: "#5c6bc0", K: "#212121" }
    },
    vendedor: {
      rows: [
        "............",
        "............",
        "..SSSS.CCCCC",
        ".SSHHSSCTTCC",
        ".SSHHSSCTTCC",
        "..SSSS.CCCCC",
        "............",
        "............"
      ],
      palette: { S: "#c62828", H: "#4e342e", C: "#8d6e63", T: "#e0e0e0" }
    },
    habitante: {
      rows: [
        "........",
        "........",
        "XXXSSSS.",
        "XXSSHHSS",
        "XXSSHHSS",
        "XXXSSSS.",
        "........",
        "........"
      ],
      palette: { S: "#6d4c41", H: "#424242", X: "#d7ccc8" }
    },
    perro: {
      rows: [
        ".........",
        ".........",
        "T.DDDDD..",
        ".DDDDDDHH",
        ".DDDDDDHH",
        "..D...D..",
        ".........",
        "........."
      ],
      palette: { D: "#a1887f", H: "#795548", T: "#a1887f" }
    }
  };

  constructor(x, y, direction = 1, kind = "oficinista") {
    const data = Pedestrian.kinds[kind];
    const p = Obstacle.pixelSize();

    super(x, y, data.rows[0].length * p, data.rows.length * p);

    this.pushes = true;
    this.hitbox = 0.7;

    this.img = Obstacle.buildSprite(
      "person-" + kind,
      data.rows,
      data.palette,
      direction < 0
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

    const rows = [];
    for (let j = 0; j < 8; j++) {
      rows.push(Log.leftEnd[j] + Log.middle[j].repeat(n) + Log.rightEnd[j]);
    }

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
      let o = sample;
      if (i > 0) {
        o = make(0, y, direction);
      }

      o.x = -o.width / 2 + (offset + i * span / count) % span;
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
      make = (x, y, d) => new Log(x, y, d, cfg.size);
    } else if (cfg.type === "spark") {
      make = (x, y, d) => new SparkGT(x, y, d, cfg.color);
    } else if (cfg.type === "moto") {
      make = (x, y, d) => new Moto(x, y, d, cfg.color);
    } else if (cfg.type === "bus") {
      make = (x, y, d) => new Bus(x, y, d);
    } else if (cfg.type === "transmilenio") {
      make = (x, y, d) => new TransMilenio(x, y, d);
    } else if (cfg.type === "cyclist") {
      // Cada ciclista con una camiseta distinta.
      make = (x, y, d) => new Cyclist(x, y, d, floor(random(Cyclist.shirts.length)));
    } else if (cfg.type === "people") {
      // Cada peatón es de un tipo al azar de la lista del nivel.
      make = (x, y, d) => new Pedestrian(x, y, d, random(cfg.kinds));
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

    for (const o of lane.obstacles) {
      result.push(o);
    }
  }

  return result;
}
