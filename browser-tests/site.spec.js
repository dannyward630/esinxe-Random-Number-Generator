import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createGame, serializeGame } from "../examples/world/game.js";

const world = "/examples/world/";
const settings = (page) => page.locator('[data-open-panel="settings"]').click();
const ready = (page) =>
  expect(page.locator("#habitat")).not.toHaveText("Unmapped ground");

test("an expedition survives a view change, reload and returning from another seed", async ({
  page,
}) => {
  await page.goto(`${world}?view=2d`);
  await expect(page.locator("canvas#world")).toHaveAttribute(
    "aria-label",
    /^Verdant 2D/,
  );
  await settings(page);
  await page.getByLabel("Seed", { exact: true }).fill("74321");
  await page.getByRole("button", { name: "New expedition" }).click();
  await expect(page).toHaveURL(/seed=74321/);
  await ready(page);
  const selected = createGame("74321");
  selected.inventory.stone = 7;
  await settings(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Import expedition").setInputFiles({
    name: "seeded-progress.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeGame(selected)),
  });
  await expect(page.locator("#pack")).not.toBeVisible();
  await page.locator('[data-open-panel="satchel"]').click();
  await page.getByRole("button", { name: "Save expedition" }).click();
  await expect(page.locator("#save-status")).toHaveText("Saved");
  await page.keyboard.press("Escape");
  await settings(page);
  await page.locator("#view-mode").selectOption("3d");
  await expect(page.locator("canvas#world")).toHaveAttribute(
    "aria-label",
    /^Verdant 3D/,
    { timeout: 20_000 },
  );
  await expect(page).toHaveURL(/seed=74321/);
  await settings(page);
  await expect(page.locator("#active-seed")).toHaveText("74321");
  await page.getByRole("tab", { name: "Satchel" }).click();
  await expect(page.locator("#menu-satchel")).toContainText("Stone 7");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("Seed", { exact: true }).fill("42");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New expedition" }).click();
  await expect(page).toHaveURL(/seed=42/);
  await settings(page);
  await page.getByLabel("Seed", { exact: true }).fill("74321");
  await page.getByRole("button", { name: "Resume saved expedition" }).click();
  await expect(page).toHaveURL(/seed=74321/);
  await page.reload();
  await expect(page.locator("canvas#world")).toHaveAttribute(
    "aria-label",
    /^Verdant 3D/,
    { timeout: 20_000 },
  );
  await settings(page);
  await expect(page.locator("#active-seed")).toHaveText("74321");
});

test("unreadable saves survive save attempts and can be exported and replaced with a validated backup", async ({
  page,
}) => {
  const key = "verdant-expedition-3:93";
  const broken = '{"seed":"93","version":3';
  await page.addInitScript(
    ({ key, broken }) => localStorage.setItem(key, broken),
    { key, broken },
  );
  await page.goto(`${world}?view=2d&seed=93`);
  await page.locator('[data-open-panel="satchel"]').click();
  await page.getByRole("button", { name: "Save expedition" }).click();
  await expect(page.locator("#save-status")).toContainText("could not be read");
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    broken,
  );
  await page.getByRole("tab", { name: "Settings" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export unreadable save" }).click();
  expect(await readFile(await (await download).path(), "utf8")).toBe(broken);
  const file = page.getByLabel("Import expedition");
  await file.setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.locator("#expedition-status")).toContainText(
    "not a supported",
  );
  const state = createGame("93");
  state.inventory.wood = 12;
  page.once("dialog", (dialog) => dialog.accept());
  await file.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeGame(state)),
  });
  await expect(page.locator("#pack")).not.toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).inventory.wood,
      key,
    ),
  ).toBe(12);
});

test("a failed terrain worker falls back and the opening routes can be tracked", async ({
  page,
}) => {
  await page.route("**/worker.js", (route) => route.abort());
  await page.goto(`${world}?view=2d`);
  await expect(page.locator("canvas#world")).toHaveAttribute(
    "aria-label",
    /^Verdant 2D/,
  );
  await expect(page.locator("#loading-status")).toContainText("main thread");
  await ready(page);
  await page.locator('[data-open-panel="journal"]').click();
  await page.getByRole("button", { name: "Track Windcut Bluff" }).click();
  await expect(page.locator("#field-compass")).toContainText(
    "Tracking: The Windcut Bluff",
  );
  await expect(page.locator("#field-compass")).toContainText("craft boots");
  await page.reload();
  await expect(page.locator("#field-compass")).toContainText(
    "Tracking: The Windcut Bluff",
  );
});

test("3D mouse-look turns with an uncaptured pointer and releases for the inventory", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = () =>
      Promise.reject(new Error("capture unavailable"));
  });
  await page.goto(`${world}?view=3d&profile=1`);
  await page
    .getByRole("button", { name: "Enter the island" })
    .click({ timeout: 20_000 });
  await ready(page);
  await expect(page.locator("#world")).toHaveAttribute(
    "data-mouse-look",
    "hover",
  );
  const canvas = await page.locator("#world").boundingBox();
  const oldHeading = (
    await page.locator("#camera-heading").textContent()
  ).split(" · ")[0];
  await page.mouse.move(
    canvas.x + canvas.width * 0.35,
    canvas.y + canvas.height * 0.53,
  );
  await page.mouse.move(
    canvas.x + canvas.width * 0.8,
    canvas.y + canvas.height * 0.53,
  );
  await expect
    .poll(
      async () =>
        (await page.locator("#camera-heading").textContent()).split(" · ")[0],
    )
    .not.toBe(oldHeading);
  await expect
    .poll(
      async () =>
        JSON.parse(
          await page.locator("#world").getAttribute("data-performance"),
        ).samples,
    )
    .toBeGreaterThan(15);
  await testInfo.attach("verdant-performance", {
    body: await page.locator("#world").getAttribute("data-performance"),
    contentType: "application/json",
  });
  await page.keyboard.press("i");
  await expect(
    page.getByRole("heading", { name: "Your satchel" }),
  ).toBeVisible();
  await expect(page.locator("#world")).toHaveAttribute(
    "data-mouse-look",
    "off",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#pack")).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("record startup and a streamed chunk crossing at light detail under CPU throttling", async ({
  page,
}, testInfo) => {
  const game = createGame("42");
  game.player.x = 15.4;
  game.player.y = 2;
  await page.addInitScript((text) => {
    if (!localStorage.getItem("verdant-expedition-3:42"))
      localStorage.setItem("verdant-expedition-3:42", text);
    localStorage.setItem("verdant-quality", "low");
    localStorage.setItem("verdant-3d-intro", "seen");
  }, serializeGame(game));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(`${world}?view=3d&profile=1`);
  const profile = async () =>
    JSON.parse(
      (await page.locator("#world").getAttribute("data-performance")) ?? "{}",
    );
  await expect
    .poll(async () => (await profile()).terrainLoadsMs?.length ?? 0, {
      timeout: 20_000,
    })
    .toBe(1);
  await page.locator("#world").focus();
  for (let n = 0; n < 4; n++) await page.keyboard.press("q");
  await page.keyboard.down("d");
  try {
    await expect
      .poll(async () => (await profile()).terrainLoadsMs?.length ?? 0, {
        timeout: 15_000,
      })
      .toBeGreaterThan(1);
  } finally {
    await page.keyboard.up("d");
  }
  const result = await profile();
  expect(result.view).toBe("3d");
  expect(result.firstPlayableMs).toBeGreaterThan(0);
  await testInfo.attach("verdant-light-throttled", {
    body: JSON.stringify({ cpuThrottle: 4, ...result }),
    contentType: "application/json",
  });
});

test("the 2D fallback works at phone width without WebGL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...options) {
      return type.startsWith("webgl")
        ? null
        : original.call(this, type, ...options);
    };
  });
  await page.goto(`${world}?view=3d`);
  await expect(page.locator("#world")).toHaveAttribute(
    "aria-label",
    /^Verdant 2D/,
  );
  await ready(page);
  await settings(page);
  await expect(page.locator("#render-notice")).toContainText(
    "3D could not start",
  );
  const box = await page.locator("#pack").boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(844);
});

test("an inspector link reproduces a selected coordinate and full-width seed", async ({
  page,
}) => {
  await page.goto("/demo/?seed=18446744073709551615&namespace=survey&x=-2&y=3");
  await expect(page.locator("#selected")).toHaveText(/^\(-2, 3\)\s+0x/);
  const result = await page.locator("#selected").textContent();
  const url = page.url();
  await page.reload();
  await expect(page.locator("#selected")).toHaveText(result);
  expect(page.url()).toBe(url);
});
