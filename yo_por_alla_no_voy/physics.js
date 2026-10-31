// Física: envoltura mínima de matter.js. Crea el motor, las paredes del
// área de juego y avanza la simulación con pasos de tiempo fijos.
//
// Desde yo_por_alla_no_voy.js:
//   game.physics = new PhysicsWorld(Game.ARENA);
//   game.physics.update(dt, antes, despues);   // cada frame, dt en ms
//
// Cada cuerpo de matter.js guarda en body.owner el objeto del juego
// al que pertenece (taxi, persona, bus...). Así las colisiones se
// interpretan en manager.js sin tener que buscar nada.
//
// Gravedad: matter.js solo sabe de una gravedad con dirección fija
// (hacia abajo). En su lugar hay una gravedad de atracción entre
// cuerpos (PhysicsWorld.pull()): el taxi atrae a la gente y la gente,
// con su masa, atrae al taxi. Mientras más cerca y más pesado, más jala.
//
// Unidades: matter.js trabaja en píxeles por paso (1 paso = 1/60 s),
// así que una velocidad de 3 equivale a 180 píxeles por segundo.
// Las clases del juego dan sus velocidades en píxeles por segundo y
// las convierten dividiendo entre 60.


// Alias de matter.js (los usan también las demás clases).
const { Engine, Bodies, Body, Composite, Events } = Matter;


class PhysicsWorld {
  // Duración de un paso fijo (ms) y máximo de pasos por frame.
  // Con pasos fijos la simulación se comporta igual a cualquier FPS.
  static STEP = 1000 / 60;
  static MAX_STEPS = 4;

  // Velocidad máxima de cualquier cuerpo (píxeles por paso). Evita que
  // alguien lanzado por un impacto atraviese una pared.
  static MAX_SPEED = 20;

  // Grosor de las paredes, grande a propósito para que nada las cruce.
  static WALL = 200;
  
  // Gravedad de atracción: la aceleración (píxeles por segundo al
  // cuadrado) que produce un cuerpo de masa m a distancia d es
  // GRAVITY * m / (d² + SOFT²). SOFT suaviza el cálculo para que no se
  // dispare al estar encima y MAX limita la aceleración de cada atracción.
  static GRAVITY = 900000;
  static GRAVITY_SOFT = 40;
  static GRAVITY_MAX = 500;
  
  // Aceleración (en píxeles por paso, lista para sumarla a la
  // velocidad) que produce, sobre un cuerpo, otro cuerpo de masa 'mass'
  // que está a (dx, dy) de distancia. Apunta hacia el otro cuerpo.
  static pull(dx, dy, mass) {
    const soft = PhysicsWorld.GRAVITY_SOFT;
    const d = Math.sqrt(dx * dx + dy * dy + soft * soft);
  
    const a = min(
      PhysicsWorld.GRAVITY * mass / (d * d),
      PhysicsWorld.GRAVITY_MAX
    );
  
    // De píxeles por segundo² a píxeles por paso (dividir dos veces
    // entre 60) y repartida según la dirección.
    return {
      x: dx / d * a / 3600,
      y: dy / d * a / 3600
    };
  }

  constructor(arena) {
    this.engine = Engine.create();

    // Vista desde arriba: no hay gravedad.
    this.engine.gravity.x = 0;
    this.engine.gravity.y = 0;

    // Más iteraciones para que la multitud apretada no se encime.
    this.engine.positionIterations = 8;
    this.engine.velocityIterations = 6;

    this.world = this.engine.world;
    this.accumulator = 0;

    // Funciones (a, b, pair) que se llaman al empezar un contacto
    // y mientras continúa. 'a' y 'b' son los owner de cada cuerpo
    // (undefined si es una pared).
    this.onStart = undefined;
    this.onActive = undefined;

    Events.on(this.engine, "collisionStart", (event) => {
      this.dispatch(event, this.onStart);
    });

    Events.on(this.engine, "collisionActive", (event) => {
      this.dispatch(event, this.onActive);
    });

    this.createWalls(arena);
  }

  // Cuatro paredes por fuera del área de juego.
  createWalls(arena) {
    const t = PhysicsWorld.WALL;
    const w = arena.right - arena.left;
    const h = arena.bottom - arena.top;
    const cx = (arena.left + arena.right) / 2;
    const cy = (arena.top + arena.bottom) / 2;

    const options = {
      isStatic: true,
      friction: 0,
      restitution: 0.3
    };

    this.walls = [
      Bodies.rectangle(cx, arena.top - t / 2, w + 2 * t, t, options),
      Bodies.rectangle(cx, arena.bottom + t / 2, w + 2 * t, t, options),
      Bodies.rectangle(arena.left - t / 2, cy, t, h + 2 * t, options),
      Bodies.rectangle(arena.right + t / 2, cy, t, h + 2 * t, options)
    ];

    Composite.add(this.world, this.walls);
  }

  add(body) {
    Composite.add(this.world, body);
  }

  remove(body) {
    Composite.remove(this.world, body);
  }

  // Avanza la simulación 'dt' milisegundos. 'before' se llama antes
  // de cada paso (aquí cada objeto decide cómo moverse) y 'after'
  // después de cada paso.
  update(dt, before, after) {
    this.accumulator = min(
      this.accumulator + dt,
      PhysicsWorld.STEP * PhysicsWorld.MAX_STEPS
    );

    while (this.accumulator >= PhysicsWorld.STEP) {
      if (before !== undefined) {
        before();
      }

      Engine.update(this.engine, PhysicsWorld.STEP);
      this.limitSpeeds();

      if (after !== undefined) {
        after();
      }

      this.accumulator -= PhysicsWorld.STEP;
    }
  }

  // Frena a quien supere la velocidad máxima.
  limitSpeeds() {
    for (const body of Composite.allBodies(this.world)) {
      if (body.isStatic) {
        continue;
      }

      const speed = Math.hypot(body.velocity.x, body.velocity.y);

      if (speed > PhysicsWorld.MAX_SPEED) {
        const k = PhysicsWorld.MAX_SPEED / speed;

        Body.setVelocity(body, {
          x: body.velocity.x * k,
          y: body.velocity.y * k
        });
      }
    }
  }

  // Convierte los pares de una colisión en llamadas (a, b, pair).
  dispatch(event, callback) {
    if (callback === undefined) {
      return;
    }

    for (const pair of event.pairs) {
      callback(pair.bodyA.owner, pair.bodyB.owner, pair);
    }
  }
}
