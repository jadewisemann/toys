const typeField = document.getElementById("typeField");
const glyphs = [];
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

const clamp = (min, value, max) => Math.min(Math.max(value, min), max);
const lerp = (from, to, amount) => from + (to - from) * amount;
const rounded = (value) => Math.round(value);
const precise = (value) => Number(value.toFixed(2));
const smoothstep = (value) => value * value * (3 - 2 * value);
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

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
  const fragment = document.createDocumentFragment();

  const rows = Math.max(20, Math.ceil(window.innerHeight / 42) + 10);
  const columns = Math.max(34, Math.ceil(window.innerWidth / 34));

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const token = pick(glyphBank);
      const span = document.createElement("span");
      span.className = "glyph";
      span.textContent = token;
      fragment.appendChild(span);
      glyphs.push({ element: span, x: 0, y: 0 });
    }
  }

  typeField.replaceChildren(fragment);
  measureGlyphs();
}

function measureGlyphs() {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  glyphs.forEach((glyph) => {
    const rect = glyph.element.getBoundingClientRect();
    glyph.x = rect.left + rect.width / 2 + scrollX;
    glyph.y = rect.top + rect.height / 2 + scrollY;
  });
}

function setPointer(event) {
  pointer.targetX = event.clientX;
  pointer.targetY = event.clientY;
  pointer.visible = true;
  orb.classList.add("is-visible");
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

  glyphs.forEach((glyph) => {
    const distance = Math.hypot(glyph.x - px, glyph.y - py);

    if (!pointer.visible || distance > radius) {
      glyph.element.style.setProperty("--glyph_weight", 100);
      glyph.element.style.setProperty("--heat-mix", "66%");
      return;
    }

    const centerPull = 1 - distance / radius;
    // const detailPull = smoothstep(centerPull);
    const detailPull = Math.sqrt(centerPull);
    const weight = clamp(
      100,
      100 + detailPull * (360 + inverseDiameterBoost * 240),
      700,
    );

    glyph.element.style.setProperty("--glyph_weight", precise(weight));
    glyph.element.style.setProperty(
      "--heat-mix",
      `${precise(66 + detailPull * 34)}%`,
    );
  });
}

function animate() {
  pointer.x = lerp(pointer.x, pointer.targetX, 0.24);
  pointer.y = lerp(pointer.y, pointer.targetY, 0.24);
  pointer.diameter = lerp(pointer.diameter, pointer.targetDiameter, 0.2);

  orb.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate3d(-50%, -50%, 0)`;
  orb.style.width = `${pointer.diameter}px`;
  orb.style.height = `${pointer.diameter}px`;

  updateGlyphs();
  requestAnimationFrame(animate);
}

buildGlyphs();
animate();

if (document.fonts) {
  document.fonts.ready.then(measureGlyphs);
}

window.addEventListener("pointermove", setPointer);
window.addEventListener("pointerleave", () => {
  pointer.visible = false;
  orb.classList.remove("is-visible");
});

window.addEventListener(
  "wheel",
  (event) => {
    setPointer(event);
    setDiameter(event.deltaY > 0 ? 18 : -18);
  },
  { passive: true },
);

window.addEventListener("pointerdown", (event) => {
  setPointer(event);
  setDiameter(-42);
});

window.addEventListener("pointerup", () => {
  setDiameter(24);
});

const handleResie = debounce(() => {
  pointer.targetX = Math.min(pointer.targetX, windox.innerWidth);
  pointer.targetY = Math.min(pointer.targetY, windox.innerHeight);

  typeField.style.opacity = 0;

  setTimeout(() => {
    buildGlyphs();
    typeField.style.opacity = "1";
  }, 300);
}, 250);

window.addEventListener("resize", handleResize);
