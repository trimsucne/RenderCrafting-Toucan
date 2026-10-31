// Gente: la multitud que sale del Rock al Parque y persigue al taxi.
// Cada persona es un cuerpo físico (matter.js) que se empuja con las
// demás, con los obstáculos y con el taxi. Pesan distinto: a un
// metalero casi no lo mueve un pitazo, a un fan sí.
//
// Imágenes (todas miran hacia arriba, el tamaño es en píxeles de arte):
//   img/crowd/rockero_a.png, rockero_b.png, rockero_c.png   (8 x 8)
//   img/crowd/fan_a.png, fan_b.png                          (8 x 8)
//   img/crowd/metalero_a.png, metalero_b.png                (10 x 10)
//
// Desde yo_por_alla_no_voy.js:
//   game.crowd = createCrowd(level.crowd);
//
// El nivel decide cuánta gente hay, cada cuánto llegan oleadas y de
// qué tipo es. Este archivo solamente convierte esa configuración
// en objetos del juego.


// Person (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Person {
  // Cuánto se frena por paso quien está aturdido (sin dirigirse).
  static DRAG = 0.97;

  // Aturdimientos más cortos que esto (segundos) se ignoran.
  static MIN_DAZE = 0.2;

  static preload() {
    // Las imágenes las cargan las clases hijas.
  }

  // config: datos propios del tipo (ver las clases hijas).
  // images: lista de variantes del sprite.
  constructor(x, y, config, speedFactor, images) {
    this.kind = config.kind;
    this.radius = config.radius;

    // Tamaño del dibujo (en pantalla).
    this.size = config.size * Game.PIXEL;

    // Velocidad deseada en píxeles por paso y agilidad para alcanzarla.
    this.maxSpeed = config.speed * speedFactor / 60;
    this.gain = config.gain;

    // Cuánto resiste ser aturdido (1 normal, más es más difícil)
    // y qué tan rápido llena la barra de agarre del taxi.
    this.resist = config.resist;
    this.grabRate = config.grab;

    this.images = images;
    this.variant = floor(random(max(1, images.length)));
    this.fallbackColor = config.color;

    // Cuerpo físico. La velocidad la decide steer(), no la fricción
    // del aire; la masa sale de la densidad y el tamaño.
    this.body = Bodies.circle(x, y, this.radius, {
      density: config.density,
      friction: 0.02,
      frictionStatic: 0,
      frictionAir: 0,
      restitution: 0.15
    });
    this.body.owner = this;
    game.physics.add(this.body);

    // Estado: "chasing" persigue, "dazed" está aturdido y no se dirige.
    this.state = "chasing";
    this.dazeTimer = 0;

    // Orientación: 0 significa que mira hacia arriba.
    this.angle = random(TWO_PI);
    this.spin = random([-1, 1]) * random(8, 14);

    // Zigzag para que la gente no se alinee perfecta.
    this.phase = random(TWO_PI);

    // Para rodear obstáculos cuando se queda atascada.
    this.stuck = 0;
    this.slide = 0;
    this.slideSide = 1;

    // Para dar puntos una sola vez cuando se lo lleva un bus.
    this.hitByBus = false;
  }

  get x() {
    return this.body.position.x;
  }

  get y() {
    return this.body.position.y;
  }

  // Punto al que apunta. Las hijas pueden sobreescribirlo
  // (por ejemplo para anticiparse a hacia dónde va el taxi).
  aim(taxi) {
    return { x: taxi.x, y: taxi.y };
  }

  // Gravedad: aceleración (píxeles por paso) con la que el taxi atrae
  // a esta persona. Es igual para livianos y pesados (como la gravedad
  // real): lo que cambia es cuánto cuesta moverlos al chocar.
  pull(taxi) {
    if (taxi.isDying()) {
      return { x: 0, y: 0 };
    }
  
    return PhysicsWorld.pull(
      taxi.x - this.x,
      taxi.y - this.y,
      taxi.body.mass
    );
  }
  
  // Se llama antes de cada paso físico: decide la velocidad.
  steer(taxi) {
    const v = this.body.velocity;
    const pull = this.pull(taxi);
  
    // Aturdido: no se dirige, solo se va frenando. La gravedad lo
    // sigue jalando, así que quien sale despedido vuelve curvando.
    if (this.state === "dazed") {
      Body.setVelocity(this.body, {
        x: v.x * Person.DRAG + pull.x,
        y: v.y * Person.DRAG + pull.y
      });
      return;
    }

    const aim = this.aim(taxi);

    let angle = atan2(aim.y - this.y, aim.x - this.x);

    this.phase += 0.05;
    angle += 0.3 * sin(this.phase);

    // Si estaba atascada contra un obstáculo, se va hacia un lado.
    if (this.slide > 0) {
      angle += this.slideSide * 1.2;
      this.slide -= PhysicsWorld.STEP / 1000;
    }

    const wantedX = cos(angle) * this.maxSpeed;
    const wantedY = sin(angle) * this.maxSpeed;

    // Persiguiendo, la gravedad se suma: cerca del taxi corren un
    // poco más rápido.
    Body.setVelocity(this.body, {
      x: v.x + (wantedX - v.x) * this.gain + pull.x,
      y: v.y + (wantedY - v.y) * this.gain + pull.y
    });
  }

  update(dt, taxi) {
    const v = this.body.velocity;
    const speed = Math.hypot(v.x, v.y);

    if (this.state === "dazed") {
      this.dazeTimer -= dt;

      // Aturdido da vueltas.
      this.angle += this.spin * dt;

      if (this.dazeTimer <= 0) {
        this.state = "chasing";
      }
    } else {
      // Mira hacia donde se mueve.
      if (speed > 0.3) {
        this.angle = lerpAngle(
          this.angle,
          atan2(v.y, v.x) + HALF_PI,
          min(1, 10 * dt)
        );
      }

      // Un golpe fuerte lo deja aturdido aunque nadie lo haya
      // aturdido a propósito (por ejemplo, rebotando en una pared).
      if (speed > this.maxSpeed * 1.8) {
        this.daze(0.5);
      }

      this.checkStuck(dt, speed, taxi);
    }

    this.keepInside();
  }

  // Si va lento estando lejos del taxi, algo lo está bloqueando:
  // después de un rato prueba a rodearlo por un lado.
  checkStuck(dt, speed, taxi) {
    const far = dist(this.x, this.y, taxi.x, taxi.y) > 60;

    if (far && speed < this.maxSpeed * 0.3) {
      this.stuck += dt;

      if (this.stuck > 0.5) {
        this.stuck = 0;
        this.slide = 0.9;
        this.slideSide = random([-1, 1]);
      }
    } else {
      this.stuck = max(0, this.stuck - dt);
    }
  }

  // Seguridad: si por algún motivo sale del área, se devuelve.
  keepInside() {
    const a = Game.ARENA;
    const r = this.radius;

    if (this.x > a.left - 20 && this.x < a.right + 20 &&
        this.y > a.top - 20 && this.y < a.bottom + 20) {
      return;
    }

    Body.setPosition(this.body, {
      x: constrain(this.x, a.left + r, a.right - r),
      y: constrain(this.y, a.top + r, a.bottom - r)
    });
    Body.setVelocity(this.body, { x: 0, y: 0 });
  }

  // Lo deja aturdido 'time' segundos (los más duros de roer lo resisten).
  // Devuelve true solo si estaba persiguiendo y quedó aturdido ahora.
  daze(time) {
    if (this.state === "dazed") {
      this.dazeTimer = max(this.dazeTimer, time);
      return false;
    }

    if (time < Person.MIN_DAZE) {
      return false;
    }

    this.state = "dazed";
    this.dazeTimer = time;
    return true;
  }

  draw() {
    const dazed = this.state === "dazed";
    const img = this.images[this.variant];

    push();

    translate(this.x, this.y);
    rotate(this.angle);

    imageMode(CENTER);
    rectMode(CENTER);

    // Evita el suavizado de las imágenes pixel art.
    drawingContext.imageSmoothingEnabled = false;

    if (spriteReady(img)) {
      if (dazed) {
        tint(255, 150);
      }

      image(
        img,
        0,
        0,
        this.size,
        this.size * img.height / img.width
      );

      // Evita que el tint afecte otros dibujos.
      noTint();
    } else {
      // Respaldo si no se encuentra la imagen: un círculo con una
      // marca al frente.
      noStroke();
      fill(
        dazed
          ? lerpColor(color(this.fallbackColor), color(255), 0.55)
          : color(this.fallbackColor)
      );
      circle(0, 0, this.radius * 2);

      fill(255);
      circle(0, -this.radius * 0.55, this.radius * 0.5);
    }

    pop();

    if (dazed) {
      this.drawDazed();
    }
  }

  // Estrellitas girando sobre la cabeza de quien está aturdido.
  drawDazed() {
    push();

    noStroke();
    fill("#fff176");

    for (let i = 0; i < 3; i++) {
      const a = millis() / 150 + i * TWO_PI / 3;

      circle(
        this.x + cos(a) * this.radius * 0.8,
        this.y - this.radius - 3 + sin(a) * 3,
        3
      );
    }

    pop();
  }
}


// Implementaciones hijas


// Rockero: el asistente promedio.
class Rockero extends Person {
  static images = [];

  static preload() {
    Rockero.images = [
      loadSprite("img/crowd/rockero_a.png"),
      loadSprite("img/crowd/rockero_b.png"),
      loadSprite("img/crowd/rockero_c.png")
    ];
  }

  constructor(x, y, speedFactor = 1) {
    super(x, y, {
      kind: "rockero",
      radius: 10,
      size: 8,
      density: 0.0011,
      speed: 105,
      gain: 0.12,
      resist: 1,
      grab: 1,
      color: "#c62828"
    }, speedFactor, Rockero.images);
  }
}


// Fan: rápido y liviano. Se anticipa a hacia dónde va el taxi,
// pero cualquier empujón lo manda lejos.
class Fan extends Person {
  static images = [];

  static preload() {
    Fan.images = [
      loadSprite("img/crowd/fan_a.png"),
      loadSprite("img/crowd/fan_b.png")
    ];
  }

  constructor(x, y, speedFactor = 1) {
    super(x, y, {
      kind: "fan",
      radius: 9,
      size: 8,
      density: 0.0009,
      speed: 165,
      gain: 0.18,
      resist: 0.7,
      grab: 0.8,
      color: "#8e24aa"
    }, speedFactor, Fan.images);
  }

  // Apunta a donde estará el taxi, no a donde está ahora.
  aim(taxi) {
    const d = dist(this.x, this.y, taxi.x, taxi.y);

    // Segundos de anticipación (máximo 0.8).
    const t = constrain(d / (this.maxSpeed * 60), 0, 0.8);

    // La velocidad del cuerpo está en píxeles por paso.
    const v = taxi.body.velocity;

    return {
      x: taxi.x + v.x * 60 * t,
      y: taxi.y + v.y * 60 * t
    };
  }
}


// Metalero: grande, lento y pesado. Casi no se deja empujar
// y agarra al taxi con más fuerza.
class Metalero extends Person {
  static images = [];

  static preload() {
    Metalero.images = [
      loadSprite("img/crowd/metalero_a.png"),
      loadSprite("img/crowd/metalero_b.png")
    ];
  }

  constructor(x, y, speedFactor = 1) {
    super(x, y, {
      kind: "metalero",
      radius: 13,
      size: 10,
      density: 0.0035,
      speed: 70,
      gain: 0.07,
      resist: 3,
      grab: 1.6,
      color: "#263238"
    }, speedFactor, Metalero.images);
  }
}


// Crea una persona del tipo indicado.
function createPerson(kind, x, y, speedFactor) {
  if (kind === "fan") {
    return new Fan(x, y, speedFactor);
  }

  if (kind === "metalero") {
    return new Metalero(x, y, speedFactor);
  }

  return new Rockero(x, y, speedFactor);
}


// Crowd: toda la gente del nivel. Se encarga de que lleguen por los
// bordes del área (poco a poco y en oleadas avisadas), de dirigirla
// hacia el taxi y de empujarla cuando suena el pito.
class Crowd {
  // Distancia al borde donde aparece la gente (píxeles).
  static EDGE_INSET = 14;

  // Distancia mínima al taxi para que aparezca alguien suelto.
  static SAFE_DISTANCE = 220;

  // Separación entre personas al llegar en oleada.
  static SPACING = 26;

  // config: { speed, max, start, rate, firstWave, waveEvery,
  //           waveSize, warn, mix }
  constructor(config) {
    this.config = config;
    this.people = [];

    // Acumulador de la gente que llega poco a poco.
    this.trickle = 0;

    // Oleada: cuenta atrás y aviso (undefined si no hay aviso).
    this.waveTimer = config.firstWave;
    this.warning = undefined;

    // Gente que ya está esperando al empezar.
    for (let i = 0; i < config.start; i++) {
      this.spawn(this.randomEdgePoint(Crowd.SAFE_DISTANCE));
    }
  }

  // Punto del borde del área: lado 0 arriba, 1 derecha, 2 abajo,
  // 3 izquierda; t va de 0 a 1 a lo largo de ese lado.
  static edgePoint(side, t) {
    const a = Game.ARENA;
    const m = Crowd.EDGE_INSET;

    if (side === 0) {
      return { x: lerp(a.left + m, a.right - m, t), y: a.top + m };
    }

    if (side === 1) {
      return { x: a.right - m, y: lerp(a.top + m, a.bottom - m, t) };
    }

    if (side === 2) {
      return { x: lerp(a.left + m, a.right - m, t), y: a.bottom - m };
    }

    return { x: a.left + m, y: lerp(a.top + m, a.bottom - m, t) };
  }

  // Hacia dónde mira cada lado (hacia adentro del área).
  static inward(side) {
    return [
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 1, y: 0 }
    ][side];
  }

  // Largo (en píxeles) de un lado del área.
  static edgeLength(side) {
    const a = Game.ARENA;
    const m = Crowd.EDGE_INSET;

    return side % 2 === 0
      ? a.right - a.left - 2 * m
      : a.bottom - a.top - 2 * m;
  }

  // Punto aleatorio del borde que esté al menos a minDistance del taxi
  // (si no encuentra uno en varios intentos, usa el último).
  randomEdgePoint(minDistance = 0) {
    let point;

    for (let i = 0; i < 12; i++) {
      point = Crowd.edgePoint(floor(random(4)), random());

      if (dist(point.x, point.y, game.taxi.x, game.taxi.y) >= minDistance) {
        break;
      }
    }

    return point;
  }

  // Elige un tipo de persona según los pesos de la configuración.
  pickKind() {
    const mix = this.config.mix;

    let total = 0;
    for (const kind in mix) {
      total += mix[kind];
    }

    let pick = random(total);
    for (const kind in mix) {
      pick -= mix[kind];
      if (pick <= 0) {
        return kind;
      }
    }

    return "rockero";
  }

  // Crea una persona en 'point'. Las oleadas pueden pasar un poco el
  // máximo; la gente suelta no.
  spawn(point, isWave = false) {
    const limit = isWave ? this.config.max * 1.3 : this.config.max;

    if (this.people.length >= limit) {
      return undefined;
    }

    const person = createPerson(
      this.pickKind(),
      point.x,
      point.y,
      this.config.speed
    );

    this.people.push(person);
    return person;
  }

  update(dt) {
    for (const person of this.people) {
      person.update(dt, game.taxi);
    }

    // Gente que va llegando poco a poco.
    this.trickle += this.config.rate * dt;

    while (this.trickle >= 1) {
      this.trickle -= 1;
      this.spawn(this.randomEdgePoint(Crowd.SAFE_DISTANCE));
    }

    // Oleadas: primero un aviso en el borde por donde van a entrar.
    if (this.warning === undefined) {
      this.waveTimer -= dt;

      if (this.waveTimer <= 0) {
        this.warning = {
          side: floor(random(4)),
          t: random(0.2, 0.8),
          time: this.config.warn
        };
      }
    } else {
      this.warning.time -= dt;

      if (this.warning.time <= 0) {
        this.launchWave();
        this.warning = undefined;
        this.waveTimer = this.config.waveEvery;
      }
    }
  }

  // Se llama antes de cada paso físico: cada persona decide
  // cómo moverse.
  steer(taxi) {
    for (const person of this.people) {
      person.steer(taxi);
    }
  }
  
  // Gravedad: aceleración (píxeles por paso) con la que toda la gente
  // jala al taxi. Cada persona atrae según su masa, por eso un grupo
  // grande o un metalero pesan más. Se limita para que el jalón total
  // no gane al control del taxi.
  pullOn(taxi) {
    let x = 0;
    let y = 0;
  
    for (const person of this.people) {
      const f = PhysicsWorld.pull(
        person.x - taxi.x,
        person.y - taxi.y,
        person.body.mass
      );
  
      x += f.x;
      y += f.y;
    }
  
    const max = PhysicsWorld.GRAVITY_MAX * 0.7 / 3600;
    const length = Math.hypot(x, y);
  
    if (length > max) {
      x = x / length * max;
      y = y / length * max;
    }
  
    return { x: x, y: y };
  }
  
  // Gente en fila a lo largo del borde avisado, entrando con impulso.
  launchWave() {
    const { side, t } = this.warning;
    const n = this.config.waveSize;
    const inward = Crowd.inward(side);

    const length = Crowd.edgeLength(side);
    const center = t * length;

    for (let i = 0; i < n; i++) {
      // Reparte la gente a lo largo del borde (en dos filas si son
      // muchas) sin salirse de él.
      const offset = (i - (n - 1) / 2) * Crowd.SPACING * (n > 10 ? 0.5 : 1);
      const along = constrain(center + offset, 0, length);
      const row = n > 10 ? (i % 2) * Crowd.SPACING : 0;

      const point = Crowd.edgePoint(side, along / length);
      const person = this.spawn({
        x: point.x + inward.x * row,
        y: point.y + inward.y * row
      }, true);

      if (person !== undefined) {
        Body.setVelocity(person.body, {
          x: inward.x * 2.5,
          y: inward.y * 2.5
        });
      }
    }
  }

  // Empuja y aturde a la gente que esté a menos de 'radius' de
  // (x, y). 'impulse' es el empujón en el centro: la velocidad que
  // gana cada uno es el empujón entre su masa, por eso a los pesados
  // casi no los mueve. Devuelve cuántos quedaron aturdidos.
  blast(x, y, radius, impulse, scoring = true) {
    let hit = 0;

    for (const person of this.people) {
      const dx = person.x - x;
      const dy = person.y - y;
      const d = Math.hypot(dx, dy);

      if (d > radius) {
        continue;
      }

      // 1 en el centro, 0 en el borde.
      const k = 1 - d / radius;

      // Si está justo encima, sale hacia un lado cualquiera.
      const angle = d > 0.001 ? atan2(dy, dx) : random(TWO_PI);
      const dv = impulse * (0.4 + 0.6 * k) / person.body.mass;
      const v = person.body.velocity;

      Body.setVelocity(person.body, {
        x: v.x + cos(angle) * dv,
        y: v.y + sin(angle) * dv
      });

      if (person.daze((0.5 + k) / person.resist)) {
        hit++;

        if (scoring) {
          addScore(POINTS.HORN);
        }
      }
    }

    return hit;
  }

  // Rectángulo (centro, ancho, alto) de la zona avisada para
  // la próxima oleada.
  warningRect() {
    const a = Game.ARENA;
    const { side, t } = this.warning;
    const thickness = 40;

    const length = this.config.waveSize * Crowd.SPACING * 0.6 + 60;
    const center = Crowd.edgePoint(side, t);

    if (side % 2 === 0) {
      return {
        x: center.x,
        y: side === 0 ? a.top + thickness / 2 : a.bottom - thickness / 2,
        w: length,
        h: thickness
      };
    }

    return {
      x: side === 1 ? a.right - thickness / 2 : a.left + thickness / 2,
      y: center.y,
      w: thickness,
      h: length
    };
  }

  // Aviso de oleada: zona roja parpadeante en el borde por donde
  // va a entrar la gente.
  drawWarnings() {
    if (this.warning === undefined) {
      return;
    }

    const r = this.warningRect();
    const blink = floor(millis() / 120) % 2 === 0;

    push();

    rectMode(CENTER);
    noStroke();
    fill(229, 57, 53, blink ? 150 : 70);
    rect(r.x, r.y, r.w, r.h);

    textFont("monospace");
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    textSize(26);
    fill(255, 255, 255, blink ? 255 : 160);
    text("!", r.x, r.y + 1);

    pop();
  }

  draw() {
    for (const person of this.people) {
      person.draw();
    }
  }

  count() {
    return this.people.length;
  }
}


// Crea la multitud a partir de la configuración guardada en el nivel.
function createCrowd(crowdConfig) {
  return new Crowd(crowdConfig);
}
