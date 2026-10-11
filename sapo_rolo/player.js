
 // Jugador: el sapo. Se mueve a saltos de una casilla, se deja
// llevar por los troncos y tiene vidas.
//
// Imágenes:
//   img/player/frog_green.png
//   img/player/frog_golden.png
//   img/player/skull.png
//
// Uso desde sapo_rolo.js:
//   frog = createPlayer(level.player, lifes);
//
// La entrada llega desde PlayState.keyPressed() -> frog.keyPressed(key).
// Las colisiones las decide manager.js.

class Player {
  static COLUMNS = 17;

  static HOP_TIME = 0.12;
  static DEATH_TIME = 0.9;

  static skullImg = undefined;

  static MOVES = {
    up: {
      dx: 0,
      dy: -1,
      angle: 0,
      keys: ["ArrowUp", "w", "W"]
    },
    down: {
      dx: 0,
      dy: 1,
      angle: Math.PI,
      keys: ["ArrowDown", "s", "S"]
    },
    left: {
      dx: -1,
      dy: 0,
      angle: -Math.PI / 2,
      keys: ["ArrowLeft", "a", "A"]
    },
    right: {
      dx: 1,
      dy: 0,
      angle: Math.PI / 2,
      keys: ["ArrowRight", "d", "D"]
    }
  };

  static preload() {
    Player.skullImg = loadImage("img/player/skull.png");
  }

  static step() {
    return sizeX(1 / Player.COLUMNS);
  }

  constructor(x, y, width, height, lifes) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.lifes = lifes;

    // Punto de aparición.
    this.startX = x;
    this.startRow = GRID.rowOf(y);

    // Fila actual o fila de destino durante el salto.
    this.row = this.startRow;

    // Orientación: 0 significa que mira hacia arriba.
    this.angle = 0;

    // Salto actual o null si está quieto.
    this.hop = null;

    // Estado de muerte.
    this.dying = false;
    this.deathTimer = 0;
    this.deathCause = undefined;

    // La hitbox es menor que el dibujo para evitar
    // colisiones visualmente injustas.
    this.hitbox = 0.6;

    this.img = undefined;
    this.tint = undefined;
    this.fallbackColor = "#43a047";
  }

  keyPressed(key) {
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

  move(move) {
    this.angle = move.angle;

    const half = Player.step() / 2;

    const toRow = constrain(
      this.row + move.dy,
      0,
      GRID.ROWS - 1
    );

    const toX = constrain(
      this.x + move.dx * Player.step(),
      half,
      width - half
    );

    // Contra un borde, gira sin desplazarse.
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
      this.hop.t = min(
        1,
        this.hop.t + dt / Player.HOP_TIME
      );

      this.x = lerp(
        this.hop.fromX,
        this.hop.toX,
        this.hop.t
      );

      this.y = lerp(
        this.hop.fromY,
        this.hop.toY,
        this.hop.t
      );

      if (this.hop.t >= 1) {
        this.hop = null;
      }
    }
  }

  // Lo desplaza el tronco sobre el que viaja.
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

  deathFinished() {
    return this.dying && this.deathTimer <= 0;
  }

  isOutOfBounds() {
    return this.x < 0 || this.x > width;
  }

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

    // Evita el suavizado de las imágenes pixel art.
    drawingContext.imageSmoothingEnabled = false;

    if (this.dying) {
      this.drawDeath();
      pop();
      return;
    }

    // El sprite original debe mirar hacia arriba.
    // La rotación lo orienta según el movimiento.
    rotate(this.angle);

    // El sapo aumenta de tamaño ligeramente al saltar.
    if (this.hop !== null) {
      scale(1 + 0.25 * sin(this.hop.t * PI));
    }

    if (this.tint !== undefined) {
      tint(this.tint);
    }

    if (this.img !== undefined) {
      image(
        this.img,
        0,
        0,
        this.width,
        this.height
      );
    } else {
      noStroke();
      fill(this.fallbackColor);
      rect(0, 0, this.width, this.height);
    }

    // Evita que el tint afecte otros dibujos.
    noTint();

    pop();
  }

  // Animación de muerte: ondas al ahogarse,
  // mancha roja al ser atropellado y calavera.
  drawDeath() {
    const k = 1 - max(0, this.deathTimer) / Player.DEATH_TIME;

    if (
      this.deathCause === "water" ||
      this.deathCause === "drift"
    ) {
      noFill();
      stroke(255, 255 * (1 - k));
      strokeWeight(2);

      circle(
        0,
        0,
        this.width * (0.5 + k)
      );

      circle(
        0,
        0,
        this.width * (0.2 + 0.6 * k)
      );
    } else if (this.deathCause === "hit") {
      noStroke();
      fill(200, 30, 30, 180 * (1 - k));

      circle(
        0,
        0,
        this.width * 1.2
      );
    }

    const skullWidth = this.width * 0.8;

    if (Player.skullImg !== undefined) {
      const skullHeight =
        skullWidth *
        (Player.skullImg.height / Player.skullImg.width);

      image(
        Player.skullImg,
        0,
        0,
        skullWidth,
        skullHeight
      );
    } else {
      // Respaldo si no se encuentra la imagen.
      noStroke();
      fill(242);
      ellipse(0, 0, skullWidth, skullWidth);
    }
  }
}


// Frog: sapo que utiliza una imagen PNG.

class Frog extends Player {
  static greenImg = undefined;
  static goldenImg = undefined;

  static preload() {
    Frog.greenImg = loadImage(
      "img/player/frog_green.png"
    );

    Frog.goldenImg = loadImage(
      "img/player/frog_golden.png"
    );
  }

  static sprite(type) {
    return type === "golden"
      ? Frog.goldenImg
      : Frog.greenImg;
  }

  constructor(x, y, lifes, type = "green") {
    const img = Frog.sprite(type);

    // Todas las variantes ocupan el 80 % de la altura
    // de una fila. El ancho conserva la proporción del PNG.
    const h = GRID.rowHeight() * 0.8;

    const aspectRatio =
      img && img.width > 0 && img.height > 0
        ? img.width / img.height
        : 1;

    const w = h * aspectRatio;

    super(x, y, w, h, lifes);

    this.type = type;
    this.img = img;

    this.fallbackColor =
      type === "golden"
        ? "#f4c20d"
        : "#43a047";
  }
}


// Variantes concretas del jugador.

class FrogGreen extends Frog {
  constructor(x, y, lifes) {
    super(x, y, lifes, "green");
  }
}

class FrogDorada extends Frog {
  constructor(x, y, lifes) {
    super(x, y, lifes, "golden");
  }
}


// Crea el jugador a partir de la configuración del nivel.

function createPlayer(playerConfig = {}, lifes = 3) {
  const x = mapX(playerConfig.x ?? 0.5);
  const y = GRID.rowY(GRID.START[0]);

  if (playerConfig.type === "golden") {
    return new FrogDorada(x, y, lifes);
  }

  return new FrogGreen(x, y, lifes);
}
