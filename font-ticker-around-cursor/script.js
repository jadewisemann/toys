const typeField = document.getElementById("typeField");
const glyphs = [];
const buckets = new Map();
const activeGlyphs = new Set();
const orb = document.getElementById("cursorOrb");

const glyphBank = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."0123456789",
  ..."+-*/=%!?:;.,_~#@$&|^<>[]{}()",
];

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  targetX: window.innerWidth / 2,
  targetY: window.innerHeight / 2,
  visible: false,
  diameter: 180,
  targetDiameter: 180,
};

let animationFrame = 0;
let running = false;

const clamp = (min, value, max) => Math.min(Math.max(value, min), max);
const lerp = (from, to, amount) => from + (to - from) * amount;
const rounded = (value) => Math.round(value);
const quantize = (value, step) => Math.round(value / step) * step;
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const bucketSize = 96;

function bucketKey(row, column) {
  return `${row}:${column}`;
}

function addToBucket(glyph) {
  const row = Math.floor(glyph.y / bucketSize);
  const column = Math.floor(glyph.x / bucketSize);
  const key = bucketKey(row, column);

  if (!buckets.has(key)) {
    buckets.set(key, []);
  }

  buckets.get(key).push(glyph);
}

function setGlyphStyle(glyph, weight, heatMix) {
  if (glyph.weight === weight && glyph.heatMix === heatMix) {
    return;
  }

  glyph.weight = weight;
  glyph.heatMix = heatMix;
  glyph.element.style.setProperty("--glyph-weight", weight);
  glyph.element.style.setProperty("--heat-mix", `${heatMix}%`);
}

function resetGlyph(glyph) {
  setGlyphStyle(glyph, 100, 66);
}

let seed = 9247;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function buildGlyphs() {
  glyphs.length = 0;
  buckets.clear();
  activeGlyphs.clear();
  const fragment = document.createDocumentFragment();

  const rows = clamp(20, Math.ceil(window.innerHeight / 42) + 10, 42);
  const columns = clamp(34, Math.ceil(window.innerWidth / 34), 88);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const token = pick(glyphBank);
      const span = document.createElement("span");
      span.className = "glyph";
      span.textContent = token;
      fragment.appendChild(span);
      glyphs.push({ element: span, x: 0, y: 0, weight: 100, heatMix: 66 });
    }
  }

  typeField.replaceChildren(fragment);
  measureGlyphs();
}

function measureGlyphs() {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  buckets.clear();

  glyphs.forEach((glyph) => {
    const rect = glyph.element.getBoundingClientRect();
    glyph.x = rect.left + rect.width / 2 + scrollX;
    glyph.y = rect.top + rect.height / 2 + scrollY;
    addToBucket(glyph);
  });
}

function setPointer(event) {
  pointer.targetX = event.clientX;
  pointer.targetY = event.clientY;
  pointer.visible = true;
  orb.classList.add("is-visible");
}

function clearPointer() {
  pointer.visible = false;
  orb.classList.remove("is-visible");
}

function setDiameter(delta) {
  pointer.targetDiameter = clamp(72, pointer.targetDiameter + delta, 280);
  document.documentElement.style.setProperty(
    "--orb-size",
    `${rounded(pointer.targetDiameter)}px`,
  );
}

function updateGlyphs() {
  const radius = pointer.diameter / 2;
  const inverseDiameterBoost = 1 - (pointer.diameter - 72) / (280 - 72);
  const px = pointer.x + window.scrollX;
  const py = pointer.y + window.scrollY;
  const nextActiveGlyphs = new Set();

  if (!pointer.visible) {
    activeGlyphs.forEach(resetGlyph);
    activeGlyphs.clear();
    return;
  }

  const minColumn = Math.floor((px - radius) / bucketSize);
  const maxColumn = Math.floor((px + radius) / bucketSize);
  const minRow = Math.floor((py - radius) / bucketSize);
  const maxRow = Math.floor((py + radius) / bucketSize);

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const bucket = buckets.get(bucketKey(row, column));

      if (!bucket) {
        continue;
      }

      bucket.forEach((glyph) => {
        const distance = Math.hypot(glyph.x - px, glyph.y - py);

        if (distance > radius) {
          return;
        }

        const centerPull = 1 - distance / radius;
        const detailPull = Math.sqrt(centerPull);
        const weight = quantize(
          clamp(
            100,
            100 + detailPull * (360 + inverseDiameterBoost * 240),
            700,
          ),
          8,
        );
        const heatMix = quantize(66 + detailPull * 34, 2);

        nextActiveGlyphs.add(glyph);
        setGlyphStyle(glyph, weight, heatMix);
      });
    }
  }

  activeGlyphs.forEach((glyph) => {
    if (!nextActiveGlyphs.has(glyph)) {
      resetGlyph(glyph);
    }
  });

  activeGlyphs.clear();
  nextActiveGlyphs.forEach((glyph) => activeGlyphs.add(glyph));
}

function animate() {
  if (!running) {
    return;
  }

  pointer.x = lerp(pointer.x, pointer.targetX, 0.24);
  pointer.y = lerp(pointer.y, pointer.targetY, 0.24);
  pointer.diameter = lerp(pointer.diameter, pointer.targetDiameter, 0.2);

  orb.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate3d(-50%, -50%, 0)`;
  orb.style.width = `${pointer.diameter}px`;
  orb.style.height = `${pointer.diameter}px`;

  updateGlyphs();
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

buildGlyphs();
start();

if (document.fonts) {
  document.fonts.ready.then(measureGlyphs);
}

typeField.addEventListener("pointermove", setPointer);
typeField.addEventListener("pointerenter", setPointer);
typeField.addEventListener("pointerleave", clearPointer);
window.addEventListener("pointerleave", clearPointer);

window.addEventListener(
  "wheel",
  (event) => {
    if (!typeField.contains(event.target)) {
      return;
    }

    setPointer(event);
    setDiameter(event.deltaY > 0 ? 18 : -18);
  },
  { passive: true },
);

window.addEventListener("pointerdown", (event) => {
  if (!typeField.contains(event.target)) {
    return;
  }

  setPointer(event);
  setDiameter(-42);
});

window.addEventListener("pointerup", () => {
  setDiameter(24);
});

const handleResize = debounce(() => {
  pointer.targetX = Math.min(pointer.targetX, window.innerWidth);
  pointer.targetY = Math.min(pointer.targetY, window.innerHeight);

  typeField.style.opacity = 0;

  setTimeout(() => {
    buildGlyphs();
    typeField.style.opacity = "1";
  }, 300);
}, 250);

window.addEventListener("resize", handleResize);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stop();
  } else {
    start();
  }
});
