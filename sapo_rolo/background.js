// Background y UI: el escenario (pasto, río, carretera, andenes y
// meta) y los elementos de interfaz (textos, vidas, tiempo y
// pantallas completas).
//
// Uso rápido (desde sapo_rolo.js):
//   landscape = createBackground(level.background);
//   ui = createUI(level.ui);
//
// Todo es pixelart generado por código: cada fila del mapa se
// "pinta" una sola vez, pixel a pixel, en una imagen pequeña que
// luego se escala al tamaño real de la fila.


// Background (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Background {
  static preload() {
    Background.img = undefined;
  }

  // Texturas ya pintadas (para no repetir el trabajo al reiniciar
  // o al volver a un nivel con la misma forma) y colores ya
  // convertidos a [r, g, b, a].
  static textureCache = {};
  static colorCache = {};

  // Cada fila del mapa mide 10 pixeles de arte de alto.
  static pixelSize() {
    return GRID.rowHeight() / 10;
  }

  // Número pseudoaleatorio en [0, 1) que siempre es el mismo para
  // los mismos (i, j, seed). Sirve para decorar sin tocar el
  // random() de p5, que es el que usa la generación de niveles.
  static hash(i, j, seed = 0) {
    let h = Math.imul(i, 374761393) +
      Math.imul(j, 668265263) +
      Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // "#rrggbb" -> [r, g, b, a]
  static rgba(hex) {
    if (Background.colorCache[hex] === undefined) {
      const c = color(hex);
      Background.colorCache[hex] = [red(c), green(c), blue(c), alpha(c)];
    }
    return Background.colorCache[hex];
  }

  // Crea (o reutiliza) una imagen de cols x rows pixeles. El color
  // de cada pixel lo decide painter(i, j) (null = transparente).
  static makeTexture(key, cols, rows, painter) {
    if (Background.textureCache[key] === undefined) {
      const img = createImage(cols, rows);
      img.loadPixels();

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const hex = painter(i, j);
          if (hex === null) {
            continue;
          }
          const [r, g, b, a] = Background.rgba(hex);
          const k = 4 * (j * cols + i);
          img.pixels[k] = r;
          img.pixels[k + 1] = g;
          img.pixels[k + 2] = b;
          img.pixels[k + 3] = a;
        }
      }

      img.updatePixels();
      Background.textureCache[key] = img;
    }

    return Background.textureCache[key];
  }

  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // A definir en las implementaciones
    this.img = undefined;        // Recuerden que si ponen texturas,
                                 // la idea es que sea pixelart
                                 // (por lo que es arcade).

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
// carretera...) es una hija que solo define paint(i, j).
//
// Ojo: paint() se llama dentro del constructor de Terrain, así que
// solo puede usar this.row, this.theme, this.cols y GRID (los campos
// que las hijas definan después de super() todavía no existen).
class Terrain extends Background {
  // Columnas de arte extra para poder desplazar la textura (agua).
  static EXTRA = 16;

  constructor(row, theme) {
    super(width / 2, GRID.rowY(row), width, GRID.rowHeight());

    this.row = row;
    this.theme = theme;
    this.p = Background.pixelSize();
    this.cols = ceil(width / this.p) + Terrain.EXTRA;

    // Desplazamiento horizontal de la textura (en pixeles de pantalla).
    this.offset = 0;

    this.img = Background.makeTexture(
      this.textureKey(),
      this.cols,
      10,
      (i, j) => this.paint(i, j)
    );
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

  // Dos filas con el mismo identificador se ven idénticas y
  // comparten imagen.
  textureKey() {
    return [
      this.constructor.name,
      this.theme.name,
      this.cols,
      this.row % 4,
      this.neighbor(-1),
      this.neighbor(1)
    ].join("|");
  }

  // Color del pixel (i, j) de la textura. Las hijas lo reemplazan.
  paint(i, j) {
    return "#ff00ff";
  }

  draw() {
    push();

    imageMode(CORNER);
    drawingContext.imageSmoothingEnabled = false;

    if (this.tint !== undefined) {
      tint(this.tint);
    }

    // +1 de alto para que no queden rendijas entre filas.
    image(
      this.img,
      -this.offset,
      this.y - this.height / 2,
      this.cols * this.p,
      this.height + 1
    );

    pop();
  }
}


// Pasto: fila de inicio (y la base de la meta).
class Grass extends Terrain {
  paint(i, j) {
    const t = this.theme;
    const v = this.row % 4;

    // Florecitas sueltas.
    if (j >= 2 && j <= 7 && Background.hash(i, j, v + 7) < 0.012) {
      const k = floor(Background.hash(i, j, v + 8) * t.flowers.length);
      return t.flowers[k];
    }

    const n = Background.hash(i, j, v);
    if (n < 0.18) return t.grass[0];
    if (n > 0.9) return t.grass[2];
    return t.grass[1];
  }
}


// Meta: franja a cuadros de llegada con pasto arriba y abajo.
class Goal extends Grass {
  paint(i, j) {
    if (j <= 1 || j >= 8) {
      return super.paint(i, j);
    }
    const cell = (floor(i / 2) + floor((j - 2) / 2)) % 2;
    return this.theme.goal[cell];
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
  constructor(row, theme) {
    super(row, theme);
    // Cada fila de agua corre hacia un lado distinto.
    this.speed = (row % 2 === 0 ? 1 : -1) * this.p * 6;
  }

  paint(i, j) {
    const t = this.theme.water;
    // El patrón se repite cada 16 columnas para poder desplazarlo.
    const k = i % 16;

    // Espuma en las orillas.
    if ((j === 0 && this.neighbor(-1) !== "river") ||
        (j === 9 && this.neighbor(1) !== "river")) {
      return t[2];
    }

    // Olas.
    if ((j === 3 && k >= 2 && k <= 5) ||
        (j === 7 && k >= 10 && k <= 13)) {
      return t[1];
    }

    // Brillos.
    if (Background.hash(k, j, 5) > 0.95) {
      return t[2];
    }

    return t[0];
  }

  update() {
    const dt = min(deltaTime, 50) / 1000;
    const period = 16 * this.p;
    this.offset = ((this.offset + this.speed * dt) % period + period) % period;
  }
}


// Carretera: asfalto con líneas de carril.
class Road extends Terrain {
  paint(i, j) {
    const t = this.theme;

    // Borde superior continuo si arriba no hay carretera.
    if (j === 0 && this.neighbor(-1) !== "road") {
      return t.edge;
    }

    if (j === 9) {
      // Línea punteada entre dos carriles, continua al final.
      if (this.neighbor(1) === "road") {
        if (floor(i / 4) % 2 === 0) return t.line;
      } else {
        return t.edge;
      }
    }

    const n = Background.hash(i, j, this.row % 4);
    if (n < 0.08) return t.road[1];
    if (n > 0.94) return t.road[2];
    return t.road[0];
  }
}


// Andén: baldosas grises con bordillo amarillo y negro
// donde toca la carretera.
class Sidewalk extends Terrain {
  paint(i, j) {
    const t = this.theme;

    if ((j === 0 && this.neighbor(-1) === "road") ||
        (j === 9 && this.neighbor(1) === "road")) {
      return t.curb[floor(i / 3) % 2];
    }

    // Juntas de las baldosas (desfasadas como ladrillos).
    if (j === 0 || j === 5 || j === 9 ||
        i % 8 === (j < 5 ? 0 : 4)) {
      return t.sidewalk[2];
    }

    if (Background.hash(i, j, this.row % 4) > 0.93) {
      return t.sidewalk[0];
    }
    return t.sidewalk[1];
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
        size: min(56, width / 12),
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

  const elements = [
    new UIText(
      12,
      y,
      () => "NIVEL " + levelNumber +
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
