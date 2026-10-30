// Background y UI: el escenario (el piso del parque y la valla que lo
// rodea), los elementos de interfaz (textos, vidas, tiempo, pito y
// pantallas completas) y los efectos (ondas y globos de texto).
//
// Desde yo_por_alla_no_voy.js:
//   game.landscape = createBackground(level.background);
//   game.ui = createUI(level.ui);
//
// Las texturas del escenario se cargan desde img/background/.
// Cada una tiene sprites para los temas day, sunset y night:
//   img/background/day_floor.png     (16 x 16 píxeles de arte)
//   img/background/day_fence.png     (16 x 6)
//   (y lo mismo con sunset_ y night_)


// Background (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Background {
  static preload() {
    // Los sonidos están en Game.preload().
  }

  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // A definir en las implementaciones
    this.img = undefined;

    // Opcionales (pueden añadir más que utilicen internamente)
    // en las hijas.
    this.tint = undefined;
    this.text = undefined;
  }

  update() {
    // Implementación general.
    // El escenario normalmente no necesita actualizarse,
    // pero si se hacen personas o algo así, podrían moverse.
  }

  draw() {
    push();

    imageMode(CENTER);
    drawingContext.imageSmoothingEnabled = false;

    if (this.tint !== undefined) {
      tint(this.tint);
    }

    if (spriteReady(this.img)) {
      image(this.img, this.x, this.y, this.width, this.height);
    }

    pop();
  }
}


// Implementaciones hijas: escenario


// Landscape: el piso del parque, la valla alrededor del área de juego
// y la franja oscura donde va el HUD.
//
// Las paletas sirven de respaldo cuando no están las imágenes y para
// los elementos de interfaz que utilizan sus colores.
class Landscape extends Background {
  // Lado de los sprites del piso y grosor de la valla
  // (en píxeles de arte).
  static TILE = 16;
  static FENCE = 6;

  static floorSprites = {};
  static fenceSprites = {};

  // Paletas de colores (el nivel elige cuál usar).
  static themes = {
    day: {
      name: "day",
      floor: "#6b9b4f",
      spots: ["#5c8a43", "#7fae60", "#8cbf6b"],
      fence: ["#8d6e63", "#5d4037"]
    },
    sunset: {
      name: "sunset",
      floor: "#7c8a46",
      spots: ["#6b7a3a", "#8d9b52", "#a3a95f"],
      fence: ["#a1887f", "#6d4c41"]
    },
    night: {
      name: "night",
      floor: "#27422f",
      spots: ["#1f3827", "#305239", "#3a6244"],
      fence: ["#607d8b", "#37474f"]
    }
  };

  static preload() {
    for (const theme of ["day", "sunset", "night"]) {
      Landscape.floorSprites[theme] = loadSprite(
        "img/background/" + theme + "_floor.png"
      );
      Landscape.fenceSprites[theme] = loadSprite(
        "img/background/" + theme + "_fence.png"
      );
    }
  }

  constructor(config = {}) {
    super(width / 2, height / 2, width, height);

    this.theme = Landscape.themes[config.theme] || Landscape.themes.day;

    this.floor = Landscape.floorSprites[this.theme.name];
    this.fence = Landscape.fenceSprites[this.theme.name];

    // Manchas de pasto para el piso de respaldo (fijas durante el nivel).
    this.spots = [];
    for (let i = 0; i < 140; i++) {
      this.spots.push({
        x: random(width),
        y: random(Game.HUD_HEIGHT, height),
        size: random(3, 9),
        color: random(this.theme.spots)
      });
    }
  }

  draw() {
    this.drawFloor();
    this.drawFence();

    // Franja oscura del HUD.
    push();
    rectMode(CORNER);
    noStroke();
    fill(0, 0, 0, 200);
    rect(0, 0, width, Game.HUD_HEIGHT);
    pop();
  }

  // Piso: se repite el sprite por todo el canvas (o un color liso con
  // manchas si no está la imagen).
  drawFloor() {
    push();

    imageMode(CORNER);
    rectMode(CORNER);
    drawingContext.imageSmoothingEnabled = false;

    if (spriteReady(this.floor)) {
      const tile = Landscape.TILE * Game.PIXEL;

      for (let y = Game.HUD_HEIGHT; y < height; y += tile) {
        for (let x = 0; x < width; x += tile) {
          image(this.floor, x, y, tile, tile);
        }
      }
    } else {
      noStroke();
      fill(this.theme.floor);
      rect(0, Game.HUD_HEIGHT, width, height - Game.HUD_HEIGHT);

      for (const spot of this.spots) {
        fill(spot.color);
        rect(spot.x, spot.y, spot.size, spot.size);
      }
    }

    pop();
  }

  // Valla alrededor del área de juego.
  drawFence() {
    const a = Game.ARENA;
    const f = Game.FENCE;
    const tile = Landscape.TILE * Game.PIXEL;

    push();

    imageMode(CORNER);
    rectMode(CORNER);
    drawingContext.imageSmoothingEnabled = false;

    if (spriteReady(this.fence)) {
      // Arriba y abajo, y a los lados con el sprite girado.
      this.drawFenceStrip(a.left - f, a.top - f, width, 0, tile);
      this.drawFenceStrip(a.right + f, a.bottom + f, width, PI, tile);
      this.drawFenceStrip(a.left - f, a.bottom + f, height, -HALF_PI, tile);
      this.drawFenceStrip(a.right + f, a.top - f, height, HALF_PI, tile);
    } else {
      noStroke();
      fill(this.theme.fence[1]);
      rect(a.left - f, a.top - f, a.right - a.left + 2 * f, f);
      rect(a.left - f, a.bottom, a.right - a.left + 2 * f, f);
      rect(a.left - f, a.top, f, a.bottom - a.top);
      rect(a.right, a.top, f, a.bottom - a.top);

      // Postes cada cierto tramo.
      fill(this.theme.fence[0]);
      for (let x = a.left - f; x < a.right + f; x += 24) {
        rect(x, a.top - f, 6, f);
        rect(x, a.bottom, 6, f);
      }
      for (let y = a.top; y < a.bottom; y += 24) {
        rect(a.left - f, y, f, 6);
        rect(a.right, y, f, 6);
      }
    }

    pop();
  }

  // Tira de valla que arranca en (x, y) y se repite 'length' píxeles
  // en el sentido que marca 'angle'.
  drawFenceStrip(x, y, length, angle, tile) {
    push();

    translate(x, y);
    rotate(angle);

    // Se recorta para que no se salga del canvas.
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(0, 0, length, Game.FENCE);
    drawingContext.clip();

    for (let s = 0; s < length; s += tile) {
      image(this.fence, s, 0, tile, Game.FENCE);
    }

    drawingContext.restore();

    pop();
  }
}


// Crea el escenario a partir de la configuración guardada en el nivel.
function createBackground(backgroundConfig) {
  return new Landscape(backgroundConfig);
}


// Implementaciones hijas: efectos


// Efecto pasajero: vive 'life' segundos y luego se retira.
class Effect extends Background {
  constructor(life) {
    super(0, 0, 0, 0);

    this.life = life;
    this.age = 0;
  }

  update() {
    this.age += min(deltaTime, 50) / 1000;
  }

  // Avance del efecto de 0 a 1.
  progress() {
    return constrain(this.age / this.life, 0, 1);
  }

  done() {
    return this.age >= this.life;
  }
}


// Onda expansiva: un anillo que crece y se desvanece
// (el pito, el reaparecer, un choque).
class Shockwave extends Effect {
  constructor(x, y, radius, shade = "#ffffff") {
    super(0.45);

    this.x = x;
    this.y = y;
    this.radius = radius;
    this.shade = shade;
  }

  draw() {
    const k = this.progress();
    const grow = 1 - (1 - k) * (1 - k);

    push();

    noFill();

    const c = color(this.shade);

    c.setAlpha(220 * (1 - k));
    stroke(c);
    strokeWeight(1 + 4 * (1 - k));
    circle(this.x, this.y, 2 * this.radius * grow);

    c.setAlpha(90 * (1 - k));
    stroke(c);
    strokeWeight(1);
    circle(this.x, this.y, 2 * this.radius * grow * 0.7);

    pop();
  }
}


// Globo de texto que sigue a 'target' (cualquier objeto con x, y
// y height), como lo que grita el taxista.
class Bubble extends Effect {
  constructor(target, text, life = 1.1) {
    super(life);

    this.target = target;
    this.content = text;
  }

  draw() {
    const k = this.progress();
    const alpha = k > 0.8 ? 255 * (1 - k) / 0.2 : 255;

    push();

    textFont("monospace");
    textStyle(BOLD);
    textSize(13);
    textAlign(CENTER, CENTER);

    const w = textWidth(this.content) + 18;
    const h = 24;

    // El globo sube un poco y no se sale del canvas.
    const x = constrain(this.target.x, w / 2 + 4, width - w / 2 - 4);
    const y = this.target.y - this.target.height / 2 - 30 - 10 * k;

    rectMode(CENTER);
    stroke(0, alpha);
    strokeWeight(2);
    fill(255, alpha);
    rect(x, y, w, h, 8);

    noStroke();
    triangle(x - 5, y + h / 2 - 1, x + 5, y + h / 2 - 1, x, y + h / 2 + 7);

    fill(20, alpha);
    text(this.content, x, y + 1);

    pop();
  }
}


// Implementaciones hijas: UI


// Texto con sombra. 'content' puede ser un texto fijo o una función
// que lo devuelve (para valores que cambian, como el puntaje).
class UIText extends Background {
  constructor(x, y, content, options = {}) {
    super(x, y, 0, 0);

    this.content = content;
    this.size = options.size || 16;
    this.align = options.align || CENTER;
    this.color = options.color || "#ffffff";
    this.pill = options.pill || false;     // fondo oscuro redondeado
    this.blink = options.blink || false;   // parpadea cada medio segundo
  }

  getText() {
    return String(
      typeof this.content === "function" ? this.content() : this.content
    );
  }

  draw() {
    if (this.blink && floor(millis() / 500) % 2 === 1) {
      return;
    }

    const s = this.getText();

    push();

    textFont("monospace");
    textStyle(BOLD);
    textSize(this.size);
    textAlign(this.align, CENTER);
    noStroke();

    if (this.pill) {
      const w = textWidth(s) + this.size;
      const h = this.size * 1.6;
      let cx = this.x;
      if (this.align === LEFT) cx = this.x + (w - this.size) / 2;
      if (this.align === RIGHT) cx = this.x - (w - this.size) / 2;
      rectMode(CENTER);
      fill(0, 0, 0, 140);
      rect(cx, this.y, w, h, h / 2);
    }

    fill(0, 0, 0, 170);
    text(s, this.x + 2, this.y + 2);
    fill(this.color);
    text(s, this.x, this.y);

    pop();
  }
}


// Vidas: un taxi por cada vida, alineados a la derecha de x.
class LivesUI extends Background {
  constructor(x, y, size, source) {
    super(x, y, size, size);
    this.source = source;   // función que devuelve cuántas vidas hay
  }

  draw() {
    const n = max(0, this.source());
    if (n === 0) {
      return;
    }

    const gap = this.width * 0.8;
    const total = n * gap;

    push();

    rectMode(CENTER);
    noStroke();
    fill(0, 0, 0, 140);
    rect(
      this.x - total / 2 + gap / 2 - this.width / 2,
      this.y,
      total + this.width * 0.4,
      this.height * 1.25,
      this.height * 0.6
    );

    pop();

    for (let k = 0; k < n; k++) {
      Taxi.drawIcon(
        this.x - this.width / 2 - k * gap,
        this.y,
        this.height
      );
    }
  }
}


// Barra de tiempo: se vacía y cambia de color al acabarse.
class TimerBar extends Background {
  constructor(x, y, w, h, source) {
    super(x, y, w, h);
    this.source = source;   // función que devuelve la fracción [0, 1]
  }

  draw() {
    const f = constrain(this.source(), 0, 1);
    const left = this.x - this.width / 2;
    const top = this.y - this.height / 2;

    push();

    rectMode(CORNER);
    noStroke();
    fill(0, 0, 0, 150);
    rect(left, top, this.width, this.height);

    if (f < 0.25) fill("#e53935");
    else if (f < 0.5) fill("#fdd835");
    else fill("#43a047");
    rect(left, top, this.width * f, this.height);

    pop();
  }
}


// Barra del pito: se llena mientras se recupera y avisa cuando
// está lista.
class HornBar extends Background {
  constructor(x, y, w, h, source) {
    super(x, y, w, h);
    this.source = source;   // función que devuelve la fracción [0, 1]
  }

  draw() {
    const f = constrain(this.source(), 0, 1);
    const ready = f >= 1;
    const left = this.x - this.width / 2;
    const top = this.y - this.height / 2;

    push();

    rectMode(CORNER);
    noStroke();
    fill(0, 0, 0, 150);
    rect(left, top, this.width, this.height, this.height / 2);

    fill(ready ? "#fdd835" : "#8d8d8d");
    rect(left, top, this.width * f, this.height, this.height / 2);

    textFont("monospace");
    textStyle(BOLD);
    textSize(this.height * 0.75);
    textAlign(CENTER, CENTER);
    fill(ready ? "#212121" : "#ffffff");
    text(ready ? "ESPACIO: PITAR" : "PITO", this.x, this.y + 1);

    pop();
  }
}


// Pantalla completa (inicio, victoria, derrota, pausa): un fondo,
// un título y varias líneas de texto. Cada línea puede ser un
// texto o un objeto { text, color, size, blink }.
class Screen extends Background {
  constructor(config) {
    super(width / 2, height / 2, width, height);

    this.backdrop = config.backdrop;   // color sólido (opcional)
    this.overlay = config.overlay;     // [r, g, b, a] encima del juego
    this.taxis = config.taxis || false;

    this.items = [
      new UIText(width / 2, height * 0.3, config.title, {
        size: config.titleSize || min(56, width / 12),
        color: config.titleColor || "#fff176"
      })
    ];

    let y = height * 0.48;
    for (const line of config.lines || []) {
      const opt = typeof line === "object" ? line : { text: line };
      this.items.push(new UIText(width / 2, y, opt.text, {
        size: opt.size || 18,
        color: opt.color || "#ffffff",
        blink: opt.blink || false
      }));
      y += 34;
    }
  }

  draw() {
    push();

    if (this.backdrop !== undefined) {
      background(this.backdrop);
    }

    if (this.overlay !== undefined) {
      rectMode(CORNER);
      noStroke();
      fill(this.overlay);
      rect(0, 0, width, height);
    }

    pop();

    if (this.taxis) {
      this.drawTaxis();
    }

    for (const item of this.items) {
      item.draw();
    }
  }

  // Dos taxis dando brincos a los lados del título.
  drawTaxis() {
    const size = 70;
    const jump = abs(sin(millis() / 300)) * 18;

    Taxi.drawIcon(width * 0.1, height * 0.3 - jump, size, -0.3);
    Taxi.drawIcon(width * 0.9, height * 0.3 - (18 - jump), size, 0.3);
  }
}


// Crea los elementos del HUD (lo que se ve encima del juego).
// Usa get_score(), get_high_score(), get_time_fraction() y
// get_horn_fraction() de manager.js y 'game.lifes' de
// yo_por_alla_no_voy.js.
function createUI(uiConfig = {}) {
  const y = Game.HUD_HEIGHT / 2;
  const size = 15;
  const levelNumber = (uiConfig.level || 0) + 1;
  const stop = getStopName(uiConfig.level || 0);

  const elements = [
    new UIText(
      12,
      y,
      () => "NIVEL " + levelNumber + " (" + stop + ")" +
        "  PTS " + nf(get_score(), 5) +
        "  MAX " + nf(get_high_score(), 5),
      { size: size, align: LEFT, pill: true }
    ),
    new HornBar(620, y, 140, 16, get_horn_fraction),
    new LivesUI(width - 12, y, 26, () => game.lifes)
  ];

  if (uiConfig.timer !== false) {
    elements.push(
      new TimerBar(width / 2, height - 3, width, 6, get_time_fraction)
    );
  }

  return elements;
}
