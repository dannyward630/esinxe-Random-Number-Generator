import assert from "node:assert/strict";
import { test } from "node:test";
import { seedLiteral, stringLiteral } from "../../demo/snippets.mjs";

test("demo seed literals preserve uint64 bits in every target language", () => {
  for (const language of ["Python", "Go", "Rust"]) {
    assert.equal(seedLiteral(language, -1n), "18446744073709551615");
    assert.equal(seedLiteral(language, 1n << 64n), "0");
  }
  assert.equal(seedLiteral("JavaScript", -1n), "18446744073709551615n");
  assert.equal(seedLiteral("Java", (1n << 64n) - 1n), "-1L");
  assert.equal(seedLiteral("Java", 1n << 63n), "-9223372036854775808L");
});

test("Rust snippet strings use Rust escapes without rewriting literal backslashes", () => {
  assert.equal(stringLiteral("Rust", "a\0b"), '"a\\u{0}b"');
  assert.equal(stringLiteral("Rust", "\b\f"), '"\\u{8}\\u{c}"');
  assert.equal(stringLiteral("Rust", String.raw`\u0000`), '"\\\\u0000"');
  assert.equal(stringLiteral("Rust", '"\n🌍'), '"\\"\\n🌍"');
});
