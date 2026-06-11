#ifndef ESINXEC_H_INCLUDED
#define ESINXEC_H_INCLUDED

#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static const uint64_t ESINXE_GAMMA = UINT64_C(0x9E3779B97F4A7C15);
static const uint64_t ESINXE_MAX_INT_VALUE = UINT64_C(1000000000000000000);

typedef struct EsinxeRandom
{
    uint64_t seed;
    uint64_t index;
    uint64_t key;
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

typedef enum EsinxeKeyType
{
    ESINXE_KEY_I64 = 0x01,
    ESINXE_KEY_U64 = 0x02,
    ESINXE_KEY_STRING = 0x03,
    ESINXE_KEY_BYTES = 0x04
} EsinxeKeyType;

typedef struct EsinxeKey
{
    EsinxeKeyType type;
    uint64_t integer;
    const unsigned char *data;
    size_t length;
} EsinxeKey;

static inline EsinxeKey EsinxeI64(int64_t value)
{
    EsinxeKey key = {ESINXE_KEY_I64, (uint64_t)value, NULL, 0};
    return key;
}

static inline EsinxeKey EsinxeU64(uint64_t value)
{
    EsinxeKey key = {ESINXE_KEY_U64, value, NULL, 0};
    return key;
}

static inline EsinxeKey EsinxeString(const char *value)
{
    EsinxeKey key = {
        ESINXE_KEY_STRING,
        0,
        (const unsigned char *)value,
        value == NULL ? 0 : strlen(value)};
    return key;
}

static inline EsinxeKey EsinxeBytes(const void *value, size_t length)
{
    EsinxeKey key = {
        ESINXE_KEY_BYTES,
        0,
        (const unsigned char *)value,
        length};
    return key;
}

static inline uint64_t EsinxeFnvByte(uint64_t hash, unsigned char value)
{
    return (hash ^ value) * UINT64_C(0x100000001B3);
}

static inline uint64_t EsinxeFnvData(
    uint64_t hash,
    const unsigned char *data,
    size_t length)
{
    size_t index;
    for (index = 0; index < length; index++)
    {
        hash = EsinxeFnvByte(hash, data[index]);
    }
    return hash;
}

static inline uint64_t EsinxeFnvU64(uint64_t hash, uint64_t value)
{
    unsigned int shift;
    for (shift = 0; shift < 64; shift += 8)
    {
        hash = EsinxeFnvByte(hash, (unsigned char)(value >> shift));
    }
    return hash;
}

static inline uint64_t EsinxeHashKey(uint64_t hash, const EsinxeKey *key)
{
    hash = EsinxeFnvByte(hash, (unsigned char)key->type);
    if (key->type == ESINXE_KEY_I64 || key->type == ESINXE_KEY_U64)
    {
        return EsinxeFnvU64(hash, key->integer);
    }
    hash = EsinxeFnvU64(hash, (uint64_t)key->length);
    return EsinxeFnvData(hash, key->data, key->length);
}

static inline uint64_t EsinxeKeyedRaw(
    uint64_t seed,
    const EsinxeKey *keys,
    size_t key_count,
    const char *domain)
{
    static const unsigned char prefix[] = "esinxe-v1";
    uint64_t hash = UINT64_C(0xCBF29CE484222325);
    size_t index;

    hash = EsinxeFnvData(hash, prefix, sizeof(prefix));
    hash = EsinxeFnvU64(hash, seed);
    if (domain != NULL)
    {
        size_t length = strlen(domain);
        hash = EsinxeFnvByte(hash, 0xF0);
        hash = EsinxeFnvU64(hash, (uint64_t)length);
        hash = EsinxeFnvData(
            hash,
            (const unsigned char *)domain,
            length);
    }
    for (index = 0; index < key_count; index++)
    {
        hash = EsinxeHashKey(hash, &keys[index]);
    }
    return EsinxeMix64(hash);
}

static inline uint64_t EsinxeRawV1(
    uint64_t seed,
    const EsinxeKey *keys,
    size_t key_count)
{
    return EsinxeKeyedRaw(seed, keys, key_count, NULL);
}

static inline int EsinxeIntV1(
    uint64_t seed,
    uint64_t maxvalue,
    const EsinxeKey *keys,
    size_t key_count,
    uint64_t *result)
{
    if (maxvalue == 0 || result == NULL)
    {
        return 0;
    }
    *result = EsinxeBounded(EsinxeRawV1(seed, keys, key_count), maxvalue);
    return 1;
}

static inline int EsinxeRangeV1(
    uint64_t seed,
    int64_t minvalue,
    int64_t maxvalue,
    const EsinxeKey *keys,
    size_t key_count,
    int64_t *result)
{
    uint64_t width;
    uint64_t bits;
    if (maxvalue <= minvalue || result == NULL)
    {
        return 0;
    }
    width = (uint64_t)maxvalue - (uint64_t)minvalue;
    bits = (uint64_t)minvalue +
        EsinxeBounded(EsinxeRawV1(seed, keys, key_count), width);
    memcpy(result, &bits, sizeof(bits));
    return 1;
}

static inline double EsinxeFloat01V1(
    uint64_t seed,
    const EsinxeKey *keys,
    size_t key_count)
{
    return (double)(EsinxeRawV1(seed, keys, key_count) >> 11) /
        9007199254740992.0;
}

static inline uint64_t EsinxeAt2DV1(
    uint64_t seed,
    int64_t x,
    int64_t y,
    const char *namespace_value)
{
    EsinxeKey keys[3];
    size_t count = 2;
    keys[0] = EsinxeI64(x);
    keys[1] = EsinxeI64(y);
    if (namespace_value != NULL)
    {
        keys[2] = EsinxeString(namespace_value);
        count = 3;
    }
    return EsinxeKeyedRaw(seed, keys, count, "at2d");
}

static inline uint64_t EsinxeAt3DV1(
    uint64_t seed,
    int64_t x,
    int64_t y,
    int64_t z,
    const char *namespace_value)
{
    EsinxeKey keys[4];
    size_t count = 3;
    keys[0] = EsinxeI64(x);
    keys[1] = EsinxeI64(y);
    keys[2] = EsinxeI64(z);
    if (namespace_value != NULL)
    {
        keys[3] = EsinxeString(namespace_value);
        count = 4;
    }
    return EsinxeKeyedRaw(seed, keys, count, "at3d");
}

static inline int EsinxeChanceRatioV1(
    uint64_t seed,
    int64_t numerator,
    int64_t denominator,
    const EsinxeKey *keys,
    size_t key_count)
{
    uint64_t value;
    if (denominator <= 0)
    {
        return -1;
    }
    if (numerator <= 0)
    {
        return 0;
    }
    if (numerator >= denominator)
    {
        return 1;
    }
    EsinxeIntV1(seed, (uint64_t)denominator, keys, key_count, &value);
    return value < (uint64_t)numerator;
}

static inline size_t EsinxeChooseIndexV1(
    uint64_t seed,
    size_t item_count,
    const EsinxeKey *keys,
    size_t key_count)
{
    uint64_t value;
    if (item_count == 0)
    {
        return SIZE_MAX;
    }
    EsinxeIntV1(seed, (uint64_t)item_count, keys, key_count, &value);
    return (size_t)value;
}

static inline int EsinxeShuffleV1(
    uint64_t seed,
    void *items,
    size_t item_count,
    size_t item_size,
    const EsinxeKey *keys,
    size_t key_count)
{
    unsigned char *values = (unsigned char *)items;
    unsigned char *temporary;
    EsinxeKey *iteration_keys;
    size_t position;
    if (item_count < 2)
    {
        return 1;
    }
    if (items == NULL || item_size == 0)
    {
        return 0;
    }
    temporary = (unsigned char *)malloc(item_size);
    iteration_keys = (EsinxeKey *)malloc((key_count + 1) * sizeof(EsinxeKey));
    if (temporary == NULL || iteration_keys == NULL)
    {
        free(temporary);
        free(iteration_keys);
        return 0;
    }
    if (key_count > 0)
    {
        memcpy(iteration_keys, keys, key_count * sizeof(EsinxeKey));
    }
    for (position = item_count - 1; position > 0; position--)
    {
        size_t picked;
        iteration_keys[key_count] = EsinxeU64((uint64_t)position);
        picked = (size_t)EsinxeBounded(
            EsinxeKeyedRaw(
                seed,
                iteration_keys,
                key_count + 1,
                "shuffle"),
            (uint64_t)position + 1);
        memcpy(temporary, values + position * item_size, item_size);
        memcpy(
            values + position * item_size,
            values + picked * item_size,
            item_size);
        memcpy(values + picked * item_size, temporary, item_size);
    }
    free(temporary);
    free(iteration_keys);
    return 1;
}

static inline size_t EsinxeWeightedChoiceIndexV1(
    uint64_t seed,
    const uint64_t *weights,
    size_t item_count,
    const EsinxeKey *keys,
    size_t key_count)
{
    uint64_t total = 0;
    uint64_t target;
    uint64_t running = 0;
    size_t index;
    if (weights == NULL || item_count == 0)
    {
        return SIZE_MAX;
    }
    for (index = 0; index < item_count; index++)
    {
        uint64_t next = total + weights[index];
        if (next < total)
        {
            return SIZE_MAX;
        }
        total = next;
    }
    if (total == 0)
    {
        return SIZE_MAX;
    }
    EsinxeIntV1(seed, total, keys, key_count, &target);
    for (index = 0; index < item_count; index++)
    {
        running += weights[index];
        if (target < running)
        {
            return index;
        }
    }
    return SIZE_MAX;
}

void EsinxeInit(EsinxeRandom *rng, uint64_t seed)
{
    rng->seed = seed;
    rng->index = 0;
    rng->key = seed;
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
    uint64_t value = EsinxeMix64(rng->key);
    rng->key += ESINXE_GAMMA;
    rng->index++;
    return value;
}

uint64_t EsinxeNextAt(const EsinxeRandom *rng, uint64_t offset)
{
    return EsinxeBounded(EsinxeNextRawAt(rng, offset), ESINXE_MAX_INT_VALUE);
}

uint64_t EsinxeNext(EsinxeRandom *rng)
{
    uint64_t value = EsinxeBounded(EsinxeMix64(rng->key), ESINXE_MAX_INT_VALUE);
    rng->key += ESINXE_GAMMA;
    rng->index++;
    return value;
}

uint64_t EsinxeNextMaxAt(const EsinxeRandom *rng, uint64_t offset, uint64_t maxvalue)
{
    return EsinxeBounded(EsinxeNextRawAt(rng, offset), maxvalue);
}

uint64_t EsinxeNextMax(EsinxeRandom *rng, uint64_t maxvalue)
{
    uint64_t value = EsinxeBounded(EsinxeMix64(rng->key), maxvalue);
    rng->key += ESINXE_GAMMA;
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
    uint64_t value = minvalue;
    if (maxvalue > minvalue)
    {
        value = minvalue + EsinxeBounded(EsinxeMix64(rng->key), maxvalue - minvalue);
    }
    rng->key += ESINXE_GAMMA;
    rng->index++;
    return value;
}

static EsinxeRandom esinxe_default_rng = {0, 0, 0};

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
