"""Reference answers and reproducibility checks for experimental candidates."""

import importlib.util
import unittest

from test_esinxe import ROOT

SPEC = importlib.util.spec_from_file_location(
    "practical", ROOT / "scripts/benchmark_practical.py"
)
BENCH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BENCH)


class PracticalBenchmarkTests(unittest.TestCase):
    def test_philox_matches_three_official_random123_known_answers(self):
        # https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors
        vectors = [
            ((0, 0, 0, 0), (0, 0), (0x6627E8D5, 0xE169C58D, 0xBC57AC4C, 0x9B00DBD8)),
            (
                (0xFFFFFFFF,) * 4,
                (0xFFFFFFFF,) * 2,
                (0x408F276D, 0x41C83B0E, 0xA20BC7C6, 0x6D5451FD),
            ),
            (
                (0x243F6A88, 0x85A308D3, 0x13198A2E, 0x03707344),
                (0xA4093822, 0x299F31D0),
                (0xD16CFE09, 0x94FDCCEB, 0x5001E420, 0x24126EA1),
            ),
        ]
        for counter, key, answer in vectors:
            self.assertEqual(BENCH.philox4x32_10(counter, key), answer)

    def test_independent_encoder_and_scalar_batch_checksums(self):
        import esinxe

        rows = BENCH.terrain_rows(16) + BENCH.entity_loot_rows(16)
        for row in rows:
            encoded = BENCH.encode_v1_key(42, row)
            self.assertEqual(
                BENCH.v1_raw_from_encoded(encoded), esinxe.Random(42).raw(*row)
            )
        record = BENCH.run_benchmark(samples=8, repeats=1, warmups=0, seed=42)
        for workload in record["workloads"].values():
            outputs = workload["end_to_end"]
            self.assertEqual(
                outputs["esinxe_raw_scalar"]["output_checksum_sha256"],
                outputs["esinxe_raw_batch"]["output_checksum_sha256"],
            )
        self.assertIn("source_sha256", record["provenance"])


if __name__ == "__main__":
    unittest.main()
