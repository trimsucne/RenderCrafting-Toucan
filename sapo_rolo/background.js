// Background y UI: el escenario (pasto, ríos, carreteras, andenes,
// parques con ciclorruta y meta) y la interfaz (HUD, letrero de la
// localidad y pantallas completas).
//
// Uso rápido (desde sapo_rolo.js):
//   landscape = createBackground(level.background);
//   ui = createUI(level.ui);
//
// Cada fila del mapa se pinta pixel por pixel una sola vez (al
// cargar el nivel) en una imagen pequeña que luego se agranda.
// Así se ve pixelart, como un arcade.


// Background (sus métodos se pueden sobreescribir o extender
// en las clases hijas).
class Background {
  static preload() {
    Background.img = undefined;
  }

  // Colores ya convertidos con color(), para no convertirlos otra vez
  // en cada pixel.
  static colorCache = {};

  static getColor(hex) {
    if (Background.colorCache[hex] === undefined) {
      Background.colorCache[hex] = color(hex);
    }
    return Background.colorCache[hex];
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


// Terrain: una fila del mapa. Cada tipo de fila es una hija que
// solo dice de qué color es cada pixel con paint(i, j).
// La textura mide 10 pixeles de alto y un poco más que el ancho del
// mapa (16 columnas extra para poder mover el agua).
class Terrain extends Background {
  constructor(row, theme) {
    super(width / 2, GRID.rowY(row), width, GRID.rowHeight());

    this.row = row;
    this.theme = theme;

    // Tamaño de un pixel de la textura en la pantalla.
    this.p = GRID.rowHeight() / 10;
    this.cols = ceil(width / this.p) + 16;

    // Cuánto está corrida la textura hacia la izquierda (el agua).
    this.offset = 0;
  }

  // Tipo de una fila: "goal", "river", "road", "park", "median",
  // "start" o "none" si está fuera del mapa.
  static rowType(row) {
    if (row < 0 || row >= GRID.ROWS) return "none";
    if (GRID.GOAL.includes(row)) return "goal";
    if (GRID.isRiver(row)) return "river";
    if (GRID.isRoad(row)) return "road";
    if (GRID.isPark(row)) return "park";
    if (GRID.MEDIAN.includes(row)) return "median";
    return "start";
  }

  // Tipo de la fila de arriba (d = -1) o de abajo (d = 1).
  neighbor(d) {
    return Terrain.rowType(this.row + d);
  }

  // Pinta la textura pixel por pixel preguntándole a paint(i, j).
  paintTexture() {
    this.img = createImage(this.cols, 10);
    this.img.loadPixels();

    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < this.cols; i++) {
        const c = this.paint(i, j);
        if (c !== null) {
          this.img.set(i, j, Background.getColor(c));
        }
      }
    }

    this.img.updatePixels();
  }

  // Color del pixel (i, j). Las hijas lo reemplazan.
  paint(i, j) {
    return "#ff00ff";
  }

  // Ruido de Perlin de p5 (entre 0 y 1) para que las texturas no se
  // vean todas iguales. Cada fila usa una zona distinta del ruido.
  grain(i, j) {
    return noise(i * 0.6, j * 0.6 + this.row * 10);
  }

  draw() {
    push();

    imageMode(CORNER);
    drawingContext.imageSmoothingEnabled = false;

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


// Pasto: fila de inicio. En el páramo tiene frailejones.
class Grass extends Terrain {
  paint(i, j) {
    const t = this.theme;

    if (t.frailejones) {
      // Un frailejón cada 23 columnas (corrido según la fila).
      const f = (i + this.row * 7) % 23;
      if (f === 5 && j === 2) return "#fdd835";                 // flor
      if (f >= 4 && f <= 6 && j >= 3 && j <= 5) return "#9caf88"; // hojas
      if (f === 5 && j >= 6 && j <= 7) return "#6d4c41";        // tallo
    }

    // Flores sueltas.
    if (j >= 2 && j <= 7 && noise(i * 3, j * 3 + this.row * 7) > 0.8) {
      return t.flowers[i % 3];
    }

    const n = this.grain(i, j);
    if (n < 0.35) return t.grass[0];
    if (n > 0.65) return t.grass[2];
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
    fill("#fff176");
    text("META", this.x, this.y);
    pop();
  }
}


// Parque con ciclorruta: pasto arriba y abajo y el camino de los
// ciclistas en el medio, con línea punteada.
class Park extends Grass {
  paint(i, j) {
    if (j <= 1 || j >= 8) {
      return super.paint(i, j);
    }
    if (j === 2 || j === 7) {
      return this.theme.sidewalk[2];        // borde del camino
    }
    if ((j === 4 || j === 5) && floor(i / 3) % 2 === 0) {
      return this.theme.line;               // línea punteada
    }
    if (this.grain(i, j) > 0.7) {
      return this.theme.bike[1];
    }
    return this.theme.bike[0];
  }
}


// Río: agua con olas que se mueve sola. Muestra el nombre del río.
class Water extends Terrain {
  constructor(row, theme, name) {
    super(row, theme);

    this.name = name;
    // Cada fila de agua corre hacia un lado distinto.
    if (row % 2 === 0) {
      this.speed = this.p * 6;
    } else {
      this.speed = -this.p * 6;
    }
  }

  paint(i, j) {
    const t = this.theme.water;
    // El dibujo se repite cada 16 columnas para poder moverlo sin que
    // se note el salto.
    const k = i % 16;

    // Espuma en las orillas.
    if (j === 0 && this.neighbor(-1) !== "river") return t[2];
    if (j === 9 && this.neighbor(1) !== "river") return t[2];

    // Olas.
    if (j === 3 && k >= 2 && k <= 5) return t[1];
    if (j === 7 && k >= 10 && k <= 13) return t[1];

    // Brillos.
    if ((k * 7 + j * 13) % 29 === 0) return t[2];

    return t[0];
  }

  update() {
    const dt = min(deltaTime, 50) / 1000;
    const period = 16 * this.p;

    this.offset += this.speed * dt;
    if (this.offset >= period) this.offset -= period;
    if (this.offset < 0) this.offset += period;
  }

  draw() {
    super.draw();

    // El nombre solo va en la primera fila de cada río.
    if (this.name !== undefined && this.neighbor(-1) !== "river") {
      push();
      textFont("monospace");
      textStyle(BOLD);
      textSize(13);
      textAlign(LEFT, CENTER);
      rectMode(CORNER);
      noStroke();
      const w = textWidth(this.name) + 14;
      fill(0, 0, 0, 120);
      rect(8, this.y - this.height / 2 + 2, w, 18, 9);
      fill("#e3f2fd");
      text(this.name, 15, this.y - this.height / 2 + 11);
      pop();
    }
  }
}


// Carretera: asfalto (o adoquín en el centro histórico) con líneas
// de carril.
class Road extends Terrain {
  paint(i, j) {
    const t = this.theme;

    // Borde continuo arriba si arriba no hay carretera.
    if (j === 0 && this.neighbor(-1) !== "road") {
      return t.edge;
    }

    if (j === 9) {
      if (this.neighbor(1) !== "road") {
        return t.edge;                       // borde continuo abajo
      }
      if (floor(i / 4) % 2 === 0) {
        return t.line;                       // línea punteada entre carriles
      }
    }

    if (t.cobblestone) {
      // Adoquines de 4 x 3, corridos como ladrillos.
      const shift = (floor(j / 3) % 2) * 2;
      if ((i + shift) % 4 === 0 || j % 3 === 0) {
        return t.road[1];
      }
      if (this.grain(i, j) > 0.6) return t.road[2];
      return t.road[0];
    }

    const n = this.grain(i, j);
    if (n < 0.3) return t.road[1];
    if (n > 0.7) return t.road[2];
    return t.road[0];
  }
}


// Andén: baldosas con bordillo amarillo y negro donde toca la carretera.
class Sidewalk extends Terrain {
  paint(i, j) {
    const t = this.theme;

    if (j === 0 && this.neighbor(-1) === "road") return t.curb[floor(i / 3) % 2];
    if (j === 9 && this.neighbor(1) === "road") return t.curb[floor(i / 3) % 2];

    // Juntas de las baldosas.
    if (j === 0 || j === 5 || j === 9) return t.sidewalk[2];
    if (j < 5 && i % 8 === 0) return t.sidewalk[2];
    if (j > 5 && i % 8 === 4) return t.sidewalk[2];

    if (this.grain(i, j) > 0.7) return t.sidewalk[0];
    return t.sidewalk[1];
  }
}


// Landscape: el mapa completo, una fila de terreno por cada fila
// de la grilla.
class Landscape extends Background {
  // Paletas de colores. Cada localidad usa una.
  static themes = {
    day: {
      grass: ["#2f7d32", "#43a047", "#66bb6a"],
      flowers: ["#fff176", "#ffffff", "#ef5350"],
      water: ["#1565c0", "#1e88e5", "#bbdefb"],
      road: ["#37383a", "#2c2d2f", "#46474a"],
      line: "#eeeeee",
      edge: "#f9d71c",
      curb: ["#f9d71c", "#222222"],
      sidewalk: ["#9e9e9e", "#bdbdbd", "#7a7a7a"],
      bike: ["#8d4b3a", "#7a3f30"],
      goal: ["#f5f5f5", "#212121"]
    },
    // Nublado: el clima más bogotano de todos.
    cloudy: {
      grass: ["#3d6b45", "#4f7f57", "#6a9670"],
      flowers: ["#e0e0e0", "#ffffff", "#ffcc80"],
      water: ["#3e5c76", "#557590", "#c5d3df"],
      road: ["#404448", "#33373a", "#4d5155"],
      line: "#e0e0e0",
      edge: "#e0c341",
      curb: ["#e0c341", "#2a2a2a"],
      sidewalk: ["#8f9498", "#a7acb0", "#71767a"],
      bike: ["#7e5047", "#6c443c"],
      goal: ["#eeeeee", "#263238"]
    },
    sunset: {
      grass: ["#556b2f", "#6b8e23", "#8fbc4f"],
      flowers: ["#ffcc80", "#ffffff", "#ff7043"],
      water: ["#4a3b8f", "#6a5acd", "#ffb38a"],
      road: ["#3b3036", "#2e252a", "#4a3d44"],
      line: "#ffe0b2",
      edge: "#ffb74d",
      curb: ["#ffb74d", "#2b1d1d"],
      sidewalk: ["#a1887f", "#bcaaa4", "#795548"],
      bike: ["#8a4a3c", "#743c30"],
      goal: ["#ffe0b2", "#3e2723"]
    },
    night: {
      grass: ["#1b3d1f", "#24502a", "#2f6b37"],
      flowers: ["#fff59d", "#b3e5fc", "#f48fb1"],
      water: ["#0b2545", "#13315c", "#8da9c4"],
      road: ["#1f1f24", "#18181c", "#2a2a30"],
      line: "#cfcfcf",
      edge: "#c9a227",
      curb: ["#c9a227", "#111111"],
      sidewalk: ["#55585e", "#6b6f76", "#40434a"],
      bike: ["#5a2f27", "#4a2620"],
      goal: ["#cfd8dc", "#111111"]
    },
    // Centro histórico: calles de adoquín.
    colonial: {
      grass: ["#3d6b45", "#4f7f57", "#6a9670"],
      flowers: ["#ffffff", "#ef9a9a", "#fff176"],
      water: ["#3e5c76", "#557590", "#c5d3df"],
      road: ["#7b6a5a", "#4e4237", "#8d7b6a"],
      line: "#eeeeee",
      edge: "#5d4e40",
      curb: ["#f9d71c", "#222222"],
      sidewalk: ["#a1887f", "#bcaaa4", "#795548"],
      bike: ["#7e5047", "#6c443c"],
      goal: ["#f5f5f5", "#3e2723"],
      cobblestone: true
    },
    // Páramo: pasto amarillento con frailejones.
    paramo: {
      grass: ["#6b7f3a", "#869a4a", "#a3b15e"],
      flowers: ["#fdd835", "#ffffff", "#ce93d8"],
      water: ["#2f5d62", "#3f7a80", "#b2dfdb"],
      road: ["#6d5c48", "#5a4b3a", "#7e6b55"],
      line: "#d7ccc8",
      edge: "#8d7b6a",
      curb: ["#8d7b6a", "#3e2723"],
      sidewalk: ["#8d8577", "#a39b8c", "#6f685c"],
      bike: ["#7a5a43", "#664a37"],
      goal: ["#f5f5f5", "#33691e"],
      frailejones: true
    }
  };

  constructor(config) {
    super(width / 2, GRID.mapHeight() / 2, width, GRID.mapHeight());

    this.theme = Landscape.themes[config.theme];
    if (this.theme === undefined) {
      this.theme = Landscape.themes.day;
    }

    this.rows = [];
    for (let r = 0; r < GRID.ROWS; r++) {
      const terrain = this.createTerrain(r);
      terrain.paintTexture();
      this.rows.push(terrain);
    }
  }

  // Crea la fila de terreno que corresponde según la grilla.
  createTerrain(row) {
    const type = Terrain.rowType(row);

    if (type === "goal") return new Goal(row, this.theme);
    if (type === "river") return new Water(row, this.theme, GRID.RIVER_NAMES[row]);
    if (type === "road") return new Road(row, this.theme);
    if (type === "park") return new Park(row, this.theme);
    if (type === "median") return new Sidewalk(row, this.theme);
    return new Grass(row, this.theme);
  }

  update() {
    for (const terrain of this.rows) {
      terrain.update();
    }
  }

  // Solo se dibujan las filas que la cámara alcanza a ver.
  draw() {
    for (const terrain of this.rows) {
      if (camera.isVisible(terrain.y, terrain.height)) {
        terrain.draw();
      }
    }
  }
}


// Crea el escenario a partir de la configuración guardada en el nivel.
function createBackground(backgroundConfig) {
  return new Landscape(backgroundConfig);
}


// Implementaciones hijas: UI
// (todas se dibujan en coordenadas de pantalla, fuera de la cámara)


// Texto en negrilla con sombra, centrado en (x, y).
function drawShadowText(s, x, y, size, textColor) {
  push();
  textFont("monospace");
  textStyle(BOLD);
  textSize(size);
  textAlign(CENTER, CENTER);
  noStroke();
  fill(0, 0, 0, 170);
  text(s, x + 2, y + 2);
  fill(textColor);
  text(s, x, y);
  pop();
}


// HUD: barra de arriba (localidad, puntos y vidas) y barra de tiempo
// abajo. Lee los datos en cada frame: get_score(), get_high_score(),
// get_time_fraction() (manager.js) y 'lifes' (sapo_rolo.js).
class HUD extends Background {
  constructor(uiConfig) {
    super(width / 2, HUD_HEIGHT / 2, width, HUD_HEIGHT);

    this.number = uiConfig.number;
    this.name = uiConfig.name;
    this.team = uiConfig.team;
  }

  draw() {
    push();

    // Barra de arriba.
    noStroke();
    fill(0, 0, 0, 150);
    rectMode(CORNER);
    rect(0, 0, width, this.height);

    textFont("monospace");
    textStyle(BOLD);
    textSize(15);
    fill(255);

    textAlign(LEFT, CENTER);
    text((this.number + 1) + ". " + this.name.toUpperCase(), 12, this.y);

    textAlign(CENTER, CENTER);
    text("PTS " + nf(get_score(), 5) + "   MAX " + nf(get_high_score(), 5), width / 2 + 60, this.y);

    // Vidas: un sapito del equipo por cada vida.
    imageMode(CENTER);
    drawingContext.imageSmoothingEnabled = false;
    const icon = Frog.sprite(this.team);
    for (let k = 0; k < min(lifes, MAX_LIFES); k++) {
      image(icon, width - 20 - k * 24, this.y, 20, 18);
    }

    // Barra de tiempo.
    const f = constrain(get_time_fraction(), 0, 1);
    fill(0, 0, 0, 150);
    rect(0, height - 6, width, 6);
    if (f < 0.25) {
      fill("#e53935");
    } else if (f < 0.5) {
      fill("#fdd835");
    } else {
      fill("#43a047");
    }
    rect(0, height - 6, width * f, 6);

    pop();
  }
}


// Letrero de bienvenida a la localidad. Se muestra unos segundos al
// empezar el nivel y luego desaparece.
class Banner extends Background {
  static DURATION = 3500;   // milisegundos

  constructor(uiConfig) {
    super(width / 2, height * 0.42, width * 0.8, 150);

    this.title = "Localidad " + (uiConfig.number + 1) + ": " + uiConfig.name;
    this.lines = [];
    if (uiConfig.rivers.length > 0) {
      this.lines.push("Ríos: " + uiConfig.rivers.join(", "));
    } else {
      this.lines.push("Aquí casi no hay ríos... ¡pero sí mucho tráfico!");
    }
    this.lines.push("Hinchada: " + Frog.teamNames[uiConfig.team]);

    this.startTime = millis();
  }

  draw() {
    const elapsed = millis() - this.startTime;
    if (elapsed > Banner.DURATION) {
      return;
    }

    // Se desvanece en el último segundo.
    let alpha = 1;
    if (elapsed > Banner.DURATION - 1000) {
      alpha = (Banner.DURATION - elapsed) / 1000;
    }

    push();
    rectMode(CENTER);
    noStroke();
    fill(0, 0, 0, 170 * alpha);
    rect(this.x, this.y, this.width, this.height, 16);
    pop();

    drawShadowText(this.title, this.x, this.y - 40, 26, color(255, 241, 118, 255 * alpha));
    for (let k = 0; k < this.lines.length; k++) {
      drawShadowText(this.lines[k], this.x, this.y + 5 + k * 28, 15, color(255, 255, 255, 255 * alpha));
    }
  }
}


// Pantalla completa (inicio, victoria, derrota, pausa): un fondo,
// un título, varias líneas de texto y, si se quiere, los tres sapos
// saltando. La última línea parpadea (es la de "presiona ENTER").
class Screen extends Background {
  constructor(config) {
    super(width / 2, height / 2, width, height);

    this.backdrop = config.backdrop;      // color de fondo (opcional)
    this.overlay = config.overlay;        // velo oscuro encima del juego
    this.title = config.title;
    this.titleColor = config.titleColor;
    this.lines = config.lines;
    this.frogs = config.frogs;
  }

  draw() {
    push();

    if (this.backdrop !== undefined) {
      background(this.backdrop);
    }

    if (this.overlay) {
      rectMode(CORNER);
      noStroke();
      fill(0, 0, 0, 160);
      rect(0, 0, width, height);
    }

    if (this.frogs) {
      this.drawFrogs();
    }

    pop();

    drawShadowText(this.title, width / 2, height * 0.3, min(52, width / 14), this.titleColor);

    for (let k = 0; k < this.lines.length; k++) {
      const isLast = k === this.lines.length - 1;
      // La última línea parpadea cada medio segundo.
      if (isLast && floor(millis() / 500) % 2 === 1) {
        continue;
      }
      let lineColor = "#ffffff";
      if (isLast) {
        lineColor = "#fff176";
      }
      drawShadowText(this.lines[k], width / 2, height * 0.48 + k * 34, 18, lineColor);
    }
  }

  // Los tres sapos saltando debajo del título.
  drawFrogs() {
    const teams = ["santafe", "equidad", "millonarios"];

    imageMode(CENTER);
    drawingContext.imageSmoothingEnabled = false;

    for (let k = 0; k < 3; k++) {
      const jump = abs(sin(millis() / 300 + k)) * 16;
      image(Frog.sprite(teams[k]), width / 2 + (k - 1) * 90, height * 0.15 - jump + 20, 52, 48);
    }
  }
}


// Crea los elementos de interfaz del nivel.
function createUI(uiConfig) {
  return [
    new HUD(uiConfig),
    new Banner(uiConfig)
  ];
}
