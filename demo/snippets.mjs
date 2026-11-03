// Explicit .mjs keeps these helpers importable in Node 18 as well as browsers.
// Emit literals for the effective uint64 seed, not the unnormalized input.
export function seedLiteral(language, seed) {
  const bits = BigInt.asUintN(64, BigInt(seed));
  if (language === "Java") return `${BigInt.asIntN(64, bits)}L`;
  if (language === "JavaScript") return `${bits}n`;
  return bits.toString();
}

export function stringLiteral(language, value) {
  if (language !== "Rust") return JSON.stringify(value);
  const escapes = { '"': '\\"', "\\": "\\\\", "\n": "\\n", "\r": "\\r", "\t": "\\t" };
  return '"' + Array.from(value, (character) => {
    if (Object.hasOwn(escapes, character)) return escapes[character];
    const point = character.codePointAt(0);
    return point < 0x20 ? `\\u{${point.toString(16)}}` : character;
  }).join("") + '"';
}
