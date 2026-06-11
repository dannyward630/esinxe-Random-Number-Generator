"""Address world content directly without maintaining one global RNG stream."""

import esinxe


world = esinxe.Random(20260611)


def chunk_at(x, y):
    key = (esinxe.i64(x), esinxe.i64(y))
    return {
        "height": world.at2D(x, y, "terrain"),
        "biome": world.choose(
            ["forest", "desert", "tundra", "wetland"],
            "biome",
            *key,
        ),
        "enemy": world.choose(
            ["archer", "scout", "guardian"],
            "enemy",
            *key,
        ),
        "loot": world.weightedChoice(
            ["common", "rare", "legendary"],
            [80, 18, 2],
            "loot",
            *key,
        ),
    }


if __name__ == "__main__":
    print(chunk_at(-4, 9))
