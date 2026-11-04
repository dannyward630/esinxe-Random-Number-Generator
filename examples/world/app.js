import {
  createGame,
  stepGame,
  craft,
  place,
  canPlace,
  getWorldPhase,
  getTerrainStatus,
  RECIPES,
  serializeGame,
  restoreGame,
} from "./game.js?v=5";
import { landmarksForSeed, biomeSitesForSeed } from "./expedition.js?v=3";
import { ChunkStream, prove } from "./stream.js?v=3";
import { Renderer } from "./render.js?v=3";
import { interpolatePlayer, edgeLook } from "./spatial.js?v=6";
const $ = (id) => document.getElementById(id);
let canvas = $("world"),
  renderer,
  renderNotice = "";
let preferredView = new URLSearchParams(location.search).get("view");
try {
  preferredView ||= localStorage.getItem("verdant-view");
} catch {}
if (preferredView !== "2d") {
  try {
    const { Renderer3D } = await import("./render3d.js?v=6");
    renderer = new Renderer3D(canvas);
  } catch (error) {
    console.warn("3D view unavailable:", error.message);
    const replacement = canvas.cloneNode(false);
    canvas.replaceWith(replacement);
    canvas = replacement;
    renderNotice =
      "3D could not start on this device. The 2D view is ready; you can retry 3D in Settings.";
  }
}
renderer ||= new Renderer(canvas);
canvas.setAttribute(
  "aria-label",
  renderer.is3D
    ? "Verdant 3D world. WASD moves, Space jumps or swims, Shift dashes, J harvests or strikes, E interacts, R dives. Click the world for mouse-look; Escape releases it. Right-drag or Q and T orbit; wheel zooms."
    : "Verdant 2D world. WASD moves, Space dashes or swims, J harvests or strikes, E interacts, R dives.",
);
$("view-mode").value = renderer.is3D ? "3d" : "2d";
$("render-mode").textContent = renderer.is3D ? "3D ADVENTURE" : "2D VIEW";
$("camera-tools").hidden = !renderer.is3D;
$("jump-action").hidden = !renderer.is3D;
$("render-notice").textContent = renderNotice;
let quality = "balanced";
try {
  quality = localStorage.getItem("verdant-quality") || quality;
} catch {}
$("quality").value = ["low", "balanced", "high"].includes(quality)
  ? quality
  : "balanced";
renderer.setQuality?.($("quality").value);
$("quality").disabled = !renderer.is3D;
if (!renderer.is3D)
  $("view-help").textContent =
    "2D view: WASD moves, Space dashes or swims, J harvests or strikes, E interacts, F eats and R dives. M opens the survey; I / C / L / O open menus.";
const cameraPointers = new Map();
let pinchDistance = 0;
let seed = "42",
  state,
  previousPlayer,
  stream,
  sites,
  biomes,
  paused = false,
  arrival = false,
  hiddenPause = false,
  showMap = false,
  placing = null,
  center = "",
  revision = 0,
  evidence = null;
let pointer = null,
  pointerClient = null,
  placementTouch = false;
let wantsMouseLook = false,
  mouseLocked = false,
  hoverLook = false,
  expectedUnlock = false,
  lastLookPoint = null,
  lastEscapeUnlock = -Infinity;
function canMouseLook() {
  return renderer.is3D && !paused && !pack.open && !showMap && !placing;
}
function mouseLookUI() {
  const active = mouseLocked || hoverLook;
  canvas.dataset.mouseLook = mouseLocked
    ? "locked"
    : hoverLook
      ? "hover"
      : "off";
  $("mouse-look").textContent = active ? "Mouse look on" : "Mouse look";
  $("mouse-look").setAttribute("aria-pressed", String(active));
}
function releaseMouseLook() {
  wantsMouseLook = false;
  hoverLook = false;
  lastLookPoint = null;
  if (document.pointerLockElement === canvas) {
    expectedUnlock = true;
    document.exitPointerLock();
  }
  mouseLookUI();
}
function hoverMouseLook() {
  if (!wantsMouseLook || !canMouseLook() || mouseLocked || hoverLook) return;
  hoverLook = true;
  lastLookPoint = null;
  mouseLookUI();
  message(
    "Mouse look is on. Move to look; hold near an edge to keep turning. Esc pauses.",
  );
}
function requestMouseLook() {
  if (!canMouseLook() || mouseLocked) return;
  wantsMouseLook = true;
  lastLookPoint = null;
  if (!canvas.requestPointerLock) {
    hoverMouseLook();
    return;
  }
  try {
    const pending = canvas.requestPointerLock();
    pending?.catch(hoverMouseLook);
  } catch {
    hoverMouseLook();
  }
}
document.addEventListener("pointerlockerror", hoverMouseLook);
document.addEventListener("pointerlockchange", () => {
  const wasLocked = mouseLocked;
  mouseLocked = document.pointerLockElement === canvas;
  if (mouseLocked && (!wantsMouseLook || !canMouseLook())) {
    releaseMouseLook();
    return;
  }
  if (mouseLocked) hoverLook = false;
  if (wasLocked && !mouseLocked && !expectedUnlock) {
    lastEscapeUnlock = performance.now();
    setPause(true);
  }
  expectedUnlock = false;
  clearInput();
  mouseLookUI();
});
document.addEventListener("mousemove", (event) => {
  if (mouseLocked && canMouseLook())
    renderer.orbit(-event.movementX * 0.003, event.movementY * 0.003);
});
$("mouse-look").onclick = () => {
  if (wantsMouseLook) releaseMouseLook();
  else requestMouseLook();
  canvas.focus();
};
function resize() {
  const bounds = canvas.getBoundingClientRect();
  if (renderer.is3D) {
    renderer.resize(bounds.width, bounds.height);
    return;
  }
  const scale = Math.min(1, 1120 / bounds.width, 960 / bounds.height);
  canvas.width = Math.max(1, Math.round(bounds.width * scale));
  canvas.height = Math.max(1, Math.round(bounds.height * scale));
}
resize();
window.addEventListener("resize", resize);
new ResizeObserver(resize).observe(canvas);
let sound = false,
  audio = null,
  toastUntil = 0,
  keys = new Set(),
  touch = { x: 0, y: 0 },
  actions = {};
const saveKey = () => `verdant-expedition-3:${seed}`;
function message(text) {
  $("toast").textContent = text;
  toastUntil = performance.now() + 4800;
}
function tone(type) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(
      type === "hurt" || type === "damage"
        ? 150
        : type === "discovery"
          ? 720
          : 440,
      audio.currentTime,
    );
    o.frequency.exponentialRampToValueAtTime(220, audio.currentTime + 0.16);
    g.gain.setValueAtTime(0.045, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.2);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.21);
  } catch {
    sound = false;
  }
}
function save() {
  try {
    localStorage.setItem(saveKey(), serializeGame(state));
    $("save-status").textContent = " Saved";
  } catch {
    $("save-status").textContent = " Saving unavailable; play can continue";
  }
}
function start(reset = false) {
  revision++;
  stream?.dispose();
  placing = null;
  center = "";
  keys.clear();
  actions = {};
  touch = { x: 0, y: 0 };
  let saved = null;
  if (!reset)
    try {
      saved =
        restoreGame(localStorage.getItem(saveKey()), seed) ||
        restoreGame(localStorage.getItem(`verdant-expedition-2:${seed}`), seed);
    } catch {}
  state = saved || createGame(seed);
  previousPlayer = { ...state.player };
  sites = landmarksForSeed(seed);
  biomes = biomeSitesForSeed(seed);
  stream = new ChunkStream(
    seed,
    Number($("workers").value),
    $("order").value,
    $("grass").checked,
  );
  message(
    saved
      ? "Welcome back. The island remembers."
      : "You wake beside a broken beacon. Gather supplies, or follow the old trails.",
  );
  load();
  hud();
  journal();
  priorDiscoveries = JSON.stringify([
    state.discoveries,
    state.restored,
    state.finds,
  ]);
}
function world() {
  return {
    tileAt: (x, y) => stream.tileAt(x, y),
    entitiesNear: (x, y, r) => stream.entitiesNear(x, y, r),
    landmarks: sites,
    biomeSites: biomes,
    loaded:
      stream.tileAt(
        Math.floor(state.player.x + 0.5),
        Math.floor(state.player.y + 0.5),
      ) !== undefined,
  };
}
async function load() {
  const ticket = revision;
  center = `${Math.floor(state.player.x / 16)},${Math.floor(state.player.y / 16)}`;
  try {
    await stream.ensureAround(state.player.x, state.player.y);
    if (ticket === revision) hud();
  } catch (error) {
    if (ticket === revision) message(error.message);
  }
}
function setPause(value) {
  if (!value && arrival) {
    arrival = false;
    try {
      localStorage.setItem("verdant-3d-intro", "seen");
    } catch {}
    $("pause-title").textContent = "Take a breath.";
    $("pause-copy").textContent = "The island will wait.";
    $("arrival-controls").hidden = true;
    $("resume").textContent = "Resume expedition";
  }
  cameraPointers.clear();
  pinchDistance = 0;
  fingers.clear();
  paused = value;
  if (value) releaseMouseLook();
  keys.clear();
  touch = { x: 0, y: 0 };
  actions = {};
  $("paused").hidden = !paused;
  $("pause").textContent = paused ? "Resume" : "Pause";
}
$("pause").onclick = () => setPause(!paused);
$("resume").onclick = () => {
  setPause(false);
  canvas.focus();
  if (matchMedia("(pointer: fine)").matches) requestMouseLook();
};
function toggleMap() {
  showMap = !showMap;
  if (showMap) releaseMouseLook();
  clearInput();
  placing = null;
  hud();
  canvas.focus();
}
$("map").onclick = toggleMap;
$("camera-left").onclick = () => {
  renderer.orbit?.(-0.25);
  canvas.focus();
};
$("camera-right").onclick = () => {
  renderer.orbit?.(0.25);
  canvas.focus();
};
$("camera-near").onclick = () => {
  renderer.zoom?.(-1.5);
  canvas.focus();
};
$("camera-far").onclick = () => {
  renderer.zoom?.(1.5);
  canvas.focus();
};
$("camera-home").onclick = () => {
  renderer.resetCamera?.();
  canvas.focus();
};
$("view-mode").onchange = () => {
  save();
  const view = $("view-mode").value;
  try {
    localStorage.setItem("verdant-view", view);
  } catch {}
  const url = new URL(location.href);
  url.searchParams.set("view", view);
  location.assign(url);
};
$("quality").onchange = () => {
  renderer.setQuality?.($("quality").value);
  try {
    localStorage.setItem("verdant-quality", $("quality").value);
  } catch {}
};
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  setPause(true);
  $("render-notice").textContent =
    "3D paused after the graphics context was lost. Select 2D in Settings or reload to retry.";
  message(
    "Graphics paused. Open Settings to switch views, or reload to retry.",
  );
});
canvas.addEventListener("webglcontextrestored", () => location.reload());
$("sound").onclick = () => {
  sound = !sound;
  $("sound").textContent = sound ? "Sound on" : "Sound off";
  $("sound").setAttribute("aria-pressed", String(sound));
  tone("pickup");
};
$("save").onclick = save;
const pack = $("pack");
const panelKeys = { i: "satchel", c: "crafting", l: "journal", o: "settings" };
let activePanel = "satchel";
function clearInput() {
  cameraPointers.clear();
  pinchDistance = 0;
  fingers.clear();
  keys.clear();
  touch = { x: 0, y: 0 };
  actions = {};
}
function openPanel(name, focus = true) {
  activePanel = name;
  showMap = false;
  clearInput();
  placing = null;
  hud();
  for (const tab of document.querySelectorAll("[data-menu-tab]")) {
    const selected = tab.dataset.menuTab === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(`menu-${tab.dataset.menuTab}`).hidden = !selected;
  }
  if (!pack.open) pack.showModal();
  releaseMouseLook();
  for (const button of document.querySelectorAll("[data-open-panel]"))
    button.setAttribute(
      "aria-expanded",
      String(button.dataset.openPanel === name),
    );
  if (focus) $(`tab-${name}`).focus();
}
function closePanel() {
  if (pack.open) pack.close();
}
pack.addEventListener("close", () => {
  if (pack.open) return;
  clearInput();
  for (const button of document.querySelectorAll("[data-open-panel]"))
    button.setAttribute("aria-expanded", "false");
  canvas.focus({ preventScroll: true });
});
$("close-pack").onclick = closePanel;
for (const button of document.querySelectorAll("[data-open-panel]"))
  button.onclick = () => openPanel(button.dataset.openPanel);
for (const tab of document.querySelectorAll("[data-menu-tab]")) {
  tab.onclick = () => openPanel(tab.dataset.menuTab);
  tab.onkeydown = (event) => {
    const names = Object.values(panelKeys);
    const index = names.indexOf(activePanel);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % names.length
        : event.key === "ArrowLeft"
          ? (index + names.length - 1) % names.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? names.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    event.stopPropagation();
    openPanel(names[next]);
  };
}
function inputTarget(event) {
  return ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SUMMARY"].includes(
    event.target.tagName,
  );
}
const moveKeys = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);
const actionKeys = {
  shift: "dash",
  j: "attack",
  e: "interact",
  f: "eat",
  r: "dive",
};
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const k = event.key.toLowerCase();
  const editing = ["INPUT", "SELECT", "TEXTAREA"].includes(
    event.target.tagName,
  );
  if (!editing && panelKeys[k] && !event.repeat) {
    event.preventDefault();
    if (pack.open && activePanel === panelKeys[k]) closePanel();
    else openPanel(panelKeys[k]);
    return;
  }
  if (pack.open || inputTarget(event)) return;
  if (k === "m" && !event.repeat) {
    toggleMap();
    return;
  }
  if (k === "escape" && showMap) {
    toggleMap();
    return;
  }
  if (showMap) return;
  if (k === "escape" && (mouseLocked || hoverLook)) {
    event.preventDefault();
    setPause(true);
    return;
  }
  if (k === "escape" && performance.now() - lastEscapeUnlock < 200) return;
  if (k === "e" && placing && placementTouch && pointer) {
    event.preventDefault();
    if (!event.repeat) commitPlacement(pointer);
    return;
  }
  if (renderer.is3D && ["q", "t", "h", "=", "+", "-"].includes(k)) {
    event.preventDefault();
    if (k === "q") renderer.orbit(-0.12);
    if (k === "t") renderer.orbit(0.12);
    if (k === "h") renderer.resetCamera();
    if (k === "=" || k === "+") renderer.zoom(-0.5);
    if (k === "-") renderer.zoom(0.5);
    return;
  }
  if (k === " ") {
    event.preventDefault();
    if (!event.repeat)
      actions[renderer.is3D && !state.player.swimming ? "jump" : "dash"] = true;
    return;
  }
  if (moveKeys.has(k)) {
    event.preventDefault();
    keys.add(k);
  }
  if (actionKeys[k]) {
    event.preventDefault();
    if (!event.repeat) actions[actionKeys[k]] = true;
  }
  if (k === "escape") {
    placing = null;
    setPause(false);
  }
  if (k === "p" && !event.repeat) setPause(!paused);
});
document.addEventListener("keyup", (event) =>
  keys.delete(event.key.toLowerCase()),
);
window.addEventListener("blur", () => {
  if (mouseLocked || hoverLook) setPause(true);
  cameraPointers.clear();
  pinchDistance = 0;
  fingers.clear();
  keys.clear();
  touch = { x: 0, y: 0 };
  actions = {};
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenPause = paused;
    setPause(true);
    save();
  } else if (!hiddenPause) setPause(false);
});
const fingers = new Map();
const syncFingers = () => {
  touch = { x: 0, y: 0 };
  for (const direction of fingers.values()) {
    touch.x += direction.x;
    touch.y += direction.y;
  }
};
for (const button of document.querySelectorAll("[data-direction]")) {
  button.onpointerdown = (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    const [x, y] = button.dataset.direction.split(",").map(Number);
    fingers.set(event.pointerId, { x, y });
    syncFingers();
  };
  button.onpointerup =
    button.onpointercancel =
    button.onlostpointercapture =
      (event) => {
        fingers.delete(event.pointerId);
        syncFingers();
      };
}
for (const button of document.querySelectorAll("[data-action]"))
  button.onclick = () => {
    const action = button.dataset.action;
    actions[action === "jump" && state.player.swimming ? "dash" : action] =
      true;
    canvas.focus();
  };
function pointerTile(event) {
  if (renderer.is3D) return renderer.pick(event.clientX, event.clientY);
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor(
      renderer.camera.x +
        0.5 +
        ((event.clientX - rect.left - rect.width / 2) * canvas.width) /
          rect.width /
          32,
    ),
    y: Math.floor(
      renderer.camera.y +
        0.5 +
        ((event.clientY - rect.top - rect.height / 2) * canvas.height) /
          rect.height /
          32,
    ),
  };
}
canvas.oncontextmenu = (event) => event.preventDefault();
canvas.onpointermove = (event) => {
  if (mouseLocked) return;
  pointerClient = { x: event.clientX, y: event.clientY };
  if (event.pointerType === "mouse") placementTouch = false;
  if (hoverLook && event.pointerType === "mouse" && canMouseLook()) {
    if (lastLookPoint)
      renderer.orbit(
        -(event.clientX - lastLookPoint.x) * 0.003,
        (event.clientY - lastLookPoint.y) * 0.003,
      );
    lastLookPoint = { x: event.clientX, y: event.clientY };
    return;
  }
  const prior = cameraPointers.get(event.pointerId);
  if (prior && renderer.is3D) {
    cameraPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    renderer.orbit(
      -(event.clientX - prior.x) * 0.006,
      (event.clientY - prior.y) * 0.004,
    );
    if (cameraPointers.size === 2) {
      const [a, b] = [...cameraPointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance) renderer.zoom((pinchDistance - distance) * 0.03);
      pinchDistance = distance;
    }
  }
  pointer = pointerTile(event);
  if (placing && event.pointerType === "touch") hud();
};
canvas.onpointerdown = (event) => {
  canvas.focus();
  if (
    !placing &&
    event.button === 0 &&
    event.pointerType === "mouse" &&
    canMouseLook()
  ) {
    requestMouseLook();
    return;
  }
  if (
    renderer.is3D &&
    !placing &&
    (event.button === 2 || event.pointerType === "touch")
  ) {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    cameraPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    return;
  }
  if (!placing || paused || showMap || event.button === 2) return;
  pointer = pointerTile(event);
  if (!pointer) return;
  if (renderer.is3D && event.pointerType === "touch") {
    event.preventDefault();
    placementTouch = true;
    pointerClient = { x: event.clientX, y: event.clientY };
    hud();
    return;
  }
  commitPlacement(pointer);
};
canvas.onpointerleave = () => {
  lastLookPoint = null;
};
function commitPlacement(point) {
  if (!placing || !point) return;
  const result = place(state, placing, point.x, point.y, world());
  message(result.message);
  if (result.ok) {
    renderer.burst(point.x, point.y);
    placing = null;
    placementTouch = false;
    save();
  }
  hud();
}
$("confirm-place").onclick = () => {
  commitPlacement(pointer);
  canvas.focus();
};
canvas.onpointerup =
  canvas.onpointercancel =
  canvas.onlostpointercapture =
    (event) => {
      cameraPointers.delete(event.pointerId);
      pinchDistance = 0;
    };
canvas.addEventListener(
  "wheel",
  (event) => {
    if (!renderer.is3D || pack.open || showMap) return;
    event.preventDefault();
    renderer.zoom(event.deltaY * 0.012);
  },
  { passive: false },
);
$("cancel-place").onclick = () => {
  placing = null;
  hud();
  canvas.focus();
};
function selectPlacement(kind) {
  releaseMouseLook();
  closePanel();
  showMap = false;
  pointer = null;
  pointerClient = null;
  placementTouch = false;
  placing = kind;
  message(`Place ${kind} within reach: click the ground. Esc cancels.`);
  canvas.focus();
  hud();
}
function hud() {
  const habitat = getTerrainStatus(state, world());
  $("habitat").textContent = habitat.label;
  $("terrain-hint").textContent = habitat.description;
  $("air-panel").hidden = !habitat.swimming;
  $("air").value = habitat.air;
  $("air-value").textContent = Math.round(habitat.air);
  $("dive-action").textContent = habitat.diving ? "Surface · R" : "Dive · R";
  $("dive-action").disabled = !habitat.swimming;
  $("jump-action").textContent = habitat.swimming
    ? "Stroke · Space"
    : "Jump · Space";
  $("dash-action").textContent = renderer.is3D
    ? "Dash · Shift"
    : "Dash · Space";
  const sigilCount = sites.filter((site) =>
    state.discoveries.includes(site.id),
  ).length;
  $("health").textContent = Math.round(state.player.hp);
  $("hp").value = state.player.hp;
  $("energy").textContent = Math.round(state.player.energy);
  $("stamina").value = state.player.energy;
  const day = Math.floor(state.time / 180) + 1,
    phase = (state.time % 180) / 180;
  $("clock").textContent =
    `${phase < 0.35 ? "Morning" : phase < 0.45 ? "Dusk" : phase < 0.75 ? "Night" : "Dawn"} · Day ${day}`;
  $("coordinates").textContent =
    `${state.player.x.toFixed(1)}, ${state.player.y.toFixed(1)}`;
  $("inventory").textContent =
    `Wood ${state.inventory.wood || 0} · Stone ${state.inventory.stone || 0} · Berries ${state.inventory.berries || 0}`;
  for (const resource of ["wood", "stone", "berries"])
    $(`${resource}-count`).textContent = state.inventory[resource] || 0;
  $("equipment").textContent =
    Object.keys(state.tools)
      .filter((k) => state.tools[k])
      .join(" · ") || "Gather wood and stone to make your first tool.";
  $("building-kits").textContent =
    `Campfire kits ${state.inventory.campfires || 0} · Bridge kits ${state.inventory.bridges || 0} · Place kits from Crafting.`;
  $("sigils").textContent = `${sigilCount} / 3`;
  $("objective").textContent = state.restored
    ? "The signal has answered. The island is yours to explore."
    : sigilCount === 3
      ? "All three sigils recovered. Return to the beacon and press E."
      : "Make camp. Follow the old trails. Find what the island remembers.";
  const target =
    sigilCount === 3
      ? { title: "Home beacon", x: 0, y: 0 }
      : sites
          .filter((s) => !state.discoveries.includes(s.id))
          .sort(
            (a, b) =>
              Math.hypot(a.x - state.player.x, a.y - state.player.y) -
              Math.hypot(b.x - state.player.x, b.y - state.player.y),
          )[0];
  $("compass").textContent = target
    ? `${target.title} · ${Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y))} paces ${direction(target.x - state.player.x, target.y - state.player.y)}`
    : "";
  const fieldTarget =
    biomes.find(
      (site) =>
        site.terrain === "water" && !(state.finds || []).includes(site.id),
    ) ||
    biomes
      .filter((site) => !(state.finds || []).includes(site.id))
      .sort(
        (a, b) =>
          Math.hypot(a.x - state.player.x, a.y - state.player.y) -
          Math.hypot(b.x - state.player.x, b.y - state.player.y),
      )[0];
  $("field-compass").textContent = fieldTarget
    ? `Explore: ${fieldTarget.title} · ${Math.round(Math.hypot(fieldTarget.x - state.player.x, fieldTarget.y - state.player.y))} paces ${direction(fieldTarget.x - state.player.x, fieldTarget.y - state.player.y)}`
    : "All four field notes recovered.";
  $("cancel-place").hidden = !placing;
  $("confirm-place").hidden = !(placing && placementTouch && pointer);
  $("confirm-place").disabled = !(
    placing &&
    pointer &&
    canPlace(state, placing, pointer.x, pointer.y, world()).ok
  );
  for (const [id, recipe] of Object.entries(RECIPES)) {
    const button = $(`craft-${id}`);
    if (!button) continue;
    const have =
      id === "campfire"
        ? state.inventory.campfires || 0
        : id === "bridge"
          ? state.inventory.bridges || 0
          : 0;
    button.textContent = have ? `Place (${have})` : "Craft";
    const owned = Boolean(state.tools[id]);
    button.disabled =
      owned ||
      (!have &&
        Object.entries(recipe.cost || {}).some(
          ([key, cost]) => (state.inventory[key] || 0) < cost,
        ));
    if (owned) button.textContent = "Equipped";
    const missing = Object.entries(recipe.cost || {})
      .filter(([key, cost]) => (state.inventory[key] || 0) < cost)
      .map(([key, cost]) => `${cost - (state.inventory[key] || 0)} ${key}`);
    const reason = $(`reason-${id}`);
    if (reason)
      reason.textContent = owned
        ? "Equipped"
        : have
          ? "Ready to place"
          : missing.length
            ? `Need ${missing.join(", ")}`
            : "Ready to craft";
  }
  const nearby = stream
    .entitiesNear(state.player.x, state.player.y, 1.7)
    .filter((e) => !state.harvested.includes(e.id));
  const atSite = sites.find(
    (s) => Math.hypot(s.x - state.player.x, s.y - state.player.y) < 2,
  );
  $("context").textContent = placing
    ? `Placing ${placing} · click nearby ground · Esc cancels`
    : habitat.swimming
      ? habitat.diving
        ? "E · Search underwater · R surface before air runs out"
        : "Swimming · Space stroke · R dive · rest on shore"
      : atSite
        ? `E · Read ${atSite.title}`
        : Math.hypot(state.player.x, state.player.y) < 2
          ? "E · Rest at the beacon"
          : nearby.some((e) => e.type === "tree" || e.type === "rock")
            ? "J · Harvest nearby resources"
            : nearby.some((e) => e.type === "berry" || e.type === "cache")
              ? "E · Gather supplies"
              : renderer.is3D
                ? "WASD move · Space jump · Shift dash · J harvest · E inspect"
                : "WASD move · Space dash · J strike · E inspect · F eat";
}
function direction(x, y) {
  return `${y < -3 ? "N" : y > 3 ? "S" : ""}${x > 3 ? "E" : x < -3 ? "W" : ""}`;
}
function journal() {
  const container = $("journal");
  container.replaceChildren();
  for (const site of sites) {
    const d = document.createElement("details"),
      s = document.createElement("summary");
    const found = state.discoveries.includes(site.id);
    s.textContent = found ? `✦ ${site.title}` : `◇ ${site.title}`;
    d.append(s);
    const p = document.createElement("p");
    p.textContent = found
      ? site.text
      : "A signal stirs somewhere along the old paths. Approach and press E to investigate.";
    d.append(p);
    container.append(d);
  }
  const heading = document.createElement("h3");
  heading.textContent = `Field notes · ${(state.finds || []).length} / ${biomes.length}`;
  container.append(heading);
  for (const site of biomes) {
    const entry = document.createElement("details"),
      title = document.createElement("summary"),
      body = document.createElement("p");
    const found = (state.finds || []).includes(site.id);
    title.textContent = (found ? "✦ " : "◇ ") + site.title;
    body.textContent = found
      ? site.text
      : `Survey location (${site.x}, ${site.y}). ${site.kind.includes("lake") || site.terrain === "water" ? "Look beneath the surface." : "Leave the trail and inspect the supplies."}`;
    entry.append(title, body);
    container.append(entry);
  }
  if (state.restored) {
    const p = document.createElement("p");
    p.textContent =
      "The beacon was never a warning to ships. It was a promise to those sleeping below. Three lights answer beneath the tide. For the first time, the island is listening to you.";
    container.append(p);
  }
}
for (const [id, recipe] of Object.entries(RECIPES)) {
  const row = document.createElement("div");
  row.className = "recipe";
  const body = document.createElement("div"),
    name = document.createElement("strong"),
    desc = document.createElement("p");
  name.textContent = recipe.label || id;
  desc.textContent = `${Object.entries(recipe.cost || {})
    .map(([k, v]) => `${v} ${k}`)
    .join(" · ")} — ${recipe.description || ""}`;
  const reason = document.createElement("p");
  reason.id = `reason-${id}`;
  body.append(name, desc, reason);
  const button = document.createElement("button");
  button.id = `craft-${id}`;
  button.textContent = "Craft";
  button.onclick = () => {
    const count =
      id === "campfire"
        ? state.inventory.campfires
        : id === "bridge"
          ? state.inventory.bridges
          : 0;
    if (count) {
      selectPlacement(id);
      return;
    }
    const result = craft(state, id);
    message(result.message);
    if (result.ok) {
      tone("pickup");
      if (id === "campfire" || id === "bridge") selectPlacement(id);
      save();
    }
    hud();
  };
  row.append(body, button);
  $("recipes").append(row);
}
$("apply").onclick = () => {
  save();
  start();
  canvas.focus();
};
$("new").onclick = () => {
  if (
    !confirm(
      "Start a new expedition? Saved progress for this seed will be replaced.",
    )
  )
    return;
  try {
    seed = BigInt($("seed").value).toString();
  } catch {
    message("Enter an integer seed.");
    return;
  }
  start(true);
  save();
  canvas.focus();
};
$("prove").onclick = async () => {
  $("prove").disabled = true;
  $("export").disabled = true;
  try {
    evidence = await prove(seed, (text) => ($("proof").textContent = text));
    $("proof").textContent = evidence.passed
      ? "18 configurations produced identical base content."
      : "Content mismatch detected.";
    $("export").disabled = false;
  } catch (error) {
    $("proof").textContent = error.message;
  } finally {
    $("prove").disabled = false;
  }
};
$("export").onclick = () => {
  if (!evidence) return;
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(evidence, null, 2)], {
        type: "application/json",
      }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "verdant-base-evidence.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
let last = performance.now(),
  accumulator = 0,
  hudTimer = 0,
  saveTimer = 0,
  priorDiscoveries = "";
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (hoverLook && lastLookPoint && canMouseLook()) {
    const bounds = canvas.getBoundingClientRect();
    const edge = edgeLook(
      lastLookPoint.x - bounds.left,
      lastLookPoint.y - bounds.top,
      bounds.width,
      bounds.height,
    );
    renderer.orbit(-edge.x * dt * 2.2, edge.y * dt * 1.2);
  }
  if (!paused && !pack.open && !showMap) {
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      const x =
          touch.x +
          Number(keys.has("d") || keys.has("arrowright")) -
          Number(keys.has("a") || keys.has("arrowleft")),
        y =
          touch.y +
          Number(keys.has("s") || keys.has("arrowdown")) -
          Number(keys.has("w") || keys.has("arrowup"));
      const environment = world();
      if (environment.loaded) {
        const direction = renderer.is3D ? renderer.movement(x, y) : { x, y };
        previousPlayer = { ...state.player };
        stepGame(state, { ...direction, ...actions }, 1 / 60, environment);
        actions = {};
      }
      accumulator -= 1 / 60;
    }
    const next = `${Math.floor(state.player.x / 16)},${Math.floor(state.player.y / 16)}`;
    if (next !== center) load();
    for (const event of state.events.splice(0)) {
      if (event.text) message(event.text);
      renderer.feedback?.(event);
      renderer.burst(
        event.x ?? state.player.x,
        event.y ?? state.player.y,
        event.type === "hurt" || event.type === "damage"
          ? "#e9856b"
          : "#e4d48e",
      );
      tone(event.type);
    }
    hudTimer += dt;
    saveTimer += dt;
    if (hudTimer > 0.12) {
      hud();
      hudTimer = 0;
    }
    if (saveTimer > 5) {
      save();
      saveTimer = 0;
    }
    const discoveries = JSON.stringify([
      state.discoveries,
      state.restored,
      state.finds,
    ]);
    if (discoveries !== priorDiscoveries) {
      journal();
      priorDiscoveries = discoveries;
      save();
    }
  } else {
    accumulator = 0;
    previousPlayer = { ...state.player };
  }
  if (renderer.is3D && placing && pointerClient && !placementTouch)
    pointer = renderer.pick(pointerClient.x, pointerClient.y);
  const presentation = renderer.is3D
    ? {
        ...state,
        player: interpolatePlayer(
          previousPlayer,
          state.player,
          paused || pack.open || showMap ? 1 : accumulator * 60,
        ),
      }
    : state;
  renderer.draw(presentation, stream, sites, dt, now, showMap, biomes, {
    kind: placing,
    point: pointer,
    valid: Boolean(
      placing &&
      pointer &&
      canPlace(state, placing, pointer.x, pointer.y, world()).ok,
    ),
  });
  if (!renderer.is3D && placing && pointer) {
    const g = renderer.ctx,
      r = Math.hypot(pointer.x - state.player.x, pointer.y - state.player.y);
    g.strokeStyle = canPlace(state, placing, pointer.x, pointer.y, world()).ok
      ? "#f6e09b"
      : "#f08b76";
    g.lineWidth = 3;
    g.strokeRect(
      canvas.width / 2 + (pointer.x - renderer.camera.x - 0.5) * 32,
      canvas.height / 2 + (pointer.y - renderer.camera.y - 0.5) * 32,
      32,
      32,
    );
  }
  if (now > toastUntil) $("toast").textContent = "";
  requestAnimationFrame(frame);
}
start();
if (renderNotice) message(renderNotice);
let seenArrival = false;
try {
  seenArrival = localStorage.getItem("verdant-3d-intro") === "seen";
} catch {}
if (renderer.is3D && !seenArrival) {
  arrival = true;
  setPause(true);
  $("pause-title").textContent = "Step into Verdant.";
  $("pause-copy").textContent =
    "Wander, gather, build, and follow the lights. Your expedition is ready when you are.";
  $("arrival-controls").hidden = false;
  $("resume").textContent = "Enter the island";
}
journal();
requestAnimationFrame(frame);
window.addEventListener("pagehide", () => {
  releaseMouseLook();
  save();
  stream.dispose();
  renderer.dispose?.();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
