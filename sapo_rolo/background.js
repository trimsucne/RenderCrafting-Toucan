// Background y UI: el escenario (pasto, río, carretera, andenes y
// meta) y los elementos de interfaz (textos, vidas, tiempo y
// pantallas completas).
//
// Uso rápido (desde sapo_rolo.js):
//   landscape = createBackground(level.background);
//   ui = createUI(level.ui);
//
// Las texturas del escenario se cargan desde img/background/.
// Cada tipo de terreno tiene sprites para los temas day, sunset y night.


// Background (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Background {
  static preload() {
    cityBackgroundSound = new Audio("aud/background/city_background.mp3");
  }
  
  // Cada fila del mapa mide 10 pixeles de arte de alto.
  static pixelSize() {
    return GRID.rowHeight() / 10;
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

    if (this.img !== undefined) {
      image(this.img, this.x, this.y, this.width, this.height);
    }

    pop();
  }
}


// Implementaciones hijas: escenario


// Terrain: una fila del mapa. Cada tipo de fila (pasto, río,
// carretera...) carga una textura desde img/background/.
//
// Las imágenes se cargan antes de crear el escenario mediante
// los métodos estáticos preload() de las clases hijas.
class Terrain extends Background {
  // Ancho y alto de los sprites en pixeles de arte.
  static TILE_WIDTH = 16;
  static TILE_HEIGHT = 10;

  // Carga los tres temas correspondientes a un tipo de terreno.
  static preloadSprites(kind) {
    const themes = ["day", "sunset", "night"];
    const sprites = {};

    for (const theme of themes) {
      sprites[theme] = loadImage(
        "img/background/" + theme + "_" + kind + ".png"
      );
    }

    return sprites;
  }

  constructor(row, theme) {
    super(width / 2, GRID.rowY(row), width, GRID.rowHeight());

    this.row = row;
    this.theme = theme;
    this.p = Background.pixelSize();
    this.cols = ceil(width / this.p) + Terrain.TILE_WIDTH;

    // Desplazamiento horizontal de la textura (en pixeles de pantalla).
    this.offset = 0;

    // Selecciona el sprite correspondiente al tema del nivel.
    this.img = this.constructor.sprites[this.theme.name];
  }

  // Cada fila del mapa mide 10 pixeles de arte de alto.
  static pixelSize() {
    return GRID.rowHeight() / Terrain.TILE_HEIGHT;
  }

  // Tipo de una fila: "goal", "river", "road", "median", "start"
  // o "none" si está fuera del mapa.
  static rowType(row) {
    if (row < 0 || row >= GRID.ROWS) return "none";
    if (GRID.GOAL.includes(row)) return "goal";
    if (GRID.isRiver(row)) return "river";
    if (GRID.isRoad(row)) return "road";
    if (GRID.MEDIAN.includes(row)) return "median";
    return "start";
  }

  // Tipo de la fila vecina (d = -1 arriba, d = 1 abajo).
  neighbor(d) {
    return Terrain.rowType(this.row + d);
  }

  draw() {
    if (this.img === undefined) {
      return;
    }

    push();

    imageMode(CORNER);
    drawingContext.imageSmoothingEnabled = false;

    if (this.tint !== undefined) {
      tint(this.tint);
    }

    // Repite el sprite horizontalmente para cubrir toda la fila.
    // +1 de alto para que no queden rendijas entre filas.
    const tileWidth = Terrain.TILE_WIDTH * this.p;
    const tileHeight = this.height + 1;
    const start = -((this.offset % tileWidth) + tileWidth) % tileWidth;

    for (let x = start; x < width; x += tileWidth) {
      image(
        this.img,
        x,
        this.y - this.height / 2,
        tileWidth,
        tileHeight
      );
    }

    pop();
  }
}


// Pasto: fila de inicio (y la base de la meta).
class Grass extends Terrain {
  static preload() {
    Grass.sprites = Terrain.preloadSprites("grass");
  }
}


// Meta: franja de llegada con pasto arriba y abajo.
class Goal extends Grass {
  static preload() {
    Goal.sprites = Terrain.preloadSprites("goal");
  }

  draw() {
    super.draw();

    push();
    textFont("monospace");
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    textSize(this.height * 0.45);
    noStroke();
    fill(0, 0, 0, 170);
    rectMode(CENTER);
    rect(this.x, this.y, this.height * 2.4, this.height * 0.6, 6);
    fill(this.theme.flowers[0]);
    text("META", this.x, this.y);
    pop();
  }
}


// Río: agua con olas que se mueve sola.
class Water extends Terrain {
  static preload() {
    Water.sprites = Terrain.preloadSprites("water");
  }

  constructor(row, theme) {
    super(row, theme);

    // Cada fila de agua corre hacia un lado distinto.
    this.speed = (row % 2 === 0 ? 1 : -1) * this.p * 6;
  }

  update() {
    const dt = min(deltaTime, 50) / 1000;
    const period = Terrain.TILE_WIDTH * this.p;
    this.offset = ((this.offset + this.speed * dt) % period + period) % period;
  }
}


// Carretera: asfalto con líneas de carril.
class Road extends Terrain {
  static preload() {
    Road.sprites = Terrain.preloadSprites("road");
  }
}


// Andén: baldosas grises con bordillo amarillo y negro
// donde toca la carretera.
class Sidewalk extends Terrain {
  static preload() {
    Sidewalk.sprites = Terrain.preloadSprites("sidewalk");
  }
}


// Crea la fila de terreno que corresponde según la grilla.
function createTerrain(row, theme) {
  const type = Terrain.rowType(row);

  if (type === "goal") return new Goal(row, theme);
  if (type === "river") return new Water(row, theme);
  if (type === "road") return new Road(row, theme);
  if (type === "median") return new Sidewalk(row, theme);
  return new Grass(row, theme);
}


// Landscape: el mapa completo, formado por una fila de terreno
// por cada fila de la grilla.
//
// Las paletas se conservan para los elementos de interfaz que
// todavía utilizan sus colores.
class Landscape extends Background {
  // Paletas de colores (el nivel elige cuál usar).
  static themes = {
    day: {
      name: "day",
      grass: ["#2f7d32", "#43a047", "#66bb6a"],
      flowers: ["#fff176", "#ffffff", "#ef5350"],
      water: ["#1565c0", "#1e88e5", "#bbdefb"],
      road: ["#37383a", "#2c2d2f", "#46474a"],
      line: "#eeeeee",
      edge: "#f9d71c",
      curb: ["#f9d71c", "#222222"],
      sidewalk: ["#9e9e9e", "#bdbdbd", "#7a7a7a"],
      goal: ["#f5f5f5", "#212121"]
    },
    sunset: {
      name: "sunset",
      grass: ["#556b2f", "#6b8e23", "#8fbc4f"],
      flowers: ["#ffcc80", "#ffffff", "#ff7043"],
      water: ["#4a3b8f", "#6a5acd", "#ffb38a"],
      road: ["#3b3036", "#2e252a", "#4a3d44"],
      line: "#ffe0b2",
      edge: "#ffb74d",
      curb: ["#ffb74d", "#2b1d1d"],
      sidewalk: ["#a1887f", "#bcaaa4", "#795548"],
      goal: ["#ffe0b2", "#3e2723"]
    },
    night: {
      name: "night",
      grass: ["#1b3d1f", "#24502a", "#2f6b37"],
      flowers: ["#fff59d", "#b3e5fc", "#f48fb1"],
      water: ["#0b2545", "#13315c", "#8da9c4"],
      road: ["#1f1f24", "#18181c", "#2a2a30"],
      line: "#cfcfcf",
      edge: "#c9a227",
      curb: ["#c9a227", "#111111"],
      sidewalk: ["#55585e", "#6b6f76", "#40434a"],
      goal: ["#cfd8dc", "#111111"]
    }
  };

  constructor(config = {}) {
    super(width / 2, height / 2, width, height);

    this.theme = Landscape.themes[config.theme] || Landscape.themes.day;

    this.rows = [];
    for (let r = 0; r < GRID.ROWS; r++) {
      this.rows.push(createTerrain(r, this.theme));
    }
  }

  update() {
    for (const terrain of this.rows) {
      terrain.update();
    }
  }

  draw() {
    for (const terrain of this.rows) {
      terrain.draw();
    }
  }
}


// Crea el escenario a partir de la configuración guardada en el nivel.
function createBackground(backgroundConfig) {
  return new Landscape(backgroundConfig);
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


// Vidas: un sapito por cada vida, alineados a la derecha de x.
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

    const gap = this.width * 1.15;
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

    imageMode(CENTER);
    drawingContext.imageSmoothingEnabled = false;
    const img = Frog.sprite("green");
    for (let k = 0; k < n; k++) {
      image(
        img,
        this.x - this.width / 2 - k * gap,
        this.y,
        this.width,
        this.height * 12 / 13
      );
    }

    pop();
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


// Pantalla completa (inicio, victoria, derrota, pausa): un fondo,
// un título y varias líneas de texto. Cada línea puede ser un
// texto o un objeto { text, color, size, blink }.
class Screen extends Background {
  constructor(config) {
    super(width / 2, height / 2, width, height);

    this.backdrop = config.backdrop;   // color sólido (opcional)
    this.overlay = config.overlay;     // [r, g, b, a] encima del juego
    this.frogs = config.frogs || false;

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

    if (this.frogs) {
      this.drawFrogs();
    }

    pop();

    for (const item of this.items) {
      item.draw();
    }
  }

  // Dos sapos saltando a los lados del título.
  drawFrogs() {
    const size = 64;
    const jump = abs(sin(millis() / 300)) * 18;

    imageMode(CENTER);
    drawingContext.imageSmoothingEnabled = false;
    image(Frog.sprite("green"), width * 0.15, height * 0.3 - jump,
      size, size * 12 / 13);
    image(Frog.sprite("golden"), width * 0.85, height * 0.3 - (18 - jump),
      size, size * 12 / 13);
  }
}


// Crea los elementos del HUD (lo que se ve encima del juego).
// Usa get_score(), get_high_score() y get_time_fraction() de
// manager.js y la variable global 'lifes' de sapo_rolo.js.
function createUI(uiConfig = {}) {
  const rowH = GRID.rowHeight();
  const y = GRID.rowY(GRID.GOAL[0]);
  const size = constrain(rowH * 0.34, 11, 18);
  const levelNumber = (uiConfig.level || 0) + 1;
  const locality = getLocalityName(uiConfig.level || 0);

  const elements = [
    new UIText(
      12,
      y,
      () => "NIVEL " + levelNumber + " (" + locality + ")" +
        "  PTS " + nf(get_score(), 5) +
        "  MAX " + nf(get_high_score(), 5),
      { size: size, align: LEFT, pill: true }
    ),
    new LivesUI(width - 12, y, size * 1.3, () => lifes)
  ];

  if (uiConfig.timer !== false) {
    elements.push(
      new TimerBar(width / 2, height - 3, width, 6, get_time_fraction)
    );
  }

  return elements;
}
