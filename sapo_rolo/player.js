// Jugador: el sapo. Se mueve a saltos de una casilla (como el
// Frogger arcade), se deja llevar por los troncos, lo empujan los
// peatones y tiene vidas.
//
// Hay un sapo por cada equipo de la capital, según la zona de la
// localidad: Santa Fe (rojo, norte), Equidad (verde, centro) y
// Millonarios (azul, sur).
//
// Uso rápido (desde sapo_rolo.js):
//   frog = createPlayer(level.player, lifes);
//
// La entrada llega desde PlayState.keyPressed() -> frog.keyPressed(key)
// y las colisiones las decide manager.js.


// Player (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Player {
  static preload() {
    Player.img = undefined;
  }

  // El ancho del mapa se divide en 17 columnas: un salto lateral
  // avanza una columna (850 / 17 = 50 px).
  static COLUMNS = 17;

  // Duración (en segundos) de un salto y de la animación de muerte.
  static HOP_TIME = 0.12;
  static DEATH_TIME = 0.9;

  // Calavera que aparece al morir.
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

  constructor(x, y, width, height, lifes) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.lifes = lifes;

    // Punto de aparición (al empezar y al perder una vida).
    this.startX = x;
    this.startRow = GRID.rowOf(y);

    // Fila en la que está (o a la que está saltando).
    this.row = this.startRow;

    // Hacia dónde mira (en radianes, 0 = arriba).
    this.angle = 0;

    // Salto en curso: null si está quieto. Si está saltando es un
    // objeto con el origen, el destino y el progreso t (de 0 a 1).
    this.hop = null;

    // Muerte en curso.
    this.dying = false;
    this.deathTimer = 0;
    this.deathCause = "";   // "hit", "water", "drift" o "time"

    // Fracción del tamaño que cuenta para chocar.
    this.hitbox = 0.6;

    // A definir en las implementaciones
    this.img = undefined;

    // Opcionales (pueden añadir más que utilicen internamente)
    // en las hijas.
    this.tint = undefined;
  }

  // Ancho de un salto lateral en pixeles.
  stepSize() {
    return sizeX(1 / Player.COLUMNS);
  }

  // Entrada: flechas o WASD.
  keyPressed(key) {
    // No se puede saltar mientras se está en el aire o muriendo.
    if (this.dying || this.hop !== null) {
      return;
    }

    if (key === "ArrowUp" || key === "w" || key === "W") {
      this.jump(0, -1, 0);
    } else if (key === "ArrowDown" || key === "s" || key === "S") {
      this.jump(0, 1, PI);
    } else if (key === "ArrowLeft" || key === "a" || key === "A") {
      this.jump(-1, 0, -HALF_PI);
    } else if (key === "ArrowRight" || key === "d" || key === "D") {
      this.jump(1, 0, HALF_PI);
    }
  }

  // Empieza un salto: dx columnas y dy filas (dy = -1 es hacia arriba).
  jump(dx, dy, angle) {
    this.angle = angle;

    const half = this.stepSize() / 2;
    const newRow = constrain(this.row + dy, 0, GRID.ROWS - 1);
    const newX = constrain(this.x + dx * this.stepSize(), half, width - half);

    // Contra un borde: solo gira.
    if (newRow === this.row && newX === this.x) {
      return;
    }

    this.hop = {
      fromX: this.x,
      fromY: this.y,
      toX: newX,
      toY: GRID.rowY(newRow),
      t: 0
    };
    this.row = newRow;
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

  // Lo arrastra un tronco (dx = lo que se movió el tronco).
  ride(dx) {
    if (!this.dying && this.hop === null) {
      this.x += dx;
    }
  }

  // Lo empuja un peatón: se mueve, pero nunca se sale del mapa.
  pushedBy(dx) {
    if (!this.dying && this.hop === null) {
      const half = this.stepSize() / 2;
      this.x = constrain(this.x + dx, half, width - half);
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

  // ¿Un tronco lo sacó del mapa?
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

  // Vuelve al punto de inicio.
  respawn() {
    this.x = this.startX;
    this.row = this.startRow;
    this.y = GRID.rowY(this.row);
    this.angle = 0;
    this.hop = null;
    this.dying = false;
    this.deathTimer = 0;
    this.deathCause = "";
  }

  draw() {
    push();

    translate(this.x, this.y);
    imageMode(CENTER);
    rectMode(CENTER);
    drawingContext.imageSmoothingEnabled = false;

    if (this.dying) {
      this.drawDeath();
    } else {
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
        fill(67, 160, 71);
        rect(0, 0, this.width, this.height);
      }
    }

    pop();
  }

  // Animación de muerte: ondas si se ahogó, mancha roja si lo
  // atropellaron, y la calavera encima.
  drawDeath() {
    // progress va de 0 (recién muerto) a 1 (animación terminada).
    const progress = 1 - max(0, this.deathTimer) / Player.DEATH_TIME;

    if (this.deathCause === "water" || this.deathCause === "drift") {
      noFill();
      stroke(255, 255 * (1 - progress));
      strokeWeight(2);
      circle(0, 0, this.width * (0.5 + progress));
      circle(0, 0, this.width * (0.2 + 0.6 * progress));
    } else if (this.deathCause === "hit") {
      noStroke();
      fill(200, 30, 30, 180 * (1 - progress));
      circle(0, 0, this.width * 1.2);
    }

    const skull = Obstacle.buildSprite("skull", Player.skullRows, Player.skullPalette, false);
    const size = this.width * 0.8;
    image(skull, 0, 0, size, size * 8 / 9);
  }
}

// Implementaciones hijas (pueden añadir todas las que quieran).

// Frog: el sapo en pixelart. Los tres equipos usan el mismo dibujo
// con distinta paleta; la panza blanca es la camiseta.
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
    // Santa Fe: rojo y blanco.
    santafe: {
      O: "#7f0000",
      G: "#d32f2f",
      D: "#9a0007",
      L: "#ffffff",
      F: "#b71c1c",
      W: "#ffffff",
      K: "#111111"
    },
    // Equidad: verde y blanco.
    equidad: {
      O: "#0b4d1e",
      G: "#2e9e44",
      D: "#1b6e2e",
      L: "#ffffff",
      F: "#23803a",
      W: "#ffffff",
      K: "#111111"
    },
    // Millonarios: azul y blanco.
    millonarios: {
      O: "#0d2c6b",
      G: "#1e5bb8",
      D: "#123f8a",
      L: "#ffffff",
      F: "#174a9e",
      W: "#ffffff",
      K: "#111111"
    }
  };

  // Nombre de cada equipo para mostrar en pantalla.
  static teamNames = {
    santafe: "Santa Fe",
    equidad: "Equidad",
    millonarios: "Millonarios"
  };

  // Imagen del sapo de un equipo (la usan también el HUD y las pantallas).
  static sprite(team) {
    let palette = Frog.palettes[team];
    if (palette === undefined) {
      palette = Frog.palettes.equidad;
    }
    return Obstacle.buildSprite("frog-" + team, Frog.rows, palette, false);
  }

  constructor(x, y, lifes, team) {
    // El sapo ocupa el 80% del alto de una fila.
    const p = GRID.rowHeight() * 0.8 / Frog.rows.length;

    super(x, y, Frog.rows[0].length * p, Frog.rows.length * p, lifes);

    this.team = team;
    this.img = Frog.sprite(team);
  }
}


// Crea el jugador a partir de la configuración guardada en el nivel.
// Siempre aparece en la fila de inicio de la grilla.
function createPlayer(playerConfig, lifes) {
  const x = mapX(playerConfig.x);
  const y = GRID.rowY(GRID.START[0]);

  return new Frog(x, y, lifes, playerConfig.team);
}
