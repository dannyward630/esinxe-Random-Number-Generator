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
} from "./game.js?v=3";
import { landmarksForSeed, biomeSitesForSeed } from "./expedition.js?v=3";
import { ChunkStream, prove } from "./stream.js?v=3";
import { Renderer } from "./render.js?v=3";
const $ = (id) => document.getElementById(id),
  canvas = $("world"),
  renderer = new Renderer(canvas);
let seed = "42",
  state,
  stream,
  sites,
  biomes,
  paused = false,
  hiddenPause = false,
  showMap = false,
  placing = null,
  center = "",
  revision = 0,
  evidence = null;
let pointer = null;
function resize() {
  canvas.width = innerWidth < 760 ? 640 : 1120;
  canvas.height = innerWidth < 760 ? 720 : 680;
}
resize();
window.addEventListener("resize", resize);
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
      type === "hurt" ? 150 : type === "discovery" ? 720 : 440,
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
  } catch (error) {
    if (ticket === revision) message(error.message);
  }
}
function setPause(value) {
  fingers.clear();
  paused = value;
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
};
$("map").onclick = () => {
  showMap = !showMap;
  canvas.focus();
};
$("sound").onclick = () => {
  sound = !sound;
  $("sound").textContent = sound ? "Sound on" : "Sound off";
  $("sound").setAttribute("aria-pressed", String(sound));
  tone("pickup");
};
$("save").onclick = save;
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
  " ": "dash",
  j: "attack",
  e: "interact",
  f: "eat",
  r: "dive",
};
document.addEventListener("keydown", (event) => {
  if (inputTarget(event) || event.ctrlKey || event.metaKey || event.altKey)
    return;
  const k = event.key.toLowerCase();
  if (moveKeys.has(k)) {
    event.preventDefault();
    keys.add(k);
  }
  if (actionKeys[k]) {
    event.preventDefault();
    if (!event.repeat) actions[actionKeys[k]] = true;
  }
  if (k === "m" && !event.repeat) showMap = !showMap;
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
    actions[button.dataset.action] = true;
    canvas.focus();
  };
canvas.onpointermove = (event) => {
  const r = canvas.getBoundingClientRect();
  pointer = {
    x: Math.floor(
      renderer.camera.x +
        0.5 +
        ((event.clientX - r.left - r.width / 2) * canvas.width) / r.width / 32,
    ),
    y: Math.floor(
      renderer.camera.y +
        0.5 +
        ((event.clientY - r.top - r.height / 2) * canvas.height) /
          r.height /
          32,
    ),
  };
};
canvas.onpointerdown = (event) => {
  canvas.focus();
  if (!placing) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(
      renderer.camera.x +
        0.5 +
        ((event.clientX - rect.left - rect.width / 2) * canvas.width) /
          rect.width /
          32,
    ),
    y = Math.floor(
      renderer.camera.y +
        0.5 +
        ((event.clientY - rect.top - rect.height / 2) * canvas.height) /
          rect.height /
          32,
    );
  const result = place(state, placing, x, y, world());
  message(result.message);
  if (result.ok) {
    renderer.burst(x, y);
    placing = null;
    save();
  }
  hud();
};
$("cancel-place").onclick = () => {
  placing = null;
  hud();
  canvas.focus();
};
function selectPlacement(kind) {
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
  $("equipment").textContent =
    Object.keys(state.tools)
      .filter((k) => state.tools[k])
      .join(" · ") || "Gather wood and stone to make your first tool.";
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
  $("placement").hidden = !placing;
  $("cancel-place").hidden = !placing;
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
  if (!paused) {
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
        stepGame(state, { x, y, ...actions }, 1 / 60, environment);
        actions = {};
      }
      accumulator -= 1 / 60;
    }
    const next = `${Math.floor(state.player.x / 16)},${Math.floor(state.player.y / 16)}`;
    if (next !== center) load();
    for (const event of state.events.splice(0)) {
      if (event.text) message(event.text);
      renderer.burst(
        event.x ?? state.player.x,
        event.y ?? state.player.y,
        event.type === "hurt" ? "#e9856b" : "#e4d48e",
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
  } else accumulator = 0;
  renderer.draw(state, stream, sites, dt, now, showMap, biomes);
  if (placing && pointer) {
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
journal();
requestAnimationFrame(frame);
window.addEventListener("pagehide", () => {
  save();
  stream.dispose();
});
