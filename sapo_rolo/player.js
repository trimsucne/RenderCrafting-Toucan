// Jugador: el sapo. Se mueve a saltos de una casilla (como el
// Frogger arcade), se deja llevar por los troncos y tiene vidas.
//
// Uso rápido (desde sapo_rolo.js):
//   frog = createPlayer(level.player, lifes);
//
// La entrada llega desde PlayState.keyPressed() -> frog.keyPressed(key)
// y las colisiones (cuándo muere, cuándo lo arrastra un tronco)
// las decide manager.js.


// Player (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Player {
  static preload() {
    Player.img = undefined;
  }

  // Columnas imaginarias en que se divide el ancho del mapa:
  // un salto lateral avanza exactamente una columna.
  static COLUMNS = 17;

  // Duración (segundos) de un salto y de la animación de muerte.
  static HOP_TIME = 0.12;
  static DEATH_TIME = 0.9;

  // Movimientos: cuántas columnas (dx) y filas (dy) avanza, hacia
  // dónde mira el sapo (angle) y qué teclas lo producen.
  // (Se usa Math.PI porque las constantes de p5 todavía no existen
  // cuando se lee este archivo.)
  static MOVES = {
    up:    { dx: 0,  dy: -1, angle: 0,             keys: ["ArrowUp", "w", "W"] },
    down:  { dx: 0,  dy: 1,  angle: Math.PI,       keys: ["ArrowDown", "s", "S"] },
    left:  { dx: -1, dy: 0,  angle: -Math.PI / 2,  keys: ["ArrowLeft", "a", "A"] },
    right: { dx: 1,  dy: 0,  angle: Math.PI / 2,   keys: ["ArrowRight", "d", "D"] }
  };

  // Calavera que aparece al morir (igual para todos los sapos).
  static skullRows = [
    "..WWWWW..",
    ".WWWWWWW.",
    "WWKKWKKWW",
    "WWKKWKKWW",
    "WWWWKWWWW",
    ".WWWWWWW.",
    "..WKWKW..",
    "..WWWWW.."
  ];

  static skullPalette = {
    W: "#f2f2f2",
    K: "#1b1b1b"
  };

  // Ancho de un salto lateral en pixeles.
  static step() {
    return sizeX(1 / Player.COLUMNS);
  }

  static skull() {
    return Obstacle.buildSprite(
      "skull",
      Player.skullRows,
      Player.skullPalette,
      false
    );
  }

  constructor(x, y, width, height, lifes) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.lifes = lifes;

    // Punto de aparición (al empezar y al perder una vida).
    this.startX = x;
    this.startRow = GRID.rowOf(y);

    // Fila de la grilla en la que está (o a la que está saltando).
    this.row = this.startRow;

    // Hacia dónde mira (radianes, 0 = arriba).
    this.angle = 0;

    // Salto en curso: null o { fromX, fromY, toX, toY, t } con t en [0, 1].
    this.hop = null;

    // Muerte en curso.
    this.dying = false;
    this.deathTimer = 0;
    this.deathCause = undefined;   // "hit", "water", "drift" o "time"

    // Fracción del tamaño que cuenta para chocar con vehículos
    // (más pequeña que el dibujo, para que sea justo).
    this.hitbox = 0.6;

    // A definir en las implementaciones
    this.img = undefined;

    // Opcionales (pueden añadir más que utilicen internamente)
    // en las hijas.
    this.tint = undefined;
    this.fallbackColor = "#43a047";
  }

  // Entrada: convierte la tecla en un movimiento.
  keyPressed(key) {
    // No se puede saltar mientras se está en el aire o muriendo.
    if (this.dying || this.hop !== null) {
      return;
    }

    for (const name in Player.MOVES) {
      const move = Player.MOVES[name];
      if (move.keys.includes(key)) {
        this.move(move);
        return;
      }
    }
  }

  // Empieza un salto hacia la casilla vecina (sin salirse del mapa).
  move(move) {
    this.angle = move.angle;

    const half = Player.step() / 2;
    const toRow = constrain(this.row + move.dy, 0, GRID.ROWS - 1);
    const toX = constrain(
      this.x + move.dx * Player.step(),
      half,
      width - half
    );

    // Contra un borde: solo gira.
    if (toRow === this.row && toX === this.x) {
      return;
    }

    this.hop = {
      fromX: this.x,
      fromY: this.y,
      toX: toX,
      toY: GRID.rowY(toRow),
      t: 0
    };
    this.row = toRow;
  }

  update() {
    const dt = min(deltaTime, 50) / 1000;

    if (this.dying) {
      this.deathTimer -= dt;
      return;
    }

    if (this.hop !== null) {
      this.hop.t = min(1, this.hop.t + dt / Player.HOP_TIME);
      this.x = lerp(this.hop.fromX, this.hop.toX, this.hop.t);
      this.y = lerp(this.hop.fromY, this.hop.toY, this.hop.t);

      if (this.hop.t >= 1) {
        this.hop = null;
      }
    }
  }

  // Lo mueve un tronco (dx = lo que se movió el tronco este frame).
  ride(dx) {
    if (!this.dying && this.hop === null) {
      this.x += dx;
    }
  }

  isHopping() {
    return this.hop !== null;
  }

  isDying() {
    return this.dying;
  }

  // ¿Ya terminó la animación de muerte?
  deathFinished() {
    return this.dying && this.deathTimer <= 0;
  }

  // ¿Un tronco lo sacó del mapa?
  isOutOfBounds() {
    return this.x < 0 || this.x > width;
  }

  // Tamaño del rectángulo de colisión.
  hitboxWidth() {
    return this.width * this.hitbox;
  }

  hitboxHeight() {
    return this.height * this.hitbox;
  }

  collide() {
    this.lifes -= 1;
  }

  isDead() {
    return this.lifes <= 0;
  }

  // Pierde una vida y empieza la animación de muerte.
  die(cause) {
    if (this.dying) {
      return;
    }
    this.collide();
    this.dying = true;
    this.deathTimer = Player.DEATH_TIME;
    this.deathCause = cause;
    this.hop = null;
  }

  // Vuelve al punto de inicio (después de perder una vida).
  respawn() {
    this.x = this.startX;
    this.row = this.startRow;
    this.y = GRID.rowY(this.row);
    this.angle = 0;
    this.hop = null;
    this.dying = false;
    this.deathTimer = 0;
    this.deathCause = undefined;
  }

  draw() {
    push();

    translate(this.x, this.y);
    imageMode(CENTER);
    rectMode(CENTER);
    drawingContext.imageSmoothingEnabled = false;

    if (this.dying) {
      this.drawDeath();
      pop();
      return;
    }

    rotate(this.angle);

    // En el aire se ve un poco más grande.
    if (this.hop !== null) {
      scale(1 + 0.25 * sin(this.hop.t * PI));
    }

    if (this.tint !== undefined) {
      tint(this.tint);
    }

    if (this.img !== undefined) {
      image(this.img, 0, 0, this.width, this.height);
    } else {
      noStroke();
      fill(this.fallbackColor);
      rect(0, 0, this.width, this.height);
    }

    pop();
  }

  // Animación de muerte: ondas si se ahogó, mancha roja si lo
  // atropellaron, y la calavera encima.
  drawDeath() {
    // k va de 0 (recién muerto) a 1 (animación terminada).
    const k = 1 - max(0, this.deathTimer) / Player.DEATH_TIME;

    if (this.deathCause === "water" || this.deathCause === "drift") {
      noFill();
      stroke(255, 255 * (1 - k));
      strokeWeight(2);
      circle(0, 0, this.width * (0.5 + k));
      circle(0, 0, this.width * (0.2 + 0.6 * k));
    } else if (this.deathCause === "hit") {
      noStroke();
      fill(200, 30, 30, 180 * (1 - k));
      circle(0, 0, this.width * 1.2);
    }

    const s = this.width * 0.8;
    image(Player.skull(), 0, 0, s, s * 8 / 9);
  }
}

// Implementaciones hijas (pueden añadir todas las que quieran).

// Frog: sapo en pixelart. Cada especie solo cambia la paleta.
class Frog extends Player {
  static rows = [
    "...OO...OO...",
    "..OWKO.OKWO..",
    "..OGGOOOGGO..",
    "F.OGGGGGGGO.F",
    "FOGGDGGGDGGOF",
    ".OGGGGGGGGGO.",
    "..OGGLLLGGO..",
    "..OGLLLLLGO..",
    ".OOGGLLLGGOO.",
    "OGGOGGGGGOGGO",
    "FGO.OGGGO.OGF",
    "FF...OOO...FF"
  ];

  static palettes = {
    green: {
      O: "#1e5a1e",
      G: "#4caf50",
      D: "#2e7d32",
      L: "#c5e1a5",
      F: "#388e3c",
      W: "#ffffff",
      K: "#111111"
    },
    // Rana dorada (Phyllobates terribilis), del Pacífico colombiano.
    golden: {
      O: "#7a5200",
      G: "#f4c20d",
      D: "#c79100",
      L: "#fff3b0",
      F: "#e0a800",
      W: "#ffffff",
      K: "#111111"
    }
  };

  static sprite(type) {
    const palette = Frog.palettes[type] || Frog.palettes.green;
    return Obstacle.buildSprite("frog-" + type, Frog.rows, palette, false);
  }

  constructor(x, y, lifes, type = "green") {
    // El sapo ocupa el 80% del alto de una fila.
    const p = GRID.rowHeight() * 0.8 / Frog.rows.length;

    super(x, y, Frog.rows[0].length * p, Frog.rows.length * p, lifes);

    this.type = type;
    this.img = Frog.sprite(type);
  }
}

// FrogGreen
class FrogGreen extends Frog {
  constructor(x, y, lifes) {
    super(x, y, lifes, "green");
  }
}

// FrogDorada
class FrogDorada extends Frog {
  constructor(x, y, lifes) {
    super(x, y, lifes, "golden");
  }
}


// Crea el jugador a partir de la configuración guardada en el nivel.
// Siempre aparece en la fila de inicio de la grilla.
function createPlayer(playerConfig = {}, lifes = 3) {
  const x = mapX(playerConfig.x ?? 0.5);
  const y = GRID.rowY(GRID.START[0]);

  if (playerConfig.type === "golden") {
    return new FrogDorada(x, y, lifes);
  }
  return new FrogGreen(x, y, lifes);
}
