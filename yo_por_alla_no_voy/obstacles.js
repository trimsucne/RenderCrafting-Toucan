// Obstáculos: elementos del escenario contra los que chocan la gente y
// el taxi (vallas, carpas, parlantes) y los buses que cruzan el área
// como peligro móvil.
//
// Imágenes (el tamaño es en píxeles de arte):
//   img/obstacles/barrier.png   (30 x 8)
//   img/obstacles/stall.png     (20 x 20)
//   img/obstacles/speaker.png   (12 x 12)
//   img/obstacles/bus.png       (14 x 40, mira hacia arriba)
//
// Desde yo_por_alla_no_voy.js:
//   game.obstacles = createObstacles(level.obstacles);
//   game.traffic = createTraffic(level.traffic);
//
// El nivel contiene la configuración y estas funciones crean las
// instancias que luego serán actualizadas y dibujadas por Game.
// Las vallas, carpas y parlantes son cuerpos estáticos: no se mueven,
// pero la gente se amontona contra ellos (y se puede aprovechar).


// Obstacle (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Obstacle {
  // Tamaño de cada tipo en píxeles de arte (ancho, alto).
  static SIZES = {
    barrier: { w: 30, h: 8 },
    stall: { w: 20, h: 20 },
    speaker: { w: 12, h: 12 }
  };

  static preload() {
    // Las imágenes las cargan las clases hijas.
  }

  // Radio aproximado de un tipo en pantalla (para repartirlos
  // sin que se superpongan).
  static radiusOf(type) {
    const size = Obstacle.SIZES[type];

    return dist(0, 0, size.w, size.h) * Game.PIXEL / 2;
  }

  // 'body' es opcional: si no se pasa, se crea un cuerpo estático
  // rectangular del tamaño del dibujo.
  constructor(x, y, width, height, angle = 0, body = undefined) {
    this.width = width;
    this.height = height;
    this.angle = angle;

    // Ángulo con el que se dibuja el sprite (puede diferir del
    // ángulo del cuerpo, como en los buses).
    this.drawAngle = angle;

    // Imagen del obstáculo.
    this.img = undefined;

    // La hitbox es menor que el dibujo para evitar
    // choques visualmente injustos.
    this.hitbox = 0.9;

    // Opcionales (pueden añadir más que utilicen internamente)
    // en las hijas.
    this.tint = undefined;
    this.round = false;
    this.fallbackColor = color(200, 0, 200);

    this.body = body !== undefined
      ? body
      : Bodies.rectangle(
          x,
          y,
          width * this.hitbox,
          height * this.hitbox,
          { isStatic: true, angle: angle, friction: 0, restitution: 0.3 }
        );

    this.body.owner = this;
    game.physics.add(this.body);
  }

  get x() {
    return this.body.position.x;
  }

  get y() {
    return this.body.position.y;
  }

  update() {
    // Los obstáculos estáticos no necesitan actualizarse.
  }

  draw() {
    push();

    translate(this.x, this.y);
    rotate(this.drawAngle);

    imageMode(CENTER);
    rectMode(CENTER);

    // Sin suavizado para que el pixelart se vea nítido.
    drawingContext.imageSmoothingEnabled = false;

    if (this.tint !== undefined) {
      tint(this.tint);
    }

    if (spriteReady(this.img)) {
      image(this.img, 0, 0, this.width, this.height);
    } else {
      // Respaldo si no se encuentra la imagen.
      stroke(0, 90);
      strokeWeight(2);
      fill(this.fallbackColor);

      if (this.round) {
        circle(0, 0, this.width);
      } else {
        rect(0, 0, this.width, this.height, 3);
      }
    }

    pop();
  }
}


// Implementaciones hijas


// Valla de contención: larga y delgada.
class Barrier extends Obstacle {
  static img = undefined;

  static preload() {
    Barrier.img = loadSprite("img/obstacles/barrier.png");
  }

  constructor(x, y, angle = 0) {
    const size = Obstacle.SIZES.barrier;

    super(x, y, size.w * Game.PIXEL, size.h * Game.PIXEL, angle);

    this.img = Barrier.img;
    this.fallbackColor = "#ff7043";
  }
}


// Carpa de comida: cuadrada y grande.
class Stall extends Obstacle {
  static img = undefined;

  static preload() {
    Stall.img = loadSprite("img/obstacles/stall.png");
  }

  constructor(x, y) {
    const size = Obstacle.SIZES.stall;

    super(x, y, size.w * Game.PIXEL, size.h * Game.PIXEL);

    this.img = Stall.img;
    this.fallbackColor = "#ffca28";
  }
}


// Parlante: redondo, como un poste ancho.
class Speaker extends Obstacle {
  static img = undefined;

  static preload() {
    Speaker.img = loadSprite("img/obstacles/speaker.png");
  }

  constructor(x, y) {
    const size = Obstacle.SIZES.speaker;
    const width = size.w * Game.PIXEL;

    // Cuerpo circular (un poco menor que el dibujo).
    const body = Bodies.circle(x, y, width / 2 * 0.9, {
      isStatic: true,
      friction: 0,
      restitution: 0.3
    });

    super(x, y, width, size.h * Game.PIXEL, 0, body);

    this.img = Speaker.img;
    this.round = true;
    this.fallbackColor = "#546e7a";
  }
}


// Bus (tipo Transmilenio): cruza el área en línea recta y se lleva
// por delante a quien toque. A la gente la lanza hacia un lado y al
// taxi le quita una vida. Es un sensor: no empuja nada por sí mismo,
// manager.js decide qué pasa con cada cosa que toca.
class Bus extends Obstacle {
  static img = undefined;

  // Tamaño en píxeles de arte (largo y ancho).
  static LENGTH = 40;
  static WIDTH = 14;

  static preload() {
    Bus.img = loadSprite("img/obstacles/bus.png");
  }

  // direction: vector unitario (por ejemplo { x: 1, y: 0 }),
  // speed: píxeles por segundo.
  constructor(x, y, direction, speed) {
    const length = Bus.LENGTH * Game.PIXEL;
    const width = Bus.WIDTH * Game.PIXEL;
    const horizontal = direction.x !== 0;

    // El cuerpo no gira: se intercambian ancho y alto según el eje.
    const body = Bodies.rectangle(
      x,
      y,
      (horizontal ? length : width) * 0.95,
      (horizontal ? width : length) * 0.95,
      { isSensor: true, frictionAir: 0 }
    );

    super(x, y, width, length, 0, body);

    this.img = Bus.img;
    this.fallbackColor = "#d32f2f";

    this.horizontal = horizontal;
    this.direction = direction;

    // Velocidad en píxeles por paso.
    this.velocity = {
      x: direction.x * speed / 60,
      y: direction.y * speed / 60
    };

    // El sprite original mira hacia arriba.
    this.drawAngle = atan2(direction.y, direction.x) + HALF_PI;
  }

  // Se llama antes de cada paso físico: mantiene la velocidad.
  drive() {
    Body.setVelocity(this.body, this.velocity);
  }

  // ¿Ya cruzó todo el área y salió por el otro lado?
  isGone() {
    const a = Game.ARENA;
    const margin = Bus.LENGTH * Game.PIXEL / 2 + 40;

    return (this.direction.x > 0 && this.x > a.right + margin) ||
      (this.direction.x < 0 && this.x < a.left - margin) ||
      (this.direction.y > 0 && this.y > a.bottom + margin) ||
      (this.direction.y < 0 && this.y < a.top - margin);
  }
}


// Traffic: los buses del nivel. Cada cierto tiempo avisa por qué
// carril va a pasar uno (el que está donde está el taxi) y, cuando
// termina el aviso, lo lanza.
class Traffic {
  // config: { enabled, first, every, warn, speed }
  constructor(config) {
    this.config = config;

    this.timer = config.first;
    this.warnings = [];
    this.buses = [];
  }

  update(dt) {
    if (this.config.enabled) {
      this.timer -= dt;

      if (this.timer <= 0) {
        this.schedule();
        this.timer = this.config.every;
      }
    }

    // Cuando termina un aviso sale el bus.
    for (const warning of this.warnings) {
      warning.time -= dt;
    }

    for (const warning of this.warnings.filter((w) => w.time <= 0)) {
      this.launch(warning);
    }

    this.warnings = this.warnings.filter((w) => w.time > 0);

    // Se retiran los buses que ya salieron del área.
    for (const bus of this.buses.filter((b) => b.isGone())) {
      game.physics.remove(bus.body);
    }

    this.buses = this.buses.filter((b) => !b.isGone());
  }

  // Elige un carril (horizontal o vertical) cerca del taxi.
  schedule() {
    const a = Game.ARENA;
    const taxi = game.taxi;
    const horizontal = random() < 0.5;
    const dir = random([-1, 1]);
    const half = Bus.WIDTH * Game.PIXEL / 2;

    const lane = horizontal
      ? constrain(taxi.y + random(-60, 60), a.top + half, a.bottom - half)
      : constrain(taxi.x + random(-60, 60), a.left + half, a.right - half);

    this.warnings.push({
      horizontal: horizontal,
      dir: dir,
      lane: lane,
      time: this.config.warn,
      total: this.config.warn
    });
  }

  // Crea el bus fuera del área, listo para cruzarla.
  launch(warning) {
    const a = Game.ARENA;
    const half = Bus.LENGTH * Game.PIXEL / 2 + 30;

    let x;
    let y;
    let direction;

    if (warning.horizontal) {
      x = warning.dir > 0 ? a.left - half : a.right + half;
      y = warning.lane;
      direction = { x: warning.dir, y: 0 };
    } else {
      x = warning.lane;
      y = warning.dir > 0 ? a.top - half : a.bottom + half;
      direction = { x: 0, y: warning.dir };
    }

    this.buses.push(new Bus(x, y, direction, this.config.speed));
  }

  // Se llama antes de cada paso físico.
  drive() {
    for (const bus of this.buses) {
      bus.drive();
    }
  }

  // Avisos: franja roja sobre el carril con flechas que se mueven
  // en el sentido en que va a pasar el bus.
  drawWarnings() {
    const a = Game.ARENA;
    const width = Bus.WIDTH * Game.PIXEL;

    for (const w of this.warnings) {
      const k = 1 - w.time / w.total;
      const pulse = 90 + 70 * sin(millis() / 60);

      push();

      noStroke();
      fill(229, 57, 53, pulse * (0.4 + 0.6 * k));

      if (w.horizontal) {
        rectMode(CORNER);
        rect(a.left, w.lane - width / 2, a.right - a.left, width);
      } else {
        rectMode(CORNER);
        rect(w.lane - width / 2, a.top, width, a.bottom - a.top);
      }

      // Flechas que avanzan en el sentido del bus.
      fill(255, 255, 255, 170);
      const shift = (millis() / 6) % 60;

      if (w.horizontal) {
        for (let x = a.left - 60; x < a.right + 60; x += 60) {
          const px = x + (w.dir > 0 ? shift : -shift);
          const s = width * 0.25;

          triangle(
            px + w.dir * s, w.lane,
            px - w.dir * s, w.lane - s,
            px - w.dir * s, w.lane + s
          );
        }
      } else {
        for (let y = a.top - 60; y < a.bottom + 60; y += 60) {
          const py = y + (w.dir > 0 ? shift : -shift);
          const s = width * 0.25;

          triangle(
            w.lane, py + w.dir * s,
            w.lane - s, py - w.dir * s,
            w.lane + s, py - w.dir * s
          );
        }
      }

      pop();
    }
  }

  draw() {
    for (const bus of this.buses) {
      bus.draw();
    }
  }
}


// Crea los obstáculos estáticos a partir de la configuración guardada
// en un nivel.
//
// El nivel decide qué obstáculos existen, dónde están y cómo están
// girados. Este archivo solamente convierte esa configuración en
// objetos del juego.
function createObstacles(obstacleConfig) {
  const result = [];

  for (const cfg of obstacleConfig) {
    if (cfg.type === "barrier") {
      result.push(new Barrier(cfg.x, cfg.y, cfg.angle));
    } else if (cfg.type === "stall") {
      result.push(new Stall(cfg.x, cfg.y));
    } else if (cfg.type === "speaker") {
      result.push(new Speaker(cfg.x, cfg.y));
    }
  }

  return result;
}


// Crea los buses del nivel a partir de su configuración.
function createTraffic(trafficConfig) {
  return new Traffic(trafficConfig);
}
