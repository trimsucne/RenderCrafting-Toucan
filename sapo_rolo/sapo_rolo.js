// Archivo principal: Modelo global de datos, estado y niveles.
//
// Cada nivel es una de las 20 localidades de Bogotá, en orden oficial
// (1. Usaquén ... 20. Sumapaz). La dificultad sube con el número de
// la localidad y cada una tiene sus ríos, su tráfico, sus parques y
// su hinchada.

// Márgenes generales del mapa.
const MARGINX = 0, MARGINY = 0;

// Alto fijo de cada fila en pixeles. Los niveles largos no caben en
// la pantalla: la cámara sigue al sapo, así los objetos nunca se
// hacen más pequeños.
const ROW_HEIGHT = 50;

// Vidas al empezar y máximo de vidas que se pueden acumular.
const START_LIFES = 3;
const MAX_LIFES = 9;

// Alto de la barra del HUD (arriba de la pantalla).
const HUD_HEIGHT = 36;

// Cuadrícula del mapa (filas contadas de arriba hacia abajo)
// Definición por defecto que es reemplazada procedimentalmente
const GRID = {
  ROWS: 13,
  GOAL: [0],
  RIVER: [1, 2, 3, 4, 5],
  MEDIAN: [6],
  ROAD: [7, 8, 9, 10, 11],
  PARK: [],
  START: [12],

  // Nombre del río de cada fila de río: { fila: "Río Fucha", ... }
  RIVER_NAMES: {},

  // Centro vertical (en píxeles del mapa) de una fila
  rowY(row) {
    return MARGINY + (row + 0.5) * ROW_HEIGHT;
  },

  // Alto de una fila en píxeles
  rowHeight() {
    return ROW_HEIGHT;
  },

  // Alto de todo el mapa en píxeles
  mapHeight() {
    return GRID.ROWS * ROW_HEIGHT;
  },

  // Fila en la que está una coordenada y (en píxeles del mapa)
  rowOf(y) {
    return constrain(
      floor((y - MARGINY) / GRID.rowHeight()),
      0,
      GRID.ROWS - 1
    );
  },

  isRiver(row) {
    return GRID.RIVER.includes(row);
  },

  isRoad(row) {
    return GRID.ROAD.includes(row);
  },

  isPark(row) {
    return GRID.PARK.includes(row);
  },

  // Actualiza la estructura de la grilla con la configuración
  // correspondiente al nivel actual.
  set(config) {
    GRID.ROWS = config.ROWS;
    GRID.GOAL = config.GOAL;
    GRID.RIVER = config.RIVER;
    GRID.MEDIAN = config.MEDIAN;
    GRID.ROAD = config.ROAD;
    GRID.PARK = config.PARK;
    GRID.START = config.START;
    GRID.RIVER_NAMES = config.RIVER_NAMES;
  }
};


// Cámara: muestra solo una parte del mapa y sigue al sapo.
// camera.y es la 'y' del mapa que queda en el borde de arriba de la
// pantalla.
const camera = {
  y: 0,

  // Dónde debería estar la cámara para ver al sapo en la parte de
  // abajo de la pantalla. Arriba se deja el espacio del HUD para que
  // no tape la meta.
  target(player) {
    return constrain(player.y - height * 0.65, -HUD_HEIGHT, GRID.mapHeight() - height);
  },

  // Se acerca poco a poco a su objetivo (movimiento suave).
  follow(player) {
    camera.y = lerp(camera.y, camera.target(player), 0.12);
  },

  // Se pone de una vez en su objetivo (al empezar un nivel).
  jumpTo(player) {
    camera.y = camera.target(player);
  },

  // Todo lo que se dibuje entre begin() y end() se mueve con la cámara.
  begin() {
    push();
    translate(0, -camera.y);
  },

  end() {
    pop();
  },

  // ¿Algo con centro en y y alto h se alcanza a ver?
  isVisible(y, h) {
    return y + h / 2 >= camera.y && y - h / 2 <= camera.y + height;
  }
};


// Modelo global de datos.
let state;
let levelManager;

let lifes;
let frog;
let landscape;

let obstacles = [];
let ui = [];


function preload() {
  // Preloads de las implementaciones de los modelos.
  Obstacle.preload();
  Player.preload();
  Background.preload();
}


// Inicialización principal.
function setup() {
  createCanvas(850, 600);

  imageMode(CENTER);
  rectMode(CENTER);

  lifes = START_LIFES;
  levelManager = new LevelManager();
  state = new StateManager();
}


// Renderizado principal.
// Cada estado implementa su propio draw().
function draw() {
  background(30);
  state.draw();
}


// Entrada principal.
// Igual que draw(), la entrada se delega al estado actual.
function keyPressed() {
  state.keyPressed(key);

  // Evita que las flechas y la barra espaciadora muevan la página.
  if (keyCode === UP_ARROW || keyCode === DOWN_ARROW ||
      keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW || key === " ") {
    return false;
  }
}


// Reinicia lo que se acumula entre niveles (vidas y puntaje).
function resetGame() {
  lifes = START_LIFES;
  resetScore();
}


// Conversión de coordenadas normalizadas a píxeles.
function mapX(x) {
  return MARGINX + (x * (width - 2 * MARGINX));
}

function mapY(y) {
  return MARGINY + (y * (height - 2 * MARGINY));
}

function sizeX(x) {
  return x * (width - 2 * MARGINX);
}

function sizeY(y) {
  return y * (height - 2 * MARGINY);
}


// Carga de niveles

// Carga un nivel completo a partir de su configuración.
// La configuración pertenece al LevelManager.
// Los objetos concretos se crean aquí desde sus respectivos módulos.
function loadLevel(level) {
  // Grilla del nivel.
  GRID.set(level.grid);

  // Obstáculos del nivel (obstacles.js).
  obstacles = createObstacles(level.obstacles);

  // Jugador (player.js)
  frog = createPlayer(level.player, lifes);

  // Background (background.js)
  landscape = createBackground(level.background);

  // UI (background.js)
  ui = createUI(level.ui);

  // Puntaje y reloj del nivel (manager.js)
  startLevel(frog);

  // La cámara empieza abajo, donde está el sapo.
  camera.jumpTo(frog);
}


// State Manager.
class StateManager {
  // Transiciones permitidas entre estados.
  // Cada evento recibe el StateManager como parent y devuelve
  // la nueva instancia del estado correspondiente.
  static states = {
    initial: {
      PLAY: (parent) => {
        return new PlayState(parent);
      }
    },
    playing: {
      DIE: (parent) => {
        return new BadEndState(parent);
      },
      WIN: (parent) => {
        // Premio: una vida extra por cada localidad cruzada.
        lifes = min(lifes + 1, MAX_LIFES);
        return new GoodEndState(parent);
      },
      PAUSE: (parent) => {
        return new PauseState(parent);
      }
    },
    win: {
      NEXT: (parent) => {
        // Después de Sumapaz se vuelve al inicio.
        if (parent.level === LevelManager.LOCALIDADES.length - 1) {
          parent.level = 0;
          resetGame();
          return new InitState(parent);
        }
        parent.level += 1;
        return new PlayState(parent);
      }
    },
    lose: {
      RETRY: (parent) => {
        resetGame();
        return new PlayState(parent);
      }
    },
    pause: {
      INIT: (parent) => {
        parent.level = 0;
        resetGame();
        return new InitState(parent);
      },
      BACK: (parent) => {
        parent.level = max(0, parent.level - 1);
        return new PlayState(parent);
      },
      START: (parent) => {
        return parent.previous;
      }
    }
  };


  constructor() {
    // Nombre del estado actual.
    this.curName = "initial";
    // Nivel actual.
    this.level = 0;
    // Estado anterior.
    this.previous = null;
    // Estado actual.
    this.current = new InitState(this);
  }


  // Cambia de estado utilizando uno de los eventos definidos
  // en StateManager.states.
  change(event) {
    const transitions = StateManager.states[this.curName];
    if (transitions === undefined) {
      return;
    }
    const transition = transitions[event];
    if (transition === undefined) {
      return;
    }
    const nextState = transition(this);
    if (nextState === undefined || nextState === null) {
      return;
    }
    // Guardamos el estado anterior antes de cambiar.
    this.previous = this.current;
    this.current = nextState;
    this.curName = this.getStateName(nextState);
  }

  // Obtiene el nombre asociado a una instancia de State.
  getStateName(stateObject) {
    if (stateObject instanceof InitState) {
      return "initial";
    }
    if (stateObject instanceof PlayState) {
      return "playing";
    }
    if (stateObject instanceof GoodEndState) {
      return "win";
    }
    if (stateObject instanceof BadEndState) {
      return "lose";
    }
    if (stateObject instanceof PauseState) {
      return "pause";
    }
    return "initial";
  }


  // Delegación del renderizado al estado actual.
  draw() {
    if (this.current !== undefined &&
        this.current.draw !== undefined) {
      this.current.draw();
    }
  }


  // Delegación de la entrada al estado actual.
  keyPressed(key) {
    if (this.current !== undefined &&
        this.current.keyPressed !== undefined) {
      this.current.keyPressed(key);
    }
  }
}


// States

// Initial State
class InitState {
  constructor(parent) {
    this.level = parent.level;
  }

  // Renderizado de la pantalla inicial.
  draw() {
    drawInitialUI();
  }

  // Entrada de la pantalla inicial.
  keyPressed(key) {
    if (key === "Enter") {
      state.change("PLAY");
    }
  }
}


// Playing State
class PlayState {
  constructor(parent) {
    this.level = parent.level;
    // Configuración guardada del nivel.
    const level = levelManager.getLevel(this.level);
    loadLevel(level);
  }


  // Renderizado principal del juego.
  draw() {
    camera.follow(frog);

    // Mundo (se mueve con la cámara).
    camera.begin();

    landscape.update();
    landscape.draw();

    for (const obstacle of obstacles) {
      obstacle.update();
      if (camera.isVisible(obstacle.y, obstacle.height)) {
        obstacle.draw();
      }
    }

    frog.update();
    frog.draw();

    camera.end();

    // Colisiones (manager.js)
    const result = manageCollisions(frog, obstacles);

    if (result === "DIE") {
      state.change("DIE");
    }

    if (result === "WIN") {
      state.change("WIN");
    }

    // UI (fija en la pantalla, no se mueve con la cámara)
    for (const element of ui) {
      element.update();
      element.draw();
    }
  }

  // Entrada durante la partida.
  keyPressed(key) {
    // Movimiento del jugador (player.js).
    frog.keyPressed(key);

    // Pausa general del juego.
    if (key === "p" || key === "P") {
      state.change("PAUSE");
    }
  }
}


// Win State
class GoodEndState {
  constructor(parent) {
    this.level = parent.level;
  }

  // Renderizado de la pantalla de victoria.
  draw() {
    win(this.level);
  }

  // Entrada de la pantalla de victoria.
  keyPressed(key) {
    if (key === "Enter") {
      state.change("NEXT");
    }
  }
}


// Lose State
class BadEndState {
  constructor(parent) {
    this.level = parent.level;
  }

  // Renderizado de la pantalla de derrota.
  draw() {
    lose(this.level);
  }

  // Entrada de la pantalla de derrota.
  keyPressed(key) {
    if (key === "Enter") {
      state.change("RETRY");
    }
  }
}


// Pause State
class PauseState {
  constructor(parent) {
    this.level = parent.level;
  }

  // Renderizado de la pantalla de pausa.
  draw() {

    // El juego que estaba debajo, quieto.
    camera.begin();
    landscape.draw();
    for (const obstacle of obstacles) {
      if (camera.isVisible(obstacle.y, obstacle.height)) {
        obstacle.draw();
      }
    }
    frog.draw();
    camera.end();

    for (const element of ui) {
      element.draw();
    }

    // UI de pausa (manager.js).
    pause();
  }

  // Entrada durante la pausa.
  keyPressed(key) {

    if (key === "p" || key === "P") {
      state.change("START");
    }

    // Reiniciar desde el principio.
    if (key === "r" || key === "R") {
      state.change("INIT");
    }

    // Volver a la localidad anterior.
    if (key === "b" || key === "B") {
      state.change("BACK");
    }
  }
}


// Level Manager
class LevelManager {
  // Las 20 localidades de Bogotá, en orden oficial.
  //   team:    hinchada (norte: Santa Fe, centro: Equidad, sur: Millonarios)
  //   rivers:  ríos y quebradas que la atraviesan
  //   road, river, park: qué tanto hay de cada cosa (más = más filas)
  //   people:  cuántos peatones hay por andén
  //   troncal: si pasa TransMilenio
  //   theme:   paleta de colores del escenario
  static LOCALIDADES = [
    { name: "Usaquén", team: "santafe", rivers: ["Canal Torca", "Canal Córdoba"],
      road: 3, river: 1, park: 2, people: 2, troncal: true, theme: "day" },
    { name: "Chapinero", team: "santafe", rivers: ["Quebrada La Vieja", "Río Arzobispo"],
      road: 4, river: 1, park: 1, people: 3, troncal: true, theme: "day" },
    { name: "Santa Fe", team: "equidad", rivers: ["Río San Francisco", "Río Arzobispo"],
      road: 3, river: 1, park: 2, people: 3, troncal: true, theme: "colonial" },
    { name: "San Cristóbal", team: "millonarios", rivers: ["Río Fucha", "Quebrada Chiguaza"],
      road: 2, river: 2, park: 2, people: 2, troncal: false, theme: "cloudy" },
    { name: "Usme", team: "millonarios", rivers: ["Río Tunjuelo", "Quebrada Yomasa"],
      road: 1, river: 2, park: 3, people: 1, troncal: true, theme: "paramo" },
    { name: "Tunjuelito", team: "millonarios", rivers: ["Río Tunjuelo"],
      road: 2, river: 2, park: 1, people: 2, troncal: true, theme: "cloudy" },
    { name: "Bosa", team: "millonarios", rivers: ["Río Tunjuelo", "Río Bogotá"],
      road: 2, river: 3, park: 1, people: 2, troncal: true, theme: "sunset" },
    { name: "Kennedy", team: "equidad", rivers: ["Río Fucha", "Río Tunjuelo", "Río Bogotá"],
      road: 4, river: 2, park: 1, people: 3, troncal: true, theme: "sunset" },
    { name: "Fontibón", team: "santafe", rivers: ["Río Fucha", "Río Bogotá"],
      road: 3, river: 2, park: 1, people: 2, troncal: true, theme: "day" },
    { name: "Engativá", team: "santafe", rivers: ["Río Juan Amarillo", "Río Bogotá", "Humedal Jaboque"],
      road: 3, river: 2, park: 2, people: 2, troncal: true, theme: "day" },
    { name: "Suba", team: "santafe", rivers: ["Río Juan Amarillo", "Humedal La Conejera", "Río Bogotá"],
      road: 3, river: 2, park: 2, people: 2, troncal: true, theme: "sunset" },
    { name: "Barrios Unidos", team: "santafe", rivers: ["Canal Salitre"],
      road: 3, river: 1, park: 3, people: 2, troncal: true, theme: "cloudy" },
    { name: "Teusaquillo", team: "santafe", rivers: ["Río Arzobispo"],
      road: 2, river: 1, park: 4, people: 2, troncal: true, theme: "day" },
    { name: "Los Mártires", team: "equidad", rivers: [],
      road: 5, river: 0, park: 1, people: 4, troncal: true, theme: "night" },
    { name: "Antonio Nariño", team: "equidad", rivers: ["Río Fucha"],
      road: 3, river: 1, park: 1, people: 3, troncal: true, theme: "cloudy" },
    { name: "Puente Aranda", team: "equidad", rivers: ["Río Fucha"],
      road: 5, river: 1, park: 0, people: 2, troncal: true, theme: "night" },
    { name: "La Candelaria", team: "equidad", rivers: ["Río San Francisco"],
      road: 2, river: 1, park: 1, people: 4, troncal: true, theme: "colonial" },
    { name: "Rafael Uribe Uribe", team: "millonarios", rivers: ["Quebrada Chiguaza"],
      road: 3, river: 1, park: 1, people: 3, troncal: true, theme: "sunset" },
    { name: "Ciudad Bolívar", team: "millonarios", rivers: ["Río Tunjuelo", "Quebrada Limas"],
      road: 2, river: 2, park: 2, people: 3, troncal: true, theme: "night" },
    { name: "Sumapaz", team: "millonarios", rivers: ["Río Sumapaz", "Río Tunjuelo"],
      road: 1, river: 3, park: 4, people: 1, troncal: false, theme: "paramo" }
  ];

  // Tipos de peatón que se ven en los andenes.
  static PEOPLE = ["oficinista", "estudiante", "sombrilla", "vendedor", "habitante", "perro"];

  // Configuraciones de niveles ya generadas.
  // Se almacenan los "generadores" y no los objetos.
  static levels = [];

  constructor() {
    this.current = 0;
    this.levels = LevelManager.levels;
  }

  // Obtiene la configuración de un nivel.
  // Si todavía no existe, genera todos los niveles necesarios
  // hasta llegar al solicitado.
  getLevel(i) {
    while (i >= this.levels.length) {
      this.generateLevel(this.levels.length);
    }
    this.current = i;
    return this.levels[i];
  }

  // Genera y guarda un nuevo nivel (number va de 0 a 19).
  generateLevel(number) {
    const loc = LevelManager.LOCALIDADES[number];
    const grid = this.generateGridConfig(number, loc);

    const level = {
      number: number,
      // Configuración de la grilla.
      grid: grid,
      // Configuración de obstáculos.
      obstacles: this.generateObstacleConfig(number, loc, grid),
      // Configuración del jugador (player.js).
      player: {
        x: 0.5,
        team: loc.team
      },
      // Configuración del background (background.js).
      background: {
        theme: loc.theme
      },
      // Configuración de la UI (background.js).
      ui: {
        number: number,
        name: loc.name,
        team: loc.team,
        rivers: loc.rivers
      }
    };

    this.levels.push(level);
    return level;
  }

  // Elige el tipo del siguiente bloque según qué tanto hay de cada
  // cosa en la localidad. No repite el bloque anterior (salvo que no
  // haya otra opción).
  pickBlockType(loc, lastType) {
    const options = [];

    for (let k = 0; k < loc.road; k++) options.push("road");
    for (let k = 0; k < loc.river; k++) options.push("river");
    for (let k = 0; k < loc.park; k++) options.push("park");

    const different = options.filter((type) => type !== lastType);
    if (different.length > 0) {
      return random(different);
    }
    return random(options);
  }

  // Generación procedimental de la estructura de la grilla.
  // - Fila 0: meta. Última fila: inicio.
  // - En medio, bloques de carretera, río o parque según la localidad.
  // - Después de cada bloque de carretera o río va un andén.
  // - Las localidades más altas tienen más filas y bloques más largos.
  generateGridConfig(number, loc) {
    const rows = 14 + floor(number * 0.8);       // de 14 a 29 filas
    const maxBlock = 2 + floor(number / 7);      // de 2 a 4 filas seguidas

    const river = [];
    const road = [];
    const park = [];
    const median = [];
    const riverNames = {};

    let row = 1;
    let remainingRows = rows - 2;
    let lastType = "";
    let riverCount = 0;

    while (remainingRows > 0) {

      // Si queda una sola fila, se vuelve andén.
      if (remainingRows === 1) {
        median.push(row);
        row++;
        remainingRows--;
        continue;
      }

      const type = this.pickBlockType(loc, lastType);

      // Tamaño del bloque (nunca más de las filas que quedan).
      let size = floor(random(1, maxBlock + 1));
      if (type === "park") {
        size = floor(random(1, 3));
      }
      size = min(size, remainingRows);

      for (let k = 0; k < size; k++) {
        if (type === "road") {
          road.push(row);
        } else if (type === "river") {
          river.push(row);
          riverNames[row] = loc.rivers[riverCount % loc.rivers.length];
        } else {
          park.push(row);
        }
        row++;
      }
      remainingRows -= size;

      if (type === "river") {
        riverCount++;
      }

      // Andén después de carretera o río.
      if (remainingRows > 0 && type !== "park") {
        median.push(row);
        row++;
        remainingRows--;
      }

      lastType = type;
    }

    return {
      ROWS: rows,
      GOAL: [0],
      RIVER: river,
      MEDIAN: median,
      ROAD: road,
      PARK: park,
      START: [rows - 1],
      RIVER_NAMES: riverNames
    };
  }

  // Generación procedimental de la configuración de obstáculos.
  // La dificultad sube poco a poco con el número de la localidad.
  generateObstacleConfig(number, loc, grid) {
    const speedFactor = 1 + 0.04 * number;        // de 1.0 a 1.76
    const extra = floor(number / 6);              // de 0 a 3 obstáculos más
    const logShrink = floor(number / 8);          // troncos más cortos
    const logSizes = ["small", "medium", "long"];

    const result = [];

    // Ríos: troncos.
    for (const row of grid.RIVER) {
      const k = floor(random(3));
      result.push({
        row: row,
        type: "log",
        size: logSizes[max(0, k - logShrink)],
        dir: random([-1, 1]),
        speed: random(0.05, 0.10) * speedFactor,
        count: floor(random(2, 5))
      });
    }

    // Carreteras: Spark GT, taxis, motos, buses y TransMilenio.
    for (const row of grid.ROAD) {
      const vehicles = ["spark", "spark", "spark", "moto", "bus"];
      if (number >= 6) {
        vehicles.push("moto");             // más motos en el sur
      }
      if (loc.troncal) {
        vehicles.push("transmilenio");
      }

      const cfg = {
        row: row,
        type: random(vehicles),
        dir: random([-1, 1])
      };

      if (cfg.type === "spark") {
        cfg.color = random(["rojo", "blanco", "gris", "azul", "taxi", "taxi"]);
        cfg.speed = random(0.06, 0.11);
        cfg.count = floor(random(2, 4)) + extra;
      } else if (cfg.type === "moto") {
        cfg.color = random(["roja", "negra", "azul"]);
        cfg.speed = random(0.14, 0.22);
        cfg.count = 1 + floor(extra / 2);
      } else if (cfg.type === "bus") {
        cfg.speed = random(0.04, 0.07);
        cfg.count = 1 + floor(extra / 2);
      } else {
        cfg.speed = random(0.05, 0.08);
        cfg.count = 1;
      }

      cfg.speed *= speedFactor;
      result.push(cfg);
    }

    // Parques: ciclistas por la ciclorruta.
    for (const row of grid.PARK) {
      result.push({
        row: row,
        type: "cyclist",
        dir: random([-1, 1]),
        speed: random(0.07, 0.11) * speedFactor,
        count: 1 + floor(number / 7)
      });
    }

    // Andenes: peatones.
    for (const row of grid.MEDIAN) {
      result.push({
        row: row,
        type: "people",
        kinds: LevelManager.PEOPLE,
        dir: random([-1, 1]),
        speed: random(0.02, 0.04),
        count: loc.people
      });
    }

    return result;
  }
}
