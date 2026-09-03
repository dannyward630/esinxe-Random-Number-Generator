"""Canonical key encoding must reject invalid data, not silently alias it."""

import subprocess
import unittest

from test_esinxe import ROOT, compile_and_run

import esinxe


class KeyValidationTests(unittest.TestCase):
    def test_ruby_rejects_oversized_bounds(self):
        script = """
require 'timeout'
require File.expand_path('Ruby/Esinxeruby1-0-0', Dir.pwd)
rng = Esinxe::Generator.new(12345)
Timeout.timeout(2) do
  begin
    rng.NextMaxAt(0, (1 << 64) + 1)
    raise 'oversized bound accepted'
  rescue RangeError
  end
end
raise 'full uint64 range changed' unless rng.NextMaxAt(0, 1 << 64) == rng.NextRawAt(0)
"""
        subprocess.run(
            ["ruby", "-e", script],
            cwd=ROOT,
            check=True,
            timeout=5,
            capture_output=True,
            text=True,
        )

    def test_python_unicode_reference(self):
        rng = esinxe.Random(12345)
        for text in ("\ud800", "\udc00", "x\ud800y"):
            with self.assertRaises(UnicodeError):
                rng.raw(text)
        self.assertEqual(rng.raw("🌍"), 15694140828174711031)
        self.assertEqual(rng.raw("a\0b"), 13581488430406810937)
        self.assertEqual(rng.index, 0)

    def test_cpp_validates_public_key_data(self):
        compile_and_run(
            "cpp",
            r"""
#include <cassert>
#include "C++/Esinxecpp1-0-0.h"
int main() {
    using namespace Esinxecpp;
    Random rng(12345);
    for (const auto &bytes : std::vector<std::vector<std::uint8_t>>{
        {0xff}, {0xc0, 0x80}, {0xe0, 0x80, 0x80}, {0xed, 0xa0, 0x80},
        {0xf4, 0x90, 0x80, 0x80}, {0xe2, 0x82}, {0xe2, 0x28, 0xa1}}) {
        Key key{Key::Type::String, 0, bytes};
        try { rng.Raw({key}); assert(false); }
        catch (const std::invalid_argument &) {}
        rng.Raw({Key::Bytes(bytes)});  // Arbitrary bytes remain valid.
    }
    assert(rng.Raw({Key::Utf8("🌍")}) == UINT64_C(15694140828174711031));
    assert(rng.Raw({Key::Utf8(std::string("a\0b", 3))}) ==
           UINT64_C(13581488430406810937));
    assert(rng.NextRaw() == rng.NextRawAt(0));
}
""",
        )

    def test_ruby_validates_encoded_strings_and_typed_arrays(self):
        script = r"""
require File.expand_path('Ruby/Esinxeruby1-0-0', Dir.pwd)
rng = Esinxe::Generator.new(12345)
["\xff", "\xc0\x80", "\xed\xa0\x80", "\xe2\x82"].each do |text|
  begin
    rng.raw(text.force_encoding(Encoding::UTF_8))
    raise 'invalid UTF-8 accepted'
  rescue EncodingError
  end
end
[[:i64, 1 << 63], [:u64, -1], [:u64, 1 << 64]].each do |key|
  begin
    rng.raw(key)
    raise 'forged key accepted'
  rescue RangeError
  end
end
raise 'non-BMP vector' unless rng.raw("🌍") == 15694140828174711031
raise 'NUL vector' unless rng.raw("a\0b") == 13581488430406810937
"""
        subprocess.run(
            ["ruby", "-e", script],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
