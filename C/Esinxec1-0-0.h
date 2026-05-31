#ifndef ESINXEC_H_INCLUDED
#define ESINXEC_H_INCLUDED

#include <stdint.h>
#include <time.h>

static const uint64_t ESINXE_GAMMA = UINT64_C(0x9E3779B97F4A7C15);
static const uint64_t ESINXE_MAX_INT_VALUE = UINT64_C(1000000000000000000);

typedef struct EsinxeRandom
{
    uint64_t seed;
    uint64_t index;
} EsinxeRandom;

static uint64_t EsinxeMix64(uint64_t value)
{
    value = (value ^ (value >> 30)) * UINT64_C(0xBF58476D1CE4E5B9);
    value = (value ^ (value >> 27)) * UINT64_C(0x94D049BB133111EB);
    return value ^ (value >> 31);
}

static uint64_t EsinxeBounded(uint64_t value, uint64_t maxvalue)
{
    if (maxvalue == 0)
    {
        return 0;
    }

    uint64_t threshold = (uint64_t)(0 - maxvalue) % maxvalue;
    uint64_t nonce = 0;
    while (value < threshold)
    {
        nonce++;
        value = EsinxeMix64(value + (nonce * ESINXE_GAMMA));
    }
    return value % maxvalue;
}

void EsinxeInit(EsinxeRandom *rng, uint64_t seed)
{
    rng->seed = seed;
    rng->index = 0;
}

void EsinxeSetTimeSeed(EsinxeRandom *rng)
{
    EsinxeInit(rng, (uint64_t)time(0));
}

uint64_t EsinxeNextRawAt(const EsinxeRandom *rng, uint64_t offset)
{
    return EsinxeMix64(rng->seed + (offset * ESINXE_GAMMA));
}

uint64_t EsinxeNextRaw(EsinxeRandom *rng)
{
    uint64_t value = EsinxeNextRawAt(rng, rng->index);
    rng->index++;
    return value;
}

uint64_t EsinxeNextAt(const EsinxeRandom *rng, uint64_t offset)
{
    return EsinxeBounded(EsinxeNextRawAt(rng, offset), ESINXE_MAX_INT_VALUE);
}

uint64_t EsinxeNext(EsinxeRandom *rng)
{
    uint64_t value = EsinxeNextAt(rng, rng->index);
    rng->index++;
    return value;
}

uint64_t EsinxeNextMaxAt(const EsinxeRandom *rng, uint64_t offset, uint64_t maxvalue)
{
    return EsinxeBounded(EsinxeNextRawAt(rng, offset), maxvalue);
}

uint64_t EsinxeNextMax(EsinxeRandom *rng, uint64_t maxvalue)
{
    uint64_t value = EsinxeNextMaxAt(rng, rng->index, maxvalue);
    rng->index++;
    return value;
}

uint64_t EsinxeNextMinMaxAt(
    const EsinxeRandom *rng,
    uint64_t offset,
    uint64_t minvalue,
    uint64_t maxvalue)
{
    if (maxvalue <= minvalue)
    {
        return minvalue;
    }
    return minvalue + EsinxeNextMaxAt(rng, offset, maxvalue - minvalue);
}

uint64_t EsinxeNextMinMax(EsinxeRandom *rng, uint64_t minvalue, uint64_t maxvalue)
{
    uint64_t value = EsinxeNextMinMaxAt(rng, rng->index, minvalue, maxvalue);
    rng->index++;
    return value;
}

static EsinxeRandom esinxe_default_rng = {0, 0};

void SetSeed(uint64_t seed)
{
    EsinxeInit(&esinxe_default_rng, seed);
}

void SetTimeSeed()
{
    EsinxeSetTimeSeed(&esinxe_default_rng);
}

uint64_t NextRawAt(uint64_t offset)
{
    return EsinxeNextRawAt(&esinxe_default_rng, offset);
}

uint64_t NextRaw()
{
    return EsinxeNextRaw(&esinxe_default_rng);
}

uint64_t NextAt(uint64_t offset)
{
    return EsinxeNextAt(&esinxe_default_rng, offset);
}

uint64_t Next()
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

uint64_t NextMinMaxAt(uint64_t offset, uint64_t minvalue, uint64_t maxvalue)
{
    return EsinxeNextMinMaxAt(&esinxe_default_rng, offset, minvalue, maxvalue);
}

uint64_t NextMinMax(uint64_t minvalue, uint64_t maxvalue)
{
    return EsinxeNextMinMax(&esinxe_default_rng, minvalue, maxvalue);
}

#endif
