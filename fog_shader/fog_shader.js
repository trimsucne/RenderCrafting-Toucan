// Fog Shader
// [Inserte Nombre de Equipo]
// Depth behavior using gl_FragCoord.z and the hint article.

const FOV = Math.PI / 3;      // 60 degrees
const Z_NEAR = 1;
const Z_FAR = 2000;
const NUM_CUBES = 40;
const FOG_COLOR = [0.8, 0.9, 1, 1];

let fogSh, imgTexture;
let sliders = {};

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();

  fogSh = createShader(vert, fogFrag);
  imgTexture = loadImage("texture.png");  // From inspecting the site

  buildUI();
}

function draw() {
  const fogNear = sliders.fogNear.value();
  const fogFar  = sliders.fogFar.value();
  const xOff    = sliders.xOff.value();
  const zOff    = sliders.zOff.value();

  // Clear to the fog color (and depth buffer)
  background(FOG_COLOR[0] * 255, FOG_COLOR[1] * 255, FOG_COLOR[2] * 255);

  // Camera/projection similar to the original
  perspective(FOV, width / height, Z_NEAR, Z_FAR);
  camera(0, 0, 2,  0, 0, 0,  0, 1, 0);

  shader(fogSh);
  fogSh.setUniform("sTexture", imgTexture);
  fogSh.setUniform("uFogColor", FOG_COLOR);
  fogSh.setUniform("uFogNear", fogNear);
  fogSh.setUniform("uFogFar", fogFar);

  const t = millis() / 1000;
  const rx = t * 1.2;
  const ry = t * 0.9;

  for (let i = 0; i <= NUM_CUBES; i++) {
    push();
    translate(-2 + i * xOff, 0, -i * zOff);
    rotateX(rx + i * 0.1);
    rotateY(ry + i * 0.1);
    box(1);
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Helper for HTML sliders
function buildUI() {
  const ui = createDiv();
  ui.id("ui");

  const defs = [
    { key: "fogNear", label: "fogNear", min: 0, max: 1,   value: 0.9, step: 0.001 },
    { key: "fogFar",  label: "fogFar",  min: 0, max: 1,   value: 1.0, step: 0.001 },
    { key: "xOff",    label: "xOff",    min: 0, max: 2,   value: 1.1, step: 0.01 },
    { key: "zOff",    label: "zOff",    min: 0, max: 2,   value: 1.4, step: 0.01 },
  ];

  for (const d of defs) {
    const row = createDiv().parent(ui).addClass("row");
    createSpan(d.label).parent(row).addClass("label");
    const s = createSlider(d.min, d.max, d.value, d.step).parent(row);
    const v = createSpan(d.value.toFixed(3)).parent(row).addClass("value");
    s.input(() => v.html(s.value().toFixed(3)));
    sliders[d.key] = s;
  }
}

// Shaders

const vert = `
  precision highp float;

  attribute vec3 aPosition;
  attribute vec2 aTexCoord;

  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;

  varying vec2 vTexCoord;

  void main(){
    vTexCoord = aTexCoord;
    gl_Position = uProjectionMatrix
      * uModelViewMatrix
      * vec4(aPosition, 1.0);
  }
`;

const fogFrag = `
  precision highp float;

  varying vec2 vTexCoord;

  uniform sampler2D sTexture;
  uniform vec4 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  void main(){
    vec4 color = texture2D(sTexture, vTexCoord);

    // Window-space depth (0...1)
    float fogAmount = smoothstep(uFogNear, uFogFar, gl_FragCoord.z);

    gl_FragColor = mix(color, uFogColor, fogAmount);
  }
`;
