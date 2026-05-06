const glyphField = document.getElementById("glyphField");
const modeGrid = document.getElementById("modeGrid");
const speedControl = document.getElementById("speedControl");
const speedValue = document.getElementById("speedValue");
const forceControl = document.getElementById("forceControl");
const forceValue = document.getElementById("forceValue");
const scaleControl = document.getElementById("scaleControl");
const scaleValue = document.getElementById("scaleValue");
const softControl = document.getElementById("softControl");
const softValue = document.getElementById("softValue");
const gestureVector = document.getElementById("gestureVector");
const glyphBank = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."0123456789",
  ..."+-*/=%!?:;.,_~#@$&|^<>[]{}()",
];

const glyphs = [];
const modes = [
  { id: "tide", label: "tide" },
  { id: "ripple", label: "ripple" },
  { id: "scan", label: "scan" },
  { id: "storm", label: "storm" },
];

const settings = {
  mode: "tide",
  speed: 0.6,
  targetSpeed: 0.6,
};

const modeParams = {
  tide: { force: 1, scale: 1, soft: 1 },
  ripple: { force: 1, scale: 1, soft: 1 },
  scan: { force: 1, scale: 1, soft: 1 },
  storm: { force: 1, scale: 1, soft: 1 },
};

const liveParams = {
  force: 1,
  scale: 1,
  soft: 1,
};

const scanDirection = {
  x: 0.78,
  y: 0.52,
};

let scanDragStart = null;

const bursts = [];
const burstDurationByMode = {
  ripple: 4.8,
};

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

const clamp = (min, value, max) => Math.min(Math.max(value, min), max);
const lerp = (from, to, amount) => from + (to - from) * amount;
const quantize = (value, step) => Math.round(value / step) * step;
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const rebuildField = debounce(() => {
  buildField();
}, 180);

let seed = 31817;
let animationFrame = 0;
let lastFrameTime = 0;
let running = false;
let fieldColumns = 1;
let fieldRows = 1;
let fieldWidth = window.innerWidth;
let fieldHeight = window.innerHeight;
let modeStartedAt = performance.now() * 0.001;
let modeClock = 0;
let lastSeconds = modeStartedAt;
let playRate = 1;
let targetPlayRate = 1;

function buildControls() {
  modeGrid.replaceChildren(
    ...modes.map((mode) => {
      const button = document.createElement("button");
      button.className = "mode-button";
      button.type = "button";
      button.textContent = mode.label;
      button.dataset.mode = mode.id;
      button.setAttribute("aria-pressed", String(mode.id === settings.mode));
      button.classList.toggle("is-active", mode.id === settings.mode);
      return button;
    }),
  );
}

function setMode(mode) {
  if (settings.mode === mode) {
    return;
  }

  settings.mode = mode;
  modeStartedAt = performance.now() * 0.001;
  modeClock = 0;
  lastSeconds = modeStartedAt;
  targetPlayRate = 1;
  bursts.length = 0;
  scanDragStart = null;
  hideGestureVector();

  modeGrid.querySelectorAll(".mode-button").forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  syncParamControls();
  document.documentElement.style.setProperty(
    "--weight-transition",
    mode === "ripple" ? "180ms" : "80ms",
  );
  paintStaticField();
}

function setSpeed(value) {
  settings.targetSpeed = Number(value);
  speedValue.textContent = `${settings.targetSpeed.toFixed(1)}x`;
}

function setModeParam(name, value) {
  modeParams[settings.mode][name] = Number(value);
  syncParamLabels();
}

function syncParamLabels() {
  const params = modeParams[settings.mode];
  forceValue.textContent = params.force.toFixed(1);
  scaleValue.textContent = params.scale.toFixed(1);
  softValue.textContent = params.soft.toFixed(1);
}

function syncParamControls() {
  const params = modeParams[settings.mode];
  forceControl.value = params.force;
  scaleControl.value = params.scale;
  softControl.value = params.soft;
  syncParamLabels();
}

function updateLiveSettings() {
  const target = modeParams[settings.mode];
  settings.speed = lerp(settings.speed, settings.targetSpeed, 0.055);
  liveParams.force = lerp(liveParams.force, target.force, 0.065);
  liveParams.scale = lerp(liveParams.scale, target.scale, 0.065);
  liveParams.soft = lerp(liveParams.soft, target.soft, 0.065);
  playRate = lerp(playRate, targetPlayRate, 0.08);
}

function hashNoise(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);

  const n00 = hashNoise(x0, y0);
  const n10 = hashNoise(x0 + 1, y0);
  const n01 = hashNoise(x0, y0 + 1);
  const n11 = hashNoise(x0 + 1, y0 + 1);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;

  return nx0 + (nx1 - nx0) * sy;
}

function signedNoise(x, y) {
  return smoothNoise(x, y) * 2 - 1;
}

function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function setGlyphStyle(glyph, weight) {
  if (glyph.weight === weight) {
    return;
  }

  glyph.weight = weight;

  glyph.element.style.fontWeight = String(weight);
  glyph.element.style.fontVariationSettings = `"wght" ${weight}`;
}

function buildField() {
  seed = 31817;
  glyphs.length = 0;

  const fragment = document.createDocumentFragment();
  const isSmall = window.innerWidth < 720;
  const rect = glyphField.getBoundingClientRect();
  fieldWidth = Math.max(1, rect.width);
  fieldHeight = Math.max(1, rect.height);

  const fontSize = isSmall ? 17 : clamp(16, fieldWidth * 0.0155, 26);
  const cellWidth = fontSize * 0.72;
  const cellHeight = fontSize;
  const columns = clamp(
    32,
    Math.ceil(fieldWidth / cellWidth) + 2,
    140,
  );
  const rows = clamp(
    24,
    Math.ceil(fieldHeight / cellHeight) + 2,
    isSmall ? 64 : 90,
  );

  fieldColumns = columns;
  fieldRows = rows;

  glyphField.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  glyphField.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const span = document.createElement("span");
      span.className = "glyph";
      span.textContent = pick(glyphBank);
      fragment.appendChild(span);
      glyphs.push({
        element: span,
        row: rowIndex,
        column: columnIndex,
        weight: 120,
      });
    }
  }

  glyphField.replaceChildren(fragment);
  paintStaticField();
}

function paintStaticField() {
  glyphs.forEach((glyph) => {
    const base = Math.sin(glyph.column * 0.45 + glyph.row * 0.82);
    const weight = quantize(340 + base * 210, 20);
    setGlyphStyle(glyph, weight);
  });
}

function calculateWave(glyph, seconds, motionScale) {
  const x = glyph.column / Math.max(1, fieldColumns - 1);
  const y = glyph.row / Math.max(1, fieldRows - 1);
  const localTime = modeClock * settings.speed * motionScale;
  const force = liveParams.force;
  const scale = liveParams.scale;
  const soft = liveParams.soft;
  const drift = signedNoise(x * 3.2 + localTime * 0.08, y * 2.8 - localTime * 0.06);
  const grain = signedNoise(glyph.column * 0.38 + localTime * 0.34, glyph.row * 0.38);

  if (settings.mode === "ripple") {
    return -1 + calculateRippleBursts(x, y, seconds, force, scale, soft) * 2;
  }

  if (settings.mode === "scan") {
    const directionLength = Math.hypot(scanDirection.x, scanDirection.y) || 1;
    const dirX = scanDirection.x / directionLength;
    const dirY = scanDirection.y / directionLength;
    const axis =
      x * dirX +
      y * dirY +
      signedNoise(x * 2.4, y * 2.4 + localTime * 0.12) * 0.055 * soft;
    const phase = axis - localTime * 0.22;
    const wrapped = phase - Math.floor(phase);
    const distance = Math.min(wrapped, 1 - wrapped);
    const sigma =
      (0.15 + signedNoise(x * 1.6 + 10, y * 1.6 - localTime * 0.1) * 0.025) *
      soft;
    const gaussian = Math.exp(-0.5 * (distance / sigma) ** 2);
    const undertow =
      Math.sin(localTime * 1.4 + axis * 9 * scale + drift * 1.1) * 0.22 +
      Math.sin(localTime * 2.3 + y * 13 * scale) * 0.09;
    return clamp(
      -1,
      (gaussian * 2 -
        1 +
        undertow +
        grain * 0.1) *
        force,
      1,
    );
  }

  if (settings.mode === "storm") {
    const cross = Math.sin(localTime * 4.2 + glyph.column * 0.72 * scale);
    const vertical = Math.cos(localTime * 3.4 + glyph.row * 1.1 * scale);
    const diagonal = Math.sin(
      localTime * 2.6 + (glyph.column - glyph.row) * 0.48 * scale,
    );
    const chop =
      signedNoise(glyph.column * 0.7 * scale + localTime * 0.9, glyph.row * 0.7) *
      0.28 *
      soft;
    return clamp(
      -1,
      ((cross * 0.42 + vertical * 0.36 + diagonal * 0.5) / 1.28 + chop) *
        force,
      1,
    );
  }

  const columnWave = Math.sin(
    localTime * 2.4 + glyph.column * 0.42 * scale + drift * 0.9 * soft,
  );
  const rowWave = Math.cos(
    localTime * 1.7 + glyph.row * 0.64 * scale + grain * 0.4 * soft,
  );
  const diagonalWave = Math.sin(
    localTime * 1.15 + (glyph.column + glyph.row) * 0.24 * scale + drift * 1.2,
  );
  const swell = Math.sin(localTime * 0.62 + x * 5.4 * scale - y * 2.8) * 0.26;

  return clamp(
    -1,
    ((columnWave + rowWave + diagonalWave) / 3 +
      swell +
      grain * 0.12 * soft) *
      force,
    1,
  );
}

function calculateRippleBursts(x, y, seconds, force, scale, soft) {
  let value = 0;

  bursts.forEach((burst) => {
    const age = (seconds - burst.startedAt) * settings.speed;
    const duration = burstDurationByMode[burst.mode] ?? 3;

    if (age < 0 || age > duration) {
      return;
    }

    const dx = (x - burst.x) * fieldWidth;
    const dy = (y - burst.y) * fieldHeight;
    const distance = Math.hypot(dx, dy) / Math.min(fieldWidth, fieldHeight);
    const progress = age / duration;
    const travel = 1 - (1 - progress) ** 2.35;
    const crestRadius = travel * 1.35 * scale;
    const ringWidth = (0.07 + progress * 0.05) * soft;
    const ring = Math.exp(-0.5 * ((distance - crestRadius) / ringWidth) ** 2);
    const fade = (1 - progress) ** 2.2;
    const distanceFade = Math.exp(-distance * 0.85);
    const wake =
      Math.exp(-0.5 * ((distance - crestRadius * 0.72) / (ringWidth * 2.4)) ** 2) *
      0.28;
    const envelope = fade * distanceFade;
    value += (ring + wake) * envelope * force;
  });

  return clamp(0, value, 1);
}

function cleanupBursts(seconds) {
  for (let index = bursts.length - 1; index >= 0; index -= 1) {
    const burst = bursts[index];
    const duration = burstDurationByMode[burst.mode] ?? 3;

    if (seconds - burst.startedAt > duration) {
      bursts.splice(index, 1);
    }
  }
}

function updateGestureVector(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  gestureVector.classList.add("is-visible");
  gestureVector.style.width = `${Math.max(1, length)}px`;
  gestureVector.style.transform = `translate3d(${start.x}px, ${start.y}px, 0) rotate(${angle}rad)`;
}

function hideGestureVector(delay = 0) {
  window.setTimeout(() => {
    gestureVector.classList.remove("is-visible");
  }, delay);
}

function updateWave(time) {
  const seconds = time * 0.001;
  const motionScale = prefersReducedMotion.matches ? 0.28 : 1;
  const deltaSeconds = Math.min(0.08, Math.max(0, seconds - lastSeconds));

  updateLiveSettings();
  modeClock += deltaSeconds * playRate;
  lastSeconds = seconds;
  cleanupBursts(seconds);

  glyphs.forEach((glyph) => {
    const wave = calculateWave(glyph, seconds, motionScale);
    const normalized = (wave + 1) / 2;
    const step = settings.mode === "ripple" ? 4 : 20;
    const weight = quantize(100 + normalized * 600, step);
    setGlyphStyle(glyph, weight);
  });
}

function animate(time) {
  if (!running) {
    return;
  }

  if (time - lastFrameTime > 24) {
    updateWave(time);
    lastFrameTime = time;
  }

  animationFrame = requestAnimationFrame(animate);
}

function start() {
  if (running) {
    return;
  }

  running = true;
  animationFrame = requestAnimationFrame(animate);
}

function stop() {
  running = false;
  cancelAnimationFrame(animationFrame);
}

buildControls();
buildField();
setSpeed(speedControl.value);
syncParamControls();
start();

modeGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".mode-button");

  if (!button) {
    return;
  }

  setMode(button.dataset.mode);
});

speedControl.addEventListener("input", (event) => {
  setSpeed(event.target.value);
});

forceControl.addEventListener("input", (event) => {
  setModeParam("force", event.target.value);
});

scaleControl.addEventListener("input", (event) => {
  setModeParam("scale", event.target.value);
});

softControl.addEventListener("input", (event) => {
  setModeParam("soft", event.target.value);
});

glyphField.addEventListener("click", (event) => {
  if (settings.mode !== "ripple") {
    return;
  }

  const rect = glyphField.getBoundingClientRect();
  bursts.push({
    mode: "ripple",
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
    startedAt: performance.now() * 0.001,
    seed: random(),
  });
});

glyphField.addEventListener("pointerdown", (event) => {
  if (settings.mode !== "scan") {
    return;
  }

  targetPlayRate = 0;
  scanDragStart = {
    x: event.clientX,
    y: event.clientY,
  };
  updateGestureVector(scanDragStart, scanDragStart);
  glyphField.setPointerCapture(event.pointerId);
});

glyphField.addEventListener("pointermove", (event) => {
  if (settings.mode !== "scan" || !scanDragStart) {
    return;
  }

  updateGestureVector(scanDragStart, {
    x: event.clientX,
    y: event.clientY,
  });
});

glyphField.addEventListener("pointerup", (event) => {
  if (settings.mode !== "scan" || !scanDragStart) {
    scanDragStart = null;
    return;
  }

  const dx = event.clientX - scanDragStart.x;
  const dy = event.clientY - scanDragStart.y;
  const length = Math.hypot(dx, dy);
  const start = scanDragStart;
  scanDragStart = null;
  targetPlayRate = 1;

  if (length < 12) {
    hideGestureVector();
    return;
  }

  updateGestureVector(start, {
    x: event.clientX,
    y: event.clientY,
  });
  scanDirection.x = dx / length;
  scanDirection.y = dy / length;
  modeClock = 0;
  lastSeconds = performance.now() * 0.001;
  hideGestureVector(520);
});

glyphField.addEventListener("pointercancel", () => {
  scanDragStart = null;
  targetPlayRate = 1;
  hideGestureVector();
});

window.addEventListener(
  "resize",
  rebuildField,
);

if ("ResizeObserver" in window) {
  const fieldObserver = new ResizeObserver(rebuildField);
  fieldObserver.observe(glyphField);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stop();
  } else {
    start();
  }
});

function handleMotionPreferenceChange() {
  start();
}

if (typeof prefersReducedMotion.addEventListener === "function") {
  prefersReducedMotion.addEventListener("change", handleMotionPreferenceChange);
} else if (typeof prefersReducedMotion.addListener === "function") {
  prefersReducedMotion.addListener(handleMotionPreferenceChange);
}
