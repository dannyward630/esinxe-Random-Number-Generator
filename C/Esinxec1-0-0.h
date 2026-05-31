#ifndef ESINXEC_H_INCLUDED
#define ESINXEC_H_INCLUDED

#include <stdint.h>
#include <time.h>

static const uint64_t ESINXE_GAMMA = UINT64_C(0x9E3779B97F4A7C15);
static const uint64_t ESINXE_MAX_INT_VALUE = UINT64_C(1000000000000000000);
static uint64_t esinxe_seed = 0;
static uint64_t esinxe_index = 0;

static uint64_t EsinxeMix64(uint64_t value)
{
    value = (value ^ (value >> 30)) * UINT64_C(0xBF58476D1CE4E5B9);
    value = (value ^ (value >> 27)) * UINT64_C(0x94D049BB133111EB);
    return value ^ (value >> 31);
}

void SetSeed(uint64_t seed)
{
    esinxe_seed = seed;
    esinxe_index = 0;
}

void SetTimeSeed()
{
    SetSeed((uint64_t)time(0));
}

uint64_t NextRawAt(uint64_t offset)
{
    if (esinxe_seed == 0)
    {
        SetTimeSeed();
    }
    return EsinxeMix64(esinxe_seed + (offset * ESINXE_GAMMA));
}

uint64_t NextAt(uint64_t offset)
{
    return NextRawAt(offset) % ESINXE_MAX_INT_VALUE;
}

uint64_t Next()
{
    uint64_t value = NextAt(esinxe_index);
    esinxe_index++;
    return value;
}

uint64_t NextMaxAt(uint64_t offset, uint64_t maxvalue)
{
    if (maxvalue == 0)
    {
        return 0;
    }
    return NextRawAt(offset) % maxvalue;
}

uint64_t NextMax(uint64_t maxvalue)
{
    uint64_t value = NextMaxAt(esinxe_index, maxvalue);
    esinxe_index++;
    return value;
}

uint64_t NextMinMaxAt(uint64_t offset, uint64_t minvalue, uint64_t maxvalue)
{
    if (maxvalue <= minvalue)
    {
        return minvalue;
    }
    return minvalue + NextMaxAt(offset, maxvalue - minvalue);
}

uint64_t NextMinMax(uint64_t minvalue, uint64_t maxvalue)
{
    uint64_t value = NextMinMaxAt(esinxe_index, minvalue, maxvalue);
    esinxe_index++;
    return value;
}

#endif
