import { restoreGame } from "./game.js?v=7";

const activeKey = "verdant-active-seed";
export const saveKey = (seed, version = 3) =>
  `verdant-expedition-${version}:${seed}`;

export function parseSeed(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length <= 128 && /^[-+]?\d+$/.test(text)
    ? BigInt(text).toString()
    : null;
}

export function activeSeed(storage) {
  try {
    return parseSeed(storage?.getItem(activeKey)) ?? "42";
  } catch {
    return "42";
  }
}

export function rememberSeed(storage, seed) {
  try {
    storage?.setItem(activeKey, seed);
  } catch {
    // The current session can still play without persistent storage.
  }
}

export function readSave(storage, seed) {
  try {
    if (!storage) return { kind: "unavailable" };
    for (const version of [3, 2]) {
      const text = storage.getItem(saveKey(seed, version));
      if (text === null) continue;
      const state = restoreGame(text, seed);
      return state
        ? { kind: "saved", state, text }
        : { kind: "unreadable", text };
    }
    return { kind: "missing" };
  } catch {
    return { kind: "unavailable" };
  }
}

export function parseSaveFile(text) {
  if (text.length > 2_000_000) return null;
  try {
    const seed = parseSeed(JSON.parse(text)?.seed);
    return seed === null ? null : restoreGame(text, seed);
  } catch {
    return null;
  }
}
