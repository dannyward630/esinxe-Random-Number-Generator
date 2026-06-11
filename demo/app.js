import { Random, i64 } from "../JavaScript/src/index.js";

const seedInput = document.querySelector("#seed");
const namespaceInput = document.querySelector("#namespace");
const viewSelect = document.querySelector("#view");
const regenerateButton = document.querySelector("#regenerate");
const grid = document.querySelector("#grid");
const selected = document.querySelector("#selected");
const choice = document.querySelector("#choice");
const choiceDetail = document.querySelector("#choice-detail");
const languageSelect = document.querySelector("#language");
const snippet = document.querySelector("#snippet");
const fingerprint = document.querySelector("#fingerprint");

const biomes = ["Forest", "Desert", "Tundra", "Wetland", "Highlands"];
const encounters = ["Quiet trail", "Supply cache", "Scout patrol", "Ancient marker"];
const colors = {
  Forest: "#7fb67e",
  Desert: "#e2c76d",
  Tundra: "#b9d8da",
  Wetland: "#72a9a1",
  Highlands: "#b7a38b",
};

let currentField;
let activeCell = null;

function parseSeed() {
  try {
    return BigInt(seedInput.value.trim() || "0");
  } catch {
    seedInput.setCustomValidity("Enter an integer seed");
    seedInput.reportValidity();
    return null;
  }
}

function shortHex(value) {
  return value.toString(16).padStart(16, "0").slice(0, 6);
}

function cellPresentation(raw, biome) {
  if (viewSelect.value === "biome") {
    return { label: biome.slice(0, 3).toUpperCase(), color: colors[biome] };
  }
  if (viewSelect.value === "raw") {
    return { label: shortHex(raw), color: "#d9ded8" };
  }
  const height = Number(raw >> 56n);
  const lightness = 34 + Math.round((height / 255) * 52);
  return {
    label: String(height).padStart(3, "0"),
    color: `hsl(137 23% ${lightness}%)`,
  };
}

function selectCell(button, x, y, raw, biome) {
  activeCell?.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-pressed", "true");
  activeCell = button;
  selected.value = `(${x}, ${y})  0x${raw.toString(16).padStart(16, "0")}`;
  choice.textContent = biome;
  const encounter = currentField.choose(encounters, "encounter", i64(x), i64(y));
  const rare = currentField.chanceRatio(1, 20, "rare", i64(x), i64(y));
  choiceDetail.textContent = `${encounter}${rare ? " · rare feature" : ""}`;
}

function render() {
  const seed = parseSeed();
  if (seed === null) return;
  seedInput.setCustomValidity("");
  const namespace = namespaceInput.value;
  currentField = new Random(seed);
  activeCell = null;
  grid.replaceChildren();

  for (let y = -4; y <= 4; y++) {
    for (let x = -4; x <= 4; x++) {
      const raw = currentField.at2D(x, y, namespace);
      const biome = currentField.choose(biomes, namespace, i64(x), i64(y));
      const presentation = cellPresentation(raw, biome);
      const button = document.createElement("button");
      button.className = "cell";
      button.type = "button";
      button.role = "gridcell";
      button.style.setProperty("--cell-color", presentation.color);
      button.textContent = presentation.label;
      button.title = `${x}, ${y}: ${raw}`;
      button.setAttribute("aria-label", `${x}, ${y}: ${biome}, value ${raw}`);
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => selectCell(button, x, y, raw, biome));
      grid.append(button);
      if (x === 0 && y === 0) selectCell(button, x, y, raw, biome);
    }
  }

  fingerprint.textContent = `field ${currentField.raw(namespace).toString(16).padStart(16, "0")}`;
  renderSnippet();
}

function renderSnippet() {
  const seed = seedInput.value.trim() || "0";
  const namespace = JSON.stringify(namespaceInput.value);
  const snippets = {
    Python: `import esinxe

field = esinxe.Random(${seed})
value = field.at2D(x, y, ${namespace})
loot = field.choose(
    ["common", "rare", "legendary"],
    "loot", esinxe.i64(x), esinxe.i64(y)
)`,
    JavaScript: `import { Random, i64 } from "esinxe";

const field = new Random(${seed}n);
const value = field.at2D(x, y, ${namespace});
const loot = field.choose(
  ["common", "rare", "legendary"],
  "loot", i64(x), i64(y)
);`,
    Rust: `let field = Random::new(${seed});
let value = field.at_2d(x, y, Some(${namespace}));
let loot = field.choose(
    &["common", "rare", "legendary"],
    &[Key::Str("loot"), Key::I64(x), Key::I64(y)],
);`,
    Go: `field := esinxe.New(${seed})
namespace := ${namespace}
value := field.At2D(x, y, &namespace)
loot, _ := esinxe.Choose(
    field,
    []string{"common", "rare", "legendary"},
    esinxe.String("loot"), esinxe.I64(x), esinxe.I64(y),
)`,
    Java: `Random field = new Random(${seed}L);
long value = field.at2D(x, y, ${namespace});
String loot = field.choose(
    List.of("common", "rare", "legendary"),
    Random.Key.string("loot"),
    Random.Key.i64(x),
    Random.Key.i64(y)
);`,
  };
  snippet.textContent = snippets[languageSelect.value];
}

regenerateButton.addEventListener("click", render);
viewSelect.addEventListener("change", render);
languageSelect.addEventListener("change", renderSnippet);
seedInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") render();
});
namespaceInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") render();
});

render();
