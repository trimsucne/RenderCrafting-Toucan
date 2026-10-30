// Jugador: el taxista. Se mueve con inercia por el área de juego, puede
// pitar para empujar a la gente y pierde una vida cuando lo abordan
// (demasiada gente encima) o lo atropella un bus.
//
// Imágenes:
//   img/player/taxi.png      (mira hacia arriba, 10 x 16 píxeles de arte)
//
// Desde yo_por_alla_no_voy.js:
//   game.taxi = createPlayer(level.player, game.lifes);
//
// El movimiento se lee del teclado en cada paso físico (control()).
// La entrada puntual (pitar) llega desde PlayState.keyPressed() ->
// taxi.keyPressed(key). Las colisiones las decide manager.js.

class Player {
  // Velocidad máxima (píxeles por paso, 4.6 son unos 276 por segundo)
  // y agilidad: qué fracción de la velocidad que falta se corrige
  // en cada paso al acelerar o al soltar las teclas.
  static MAX_SPEED = 4.6;
  static ACCEL = 0.13;
  static BRAKE = 0.06;

  // El pito empuja a la gente que esté cerca (ver Crowd.blast()).
  static HORN_COOLDOWN = 3.5;
  static HORN_RADIUS = 190;
  static HORN_IMPULSE = 2.4;

  static DEATH_TIME = 1.2;
  static INVULNERABLE_TIME = 2.2;

  // Barra de agarre: cada persona encima la llena (por segundo)
  // y se vacía sola cuando nadie lo toca.
  static GRAB_RATE = 0.35;
  static GRAB_DECAY = 0.5;

  // Las teclas son códigos numéricos para usarlas con keyIsDown().
  static MOVES = {
    up: {
      dx: 0,
      dy: -1,
      keys: [38, 87]
    },
    down: {
      dx: 0,
      dy: 1,
      keys: [40, 83]
    },
    left: {
      dx: -1,
      dy: 0,
      keys: [37, 65]
    },
    right: {
      dx: 1,
      dy: 0,
      keys: [39, 68]
    }
  };

  // Lo que grita al pitar.
  static PHRASES = [
    "¡Yo por allá no voy!",
    "¡Tengo pico y placa!",
    "¡Se me acabó la gasolina!",
    "¡Voy es para el otro lado!",
    "¡Ya cerré el turno, parce!",
    "¡Eso queda muy lejos, mijo!"
  ];

  static preload() {
    // Los sonidos del taxi están en Game.preload().
  }

  constructor(x, y, width, height, lifes) {
    this.width = width;
    this.height = height;
    this.lifes = lifes;

    // Punto de aparición.
    this.startX = x;
    this.startY = y;

    // Cuerpo físico: un círculo pesado (unas 9 personas juntas).
    // Su velocidad la decide control(), no la fricción del aire.
    this.radius = width * 0.55;
    this.body = Bodies.circle(x, y, this.radius, {
      density: 0.004,
      friction: 0,
      frictionAir: 0,
      restitution: 0.1
    });
    Body.setInertia(this.body, Infinity);
    this.body.owner = this;
    game.physics.add(this.body);

    // Orientación: 0 significa que mira hacia arriba.
    this.angle = 0;

    // Barra de agarre (0 a 1). Al llenarse lo abordan.
    this.grab = 0;
    this.touched = false;

    // Tiempos (en segundos).
    this.hornCooldown = 0;
    this.invulnerable = 0;

    // Estado de muerte.
    this.dying = false;
    this.deathTimer = 0;
    this.deathCause = undefined;

    this.img = undefined;
    this.tint = undefined;
    this.fallbackColor = "#f9d71c";
  }

  get x() {
    return this.body.position.x;
  }

  get y() {
    return this.body.position.y;
  }

  // Entrada puntual: la barra espaciadora pita.
  keyPressed(key) {
    if (key === " ") {
      this.honk();
    }
  }

  // Se llama antes de cada paso físico: convierte las teclas
  // en la velocidad del cuerpo.
  control() {
    const v = this.body.velocity;

    if (this.dying) {
      Body.setVelocity(this.body, { x: 0, y: 0 });
      return;
    }

    let dx = 0;
    let dy = 0;

    for (const name in Player.MOVES) {
      const move = Player.MOVES[name];

      if (move.keys.some((k) => keyIsDown(k))) {
        dx += move.dx;
        dy += move.dy;
      }
    }

    // En diagonal no debe ir más rápido.
    const length = Math.hypot(dx, dy);
    const moving = length > 0;

    if (moving) {
      dx = dx / length * Player.MAX_SPEED;
      dy = dy / length * Player.MAX_SPEED;
    }

    const gain = moving ? Player.ACCEL : Player.BRAKE;

    Body.setVelocity(this.body, {
      x: v.x + (dx - v.x) * gain,
      y: v.y + (dy - v.y) * gain
    });
  }

  // Se llama al final de cada paso físico: la barra de agarre solo
  // baja cuando en ese paso no hubo nadie encima.
  endStep() {
    if (this.touched) {
      this.touched = false;
      return;
    }

    this.grab = max(
      0,
      this.grab - Player.GRAB_DECAY * PhysicsWorld.STEP / 1000
    );
  }

  update(dt) {
    this.hornCooldown = max(0, this.hornCooldown - dt);
    this.invulnerable = max(0, this.invulnerable - dt);

    if (this.dying) {
      this.deathTimer -= dt;
      return;
    }

    // El taxi gira hacia donde se mueve.
    const v = this.body.velocity;

    if (Math.hypot(v.x, v.y) > 0.8) {
      this.angle = lerpAngle(
        this.angle,
        atan2(v.y, v.x) + HALF_PI,
        min(1, 12 * dt)
      );
    }
  }

  // Suma agarre cuando alguien lo tiene sujeto (lo llama manager.js).
  addGrab(amount) {
    if (!this.isVulnerable()) {
      return;
    }

    this.touched = true;
    this.grab = min(1.2, this.grab + amount);
  }

  // Pitar: empuja y aturde a la gente que esté cerca.
  honk() {
    if (this.dying || this.hornCooldown > 0) {
      return;
    }

    this.hornCooldown = Player.HORN_COOLDOWN;

    game.crowd.blast(
      this.x,
      this.y,
      Player.HORN_RADIUS,
      Player.HORN_IMPULSE,
      true
    );

    game.effects.push(
      new Shockwave(this.x, this.y, Player.HORN_RADIUS, "#fdd835")
    );
    game.effects.push(new Bubble(this, random(Player.PHRASES)));
    game.shake = max(game.shake, 5);

    playGameSound(Game.sounds.horn);
  }

  // Fracción del pito ya recuperada (1 significa que está listo).
  hornFraction() {
    return 1 - this.hornCooldown / Player.HORN_COOLDOWN;
  }

  isDying() {
    return this.dying;
  }

  // ¿Le pueden hacer daño ahora mismo?
  isVulnerable() {
    return !this.dying && this.invulnerable <= 0;
  }

  deathFinished() {
    return this.dying && this.deathTimer <= 0;
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

    // Mientras muere deja de chocar con la gente.
    this.body.isSensor = true;
    Body.setVelocity(this.body, { x: 0, y: 0 });
  }

  respawn() {
    Body.setPosition(this.body, { x: this.startX, y: this.startY });
    Body.setVelocity(this.body, { x: 0, y: 0 });
    this.body.isSensor = false;

    this.angle = 0;
    this.grab = 0;
    this.touched = false;

    this.dying = false;
    this.deathTimer = 0;
    this.deathCause = undefined;

    // Unos segundos de respiro para que no lo abordan de inmediato.
    this.invulnerable = Player.INVULNERABLE_TIME;
  }

  draw() {
    if (this.dying) {
      push();
      translate(this.x, this.y);
      this.drawDeath();
      pop();
      return;
    }

    push();

    translate(this.x, this.y);

    // El sprite original debe mirar hacia arriba.
    // La rotación lo orienta según el movimiento.
    rotate(this.angle);

    // Parpadea mientras es invulnerable.
    const blink = this.invulnerable > 0 &&
      floor(millis() / 90) % 2 === 0;

    this.drawSprite(blink ? 110 : 255);

    pop();

    this.drawGrab();
  }

  // Dibuja el taxi centrado en (0, 0) con la transparencia dada.
  drawSprite(alpha) {
    imageMode(CENTER);
    rectMode(CENTER);

    // Evita el suavizado de las imágenes pixel art.
    drawingContext.imageSmoothingEnabled = false;

    if (spriteReady(this.img)) {
      tint(255, alpha);
      image(this.img, 0, 0, this.width, this.height);

      // Evita que el tint afecte otros dibujos.
      noTint();
      return;
    }

    // Respaldo si no se encuentra la imagen.
    const body = color(this.fallbackColor);
    body.setAlpha(alpha);

    noStroke();
    fill(body);
    rect(0, 0, this.width, this.height, 6);

    // Parabrisas y luz del techo para distinguir el frente.
    fill(30, alpha);
    rect(0, -this.height * 0.15, this.width * 0.7, this.height * 0.2, 3);
    fill(255, alpha);
    rect(0, this.height * 0.1, this.width * 0.3, this.height * 0.1, 2);
  }

  // Barra de agarre sobre el taxi (solo si alguien lo tiene sujeto).
  drawGrab() {
    if (this.grab <= 0.02) {
      return;
    }

    const w = 40;
    const h = 6;
    const y = this.y - this.height / 2 - 10;
    const f = constrain(this.grab, 0, 1);

    push();

    rectMode(CORNER);
    noStroke();
    fill(0, 0, 0, 170);
    rect(this.x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4, 3);

    fill(lerpColor(color("#fdd835"), color("#e53935"), f));
    rect(this.x - w / 2, y - h / 2, w * f, h, 2);

    pop();
  }

  // Animación de muerte: el taxi da vueltas mientras se desvanece,
  // con ondas rojas si lo abordaron o un destello si lo atropelló un bus.
  drawDeath() {
    const k = 1 - max(0, this.deathTimer) / Player.DEATH_TIME;

    if (this.deathCause === "bus") {
      noStroke();
      fill(255, 255, 255, 220 * (1 - k));
      circle(0, 0, this.width * (1 + 2 * k));
    } else {
      noFill();
      stroke(229, 57, 53, 255 * (1 - k));
      strokeWeight(3);

      circle(0, 0, this.width * (1 + 1.5 * k));
      circle(0, 0, this.width * (0.5 + k));
    }

    rotate(this.angle + k * TWO_PI * 2);
    scale(1 - 0.4 * k);

    noStroke();
    this.drawSprite(255 * (1 - k * k));
  }
}


// Taxi: el taxista, que usa una imagen PNG.

class Taxi extends Player {
  static img = undefined;

  static preload() {
    Taxi.img = loadSprite("img/player/taxi.png");
  }

  // Dibuja un taxi pequeño (para las vidas y las pantallas).
  static drawIcon(x, y, height, angle = 0) {
    const aspect = spriteReady(Taxi.img)
      ? Taxi.img.width / Taxi.img.height
      : 10 / 16;

    push();

    translate(x, y);
    rotate(angle);
    imageMode(CENTER);
    rectMode(CENTER);
    drawingContext.imageSmoothingEnabled = false;

    if (spriteReady(Taxi.img)) {
      image(Taxi.img, 0, 0, height * aspect, height);
    } else {
      noStroke();
      fill("#f9d71c");
      rect(0, 0, height * aspect, height, height * 0.15);
      fill(30);
      rect(0, -height * 0.15, height * aspect * 0.7, height * 0.2);
    }

    pop();
  }

  constructor(x, y, lifes) {
    // El sprite mide 10 x 16 píxeles de arte; si la imagen ya está
    // cargada se respeta su proporción.
    const height = 16 * Game.PIXEL;

    const aspectRatio =
      spriteReady(Taxi.img) && Taxi.img.height > 0
        ? Taxi.img.width / Taxi.img.height
        : 10 / 16;

    super(x, y, height * aspectRatio, height, lifes);

    this.img = Taxi.img;
    this.fallbackColor = "#f9d71c";
  }
}


// Crea el jugador a partir de la configuración del nivel.
// x e y son fracciones del área de juego (0.5 es el centro).

function createPlayer(playerConfig = {}, lifes = 3) {
  const a = Game.ARENA;

  const x = lerp(a.left, a.right, playerConfig.x ?? 0.5);
  const y = lerp(a.top, a.bottom, playerConfig.y ?? 0.5);

  return new Taxi(x, y, lifes);
}
