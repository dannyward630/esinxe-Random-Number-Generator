#include "Esinxec1-0-0.h"

static EsinxeRandom esinxe_default_rng = {0, 0, 0};

void SetSeed(uint64_t seed)
{
    EsinxeInit(&esinxe_default_rng, seed);
}

void SetTimeSeed(void)
{
    EsinxeSetTimeSeed(&esinxe_default_rng);
}

uint64_t NextRawAt(uint64_t offset)
{
    return EsinxeNextRawAt(&esinxe_default_rng, offset);
}

uint64_t NextRaw(void)
{
    return EsinxeNextRaw(&esinxe_default_rng);
}

uint64_t NextAt(uint64_t offset)
{
    return EsinxeNextAt(&esinxe_default_rng, offset);
}

uint64_t Next(void)
{
    return EsinxeNext(&esinxe_default_rng);
}

uint64_t NextMaxAt(uint64_t offset, uint64_t maxvalue)
{
    return EsinxeNextMaxAt(&esinxe_default_rng, offset, maxvalue);
}

uint64_t NextMax(uint64_t maxvalue)
{
    return EsinxeNextMax(&esinxe_default_rng, maxvalue);
}

uint64_t NextMinMaxAt(
    uint64_t offset,
    uint64_t minvalue,
    uint64_t maxvalue)
{
    return EsinxeNextMinMaxAt(&esinxe_default_rng, offset, minvalue, maxvalue);
}

uint64_t NextMinMax(uint64_t minvalue, uint64_t maxvalue)
{
    return EsinxeNextMinMax(&esinxe_default_rng, minvalue, maxvalue);
}
