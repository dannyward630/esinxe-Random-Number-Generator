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

/* Explicit byte length preserves embedded NUL; bytes must be strict UTF-8. */
static inline EsinxeKey EsinxeStringN(const char *value, size_t length)
{
    EsinxeKey key = {ESINXE_KEY_STRING, 0, (const unsigned char *)value, length};
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
    /* Check all size arithmetic before allocation, copying, or pointer math. */
    if (items == NULL || item_size == 0 ||
        item_count > SIZE_MAX / item_size ||
        key_count >= SIZE_MAX / sizeof(EsinxeKey) ||
        (key_count > 0 && keys == NULL))
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
        if (picked != position)
        {
            memcpy(temporary, values + position * item_size, item_size);
            memcpy(
                values + position * item_size,
                values + picked * item_size,
                item_size);
            memcpy(values + picked * item_size, temporary, item_size);
        }
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

/* Scoped fields borrow immutable prefix metadata/payloads. Scope copies metadata
 * into caller-provided storage; keep that storage alive while using the field. */
typedef struct EsinxeFieldV1
{
    uint64_t seed;
    const EsinxeKey *prefix;
    size_t prefix_count;
} EsinxeFieldV1;

static inline int EsinxeValidKeysV1(const EsinxeKey *keys, size_t count)
{
    size_t i;
    if (count > SIZE_MAX / sizeof(EsinxeKey) || (count != 0 && keys == NULL))
        return 0;
    for (i = 0; i < count; ++i)
    {
        const EsinxeKey *k = &keys[i];
        size_t j = 0;
        if (k->type == ESINXE_KEY_I64 || k->type == ESINXE_KEY_U64) continue;
        if ((k->type != ESINXE_KEY_STRING && k->type != ESINXE_KEY_BYTES) ||
            (k->length != 0 && k->data == NULL)) return 0;
        if (k->type == ESINXE_KEY_BYTES) continue;
        while (j < k->length)
        {
            uint32_t point = k->data[j++], minimum;
            unsigned int extra, n;
            if (point < 0x80) continue;
            if (point >= 0xc2 && point <= 0xdf)
                { extra = 1; minimum = 0x80; point &= 0x1f; }
            else if (point >= 0xe0 && point <= 0xef)
                { extra = 2; minimum = 0x800; point &= 0x0f; }
            else if (point >= 0xf0 && point <= 0xf4)
                { extra = 3; minimum = 0x10000; point &= 7; }
            else return 0;
            if (extra > k->length - j) return 0;
            for (n = 0; n < extra; ++n)
            {
                unsigned char byte = k->data[j++];
                if ((byte & 0xc0) != 0x80) return 0;
                point = (point << 6) | (byte & 0x3f);
            }
            if (point < minimum || point > 0x10ffff ||
                (point >= 0xd800 && point <= 0xdfff)) return 0;
        }
    }
    return 1;
}

static inline int EsinxeValidFieldV1(const EsinxeFieldV1 *field)
{
    return field != NULL && EsinxeValidKeysV1(field->prefix, field->prefix_count);
}

static inline void EsinxeFieldInitV1(EsinxeFieldV1 *field, uint64_t seed)
{
    field->seed = seed;
    field->prefix = NULL;
    field->prefix_count = 0;
}

static inline int EsinxeFieldScopeV1(
    const EsinxeFieldV1 *parent, const EsinxeKey *prefix, size_t prefix_count,
    EsinxeKey *storage, size_t capacity, EsinxeFieldV1 *result)
{
    size_t count;
    EsinxeFieldV1 next;
    if (!EsinxeValidFieldV1(parent) || !EsinxeValidKeysV1(prefix, prefix_count) ||
        result == NULL || prefix_count > SIZE_MAX - parent->prefix_count) return 0;
    count = parent->prefix_count + prefix_count;
    if (count > capacity || count > SIZE_MAX / sizeof(EsinxeKey) ||
        (count && storage == NULL)) return 0;
    next.seed = parent->seed;
    next.prefix = storage;
    next.prefix_count = count;
    if (parent->prefix_count)
        memmove(storage, parent->prefix, parent->prefix_count * sizeof(EsinxeKey));
    if (prefix_count)
        memmove(storage + parent->prefix_count, prefix, prefix_count * sizeof(EsinxeKey));
    *result = next;
    return 1;
}

/* Callers of raw/float/coordinate functions supply valid keys and field. */
static inline uint64_t EsinxeFieldHashV1(
    const EsinxeFieldV1 *field, const EsinxeKey *keys, size_t key_count,
    const char *domain, const EsinxeKey *suffix)
{
    static const unsigned char prefix[] = "esinxe-v1";
    uint64_t hash = UINT64_C(0xCBF29CE484222325);
    size_t i;
    hash = EsinxeFnvData(hash, prefix, sizeof(prefix));
    hash = EsinxeFnvU64(hash, field->seed);
    if (domain != NULL)
    {
        size_t length = strlen(domain);
        hash = EsinxeFnvByte(hash, 0xf0);
        hash = EsinxeFnvU64(hash, length);
        hash = EsinxeFnvData(hash, (const unsigned char *)domain, length);
    }
    for (i = 0; i < field->prefix_count; ++i)
        hash = EsinxeHashKey(hash, &field->prefix[i]);
    for (i = 0; i < key_count; ++i) hash = EsinxeHashKey(hash, &keys[i]);
    if (suffix != NULL) hash = EsinxeHashKey(hash, suffix);
    return EsinxeMix64(hash);
}

static inline uint64_t EsinxeFieldRawV1(
    const EsinxeFieldV1 *field, const EsinxeKey *keys, size_t key_count)
{
    return EsinxeFieldHashV1(field, keys, key_count, NULL, NULL);
}

static inline int EsinxeFieldIntV1(
    const EsinxeFieldV1 *field, uint64_t bound, const EsinxeKey *keys,
    size_t key_count, uint64_t *result)
{
    if (!bound || !result || !EsinxeValidFieldV1(field) ||
        !EsinxeValidKeysV1(keys, key_count)) return 0;
    *result = EsinxeBounded(EsinxeFieldRawV1(field, keys, key_count), bound);
    return 1;
}

static inline int EsinxeFieldRangeV1(
    const EsinxeFieldV1 *field, int64_t minvalue, int64_t maxvalue,
    const EsinxeKey *keys, size_t key_count, int64_t *result)
{
    uint64_t offset, bits;
    if (maxvalue <= minvalue || result == NULL ||
        !EsinxeFieldIntV1(field, (uint64_t)maxvalue - (uint64_t)minvalue,
                          keys, key_count, &offset)) return 0;
    bits = (uint64_t)minvalue + offset;
    memcpy(result, &bits, sizeof(bits));
    return 1;
}

static inline double EsinxeFieldFloat01V1(
    const EsinxeFieldV1 *field, const EsinxeKey *keys, size_t key_count)
{
    return (double)(EsinxeFieldRawV1(field, keys, key_count) >> 11) / 9007199254740992.0;
}

static inline uint64_t EsinxeFieldAt2DNV1(
    const EsinxeFieldV1 *field, int64_t x, int64_t y,
    const char *namespace_value, size_t namespace_length)
{
    EsinxeKey keys[3];
    keys[0] = EsinxeI64(x); keys[1] = EsinxeI64(y);
    keys[2] = EsinxeStringN(namespace_value, namespace_length);
    return EsinxeFieldHashV1(field, keys, namespace_value == NULL ? 2 : 3, "at2d", NULL);
}

static inline uint64_t EsinxeFieldAt3DNV1(
    const EsinxeFieldV1 *field, int64_t x, int64_t y, int64_t z,
    const char *namespace_value, size_t namespace_length)
{
    EsinxeKey keys[4];
    keys[0] = EsinxeI64(x); keys[1] = EsinxeI64(y); keys[2] = EsinxeI64(z);
    keys[3] = EsinxeStringN(namespace_value, namespace_length);
    return EsinxeFieldHashV1(field, keys, namespace_value == NULL ? 3 : 4, "at3d", NULL);
}

static inline uint64_t EsinxeAt2DNV1(uint64_t seed, int64_t x, int64_t y,
                                    const char *namespace_value, size_t length)
{
    EsinxeFieldV1 field; EsinxeFieldInitV1(&field, seed);
    return EsinxeFieldAt2DNV1(&field, x, y, namespace_value, length);
}

static inline uint64_t EsinxeAt3DNV1(uint64_t seed, int64_t x, int64_t y, int64_t z,
                                    const char *namespace_value, size_t length)
{
    EsinxeFieldV1 field; EsinxeFieldInitV1(&field, seed);
    return EsinxeFieldAt3DNV1(&field, x, y, z, namespace_value, length);
}

static inline uint64_t EsinxeFieldAt2DV1(
    const EsinxeFieldV1 *field, int64_t x, int64_t y, const char *namespace_value)
{
    return EsinxeFieldAt2DNV1(field, x, y, namespace_value,
                             namespace_value == NULL ? 0 : strlen(namespace_value));
}

static inline uint64_t EsinxeFieldAt3DV1(
    const EsinxeFieldV1 *field, int64_t x, int64_t y, int64_t z,
    const char *namespace_value)
{
    return EsinxeFieldAt3DNV1(field, x, y, z, namespace_value,
                             namespace_value == NULL ? 0 : strlen(namespace_value));
}

static inline int EsinxeFieldChanceRatioV1(
    const EsinxeFieldV1 *field, int64_t numerator, int64_t denominator,
    const EsinxeKey *keys, size_t key_count)
{
    uint64_t value;
    if (denominator <= 0 || !EsinxeValidFieldV1(field) ||
        !EsinxeValidKeysV1(keys, key_count)) return -1;
    if (numerator <= 0) return 0;
    if (numerator >= denominator) return 1;
    if (!EsinxeFieldIntV1(field, (uint64_t)denominator, keys, key_count, &value)) return -1;
    return value < (uint64_t)numerator;
}

static inline size_t EsinxeFieldChooseIndexV1(
    const EsinxeFieldV1 *field, size_t count, const EsinxeKey *keys, size_t key_count)
{
    uint64_t value;
    return EsinxeFieldIntV1(field, (uint64_t)count, keys, key_count, &value)
        ? (size_t)value : SIZE_MAX;
}

/* IDs are string keys (explicit lengths permit embedded NUL). Error: SIZE_MAX. */
static inline size_t EsinxeFieldStableChoiceIndexV1(
    const EsinxeFieldV1 *field, const EsinxeKey *ids, size_t count,
    const EsinxeKey *keys, size_t key_count)
{
    size_t i, j, winner = 0;
    uint64_t best = 0;
    if (!count || !EsinxeValidFieldV1(field) ||
        !EsinxeValidKeysV1(keys, key_count) || !EsinxeValidKeysV1(ids, count)) return SIZE_MAX;
    for (i = 0; i < count; ++i) {
        uint64_t score;
        int order = 0;
        size_t common;
        if (ids[i].type != ESINXE_KEY_STRING) return SIZE_MAX;
        for (j = 0; j < i; ++j)
            if (ids[i].length == ids[j].length &&
                (!ids[i].length || memcmp(ids[i].data, ids[j].data, ids[i].length) == 0)) return SIZE_MAX;
        score = EsinxeFieldHashV1(field, keys, key_count, "stable-choice-v1", &ids[i]);
        common = ids[i].length < ids[winner].length ? ids[i].length : ids[winner].length;
        if (common) order = memcmp(ids[i].data, ids[winner].data, common);
        if (!order) order = (ids[i].length > ids[winner].length) - (ids[i].length < ids[winner].length);
        if (i == 0 || score > best || (score == best && order < 0)) { winner = i; best = score; }
    }
    return winner;
}

static inline size_t EsinxeStableChoiceIndexV1(
    uint64_t seed, const EsinxeKey *ids, size_t count,
    const EsinxeKey *keys, size_t key_count)
{
    EsinxeFieldV1 field = {seed, NULL, 0};
    return EsinxeFieldStableChoiceIndexV1(&field, ids, count, keys, key_count);
}

static inline int EsinxeFieldPermuteV1(
    const EsinxeFieldV1 *field, void *items, size_t count, size_t size,
    const EsinxeKey *keys, size_t key_count, const char *domain)
{
    unsigned char *values = (unsigned char *)items, *temporary;
    size_t position;
    if (!EsinxeValidFieldV1(field) || !EsinxeValidKeysV1(keys, key_count) ||
        (count && (items == NULL || size == 0)) ||
        (size && count > SIZE_MAX / size)) return 0;
    if (count < 2) return 1;
    temporary = (unsigned char *)malloc(size);
    if (!temporary) return 0;
    for (position = count - 1; position > 0; --position)
    {
        EsinxeKey iteration = EsinxeU64((uint64_t)position);
        size_t picked = (size_t)EsinxeBounded(
            EsinxeFieldHashV1(field, keys, key_count, domain, &iteration),
            (uint64_t)position + 1);
        if (picked != position)
        {
            memcpy(temporary, values + position * size, size);
            memcpy(values + position * size, values + picked * size, size);
            memcpy(values + picked * size, temporary, size);
        }
    }
    free(temporary); return 1;
}

static inline int EsinxeFieldShuffleV1(
    const EsinxeFieldV1 *field, void *items, size_t count, size_t size,
    const EsinxeKey *keys, size_t key_count)
{
    return EsinxeFieldPermuteV1(field, items, count, size, keys, key_count, "shuffle");
}

static inline int EsinxeFieldSampleV1(
    const EsinxeFieldV1 *field, const void *items, size_t count, size_t size,
    size_t sample_count, void *result, const EsinxeKey *keys, size_t key_count)
{
    void *copy;
    int success;
    if (sample_count > count || !EsinxeValidFieldV1(field) ||
        !EsinxeValidKeysV1(keys, key_count) ||
        (count && (!items || !size)) || (sample_count && !result) ||
        (size && count > SIZE_MAX / size)) return 0;
    if (count == 0) return 1;
    copy = malloc(count * size);
    if (!copy) return 0;
    memcpy(copy, items, count * size);
    success = EsinxeFieldPermuteV1(field, copy, count, size, keys, key_count, "sample-v1");
    if (success && sample_count) memcpy(result, copy, sample_count * size);
    free(copy); return success;
}

static inline int EsinxeSampleV1(
    uint64_t seed, const void *items, size_t count, size_t size, size_t sample_count,
    void *result, const EsinxeKey *keys, size_t key_count)
{
    EsinxeFieldV1 field; EsinxeFieldInitV1(&field, seed);
    return EsinxeFieldSampleV1(&field, items, count, size, sample_count, result, keys, key_count);
}

static inline size_t EsinxeFieldWeightedChoiceIndexV1(
    const EsinxeFieldV1 *field, const uint64_t *weights, size_t count,
    const EsinxeKey *keys, size_t key_count)
{
    uint64_t total = 0, target, running = 0;
    size_t i;
    if (weights == NULL || count == 0 || count > SIZE_MAX / sizeof(uint64_t)) return SIZE_MAX;
    for (i = 0; i < count; ++i)
    {
        uint64_t next = total + weights[i];
        if (next < total) return SIZE_MAX;
        total = next;
    }
    if (!EsinxeFieldIntV1(field, total, keys, key_count, &target)) return SIZE_MAX;
    for (i = 0; i < count; ++i)
    {
        running += weights[i];
        if (target < running) return i;
    }
    return SIZE_MAX;
}

/* Initialize to {0}; init owns cumulative totals and a deep prefix snapshot.
 * Free before discarding. Do not shallow-copy this owning struct. */
typedef struct EsinxePreparedWeightedV1
{
    EsinxeFieldV1 field;
    uint64_t *cumulative;
    size_t count;
    EsinxeKey *owned_prefix;
} EsinxePreparedWeightedV1;

static inline void EsinxePreparedWeightedFreeV1(EsinxePreparedWeightedV1 *prepared)
{
    if (prepared == NULL) return;
    free(prepared->cumulative); free(prepared->owned_prefix);
    memset(prepared, 0, sizeof(*prepared));
}

static inline int EsinxePreparedWeightedInitV1(
    EsinxePreparedWeightedV1 *prepared, const EsinxeFieldV1 *field,
    const uint64_t *weights, size_t count)
{
    EsinxePreparedWeightedV1 next = {{0, NULL, 0}, NULL, 0, NULL};
    size_t bytes, i, offset;
    uint64_t total = 0;
    unsigned char *payload;
    if (!prepared || !EsinxeValidFieldV1(field) || !weights || !count ||
        count > SIZE_MAX / sizeof(uint64_t)) return 0;
    bytes = field->prefix_count * sizeof(EsinxeKey);
    for (i = 0; i < field->prefix_count; ++i)
    {
        const EsinxeKey *k = &field->prefix[i];
        if (k->type != ESINXE_KEY_STRING && k->type != ESINXE_KEY_BYTES) continue;
        if (k->length > SIZE_MAX - bytes) return 0;
        bytes += k->length;
    }
    next.cumulative = (uint64_t *)malloc(count * sizeof(uint64_t));
    if (!next.cumulative) return 0;
    for (i = 0; i < count; ++i)
    {
        uint64_t sum = total + weights[i];
        if (sum < total) { EsinxePreparedWeightedFreeV1(&next); return 0; }
        total = sum; next.cumulative[i] = total;
    }
    if (!total) { EsinxePreparedWeightedFreeV1(&next); return 0; }
    if (bytes)
    {
        next.owned_prefix = (EsinxeKey *)malloc(bytes);
        if (!next.owned_prefix) { EsinxePreparedWeightedFreeV1(&next); return 0; }
        memcpy(next.owned_prefix, field->prefix, field->prefix_count * sizeof(EsinxeKey));
        payload = (unsigned char *)next.owned_prefix;
        offset = field->prefix_count * sizeof(EsinxeKey);
        for (i = 0; i < field->prefix_count; ++i)
        {
            EsinxeKey *k = &next.owned_prefix[i];
            if (k->type != ESINXE_KEY_STRING && k->type != ESINXE_KEY_BYTES) continue;
            if (k->length) memcpy(payload + offset, k->data, k->length);
            k->data = payload + offset; offset += k->length;
        }
    }
    next.field.seed = field->seed;
    next.field.prefix = next.owned_prefix;
    next.field.prefix_count = field->prefix_count;
    next.count = count;
    EsinxePreparedWeightedFreeV1(prepared); *prepared = next;
    return 1;
}

static inline size_t EsinxePreparedWeightedChooseV1(
    const EsinxePreparedWeightedV1 *prepared, const EsinxeKey *keys, size_t key_count)
{
    size_t low = 0, high;
    uint64_t target;
    if (!prepared || !prepared->cumulative || !prepared->count ||
        !EsinxeFieldIntV1(&prepared->field, prepared->cumulative[prepared->count - 1],
                          keys, key_count, &target)) return SIZE_MAX;
    high = prepared->count;
    while (low < high)
    {
        size_t middle = low + (high - low) / 2;
        if (prepared->cumulative[middle] <= target) low = middle + 1;
        else high = middle;
    }
    return low;
}

static inline void EsinxeInit(EsinxeRandom *rng, uint64_t seed)
{
    rng->seed = seed;
    rng->index = 0;
    rng->key = seed;
}

static inline void EsinxeSetTimeSeed(EsinxeRandom *rng)
{
    EsinxeInit(rng, (uint64_t)time(0));
}

static inline uint64_t EsinxeNextRawAt(
    const EsinxeRandom *rng,
    uint64_t offset)
{
    return EsinxeMix64(rng->seed + (offset * ESINXE_GAMMA));
}

static inline uint64_t EsinxeNextRaw(EsinxeRandom *rng)
{
    uint64_t value = EsinxeMix64(rng->key);
    rng->key += ESINXE_GAMMA;
    rng->index++;
    return value;
}

static inline uint64_t EsinxeNextAt(
    const EsinxeRandom *rng,
    uint64_t offset)
{
    return EsinxeBounded(EsinxeNextRawAt(rng, offset), ESINXE_MAX_INT_VALUE);
}

static inline uint64_t EsinxeNext(EsinxeRandom *rng)
{
    uint64_t value = EsinxeBounded(EsinxeMix64(rng->key), ESINXE_MAX_INT_VALUE);
    rng->key += ESINXE_GAMMA;
    rng->index++;
    return value;
}

static inline uint64_t EsinxeNextMaxAt(
    const EsinxeRandom *rng,
    uint64_t offset,
    uint64_t maxvalue)
{
    return EsinxeBounded(EsinxeNextRawAt(rng, offset), maxvalue);
}

static inline uint64_t EsinxeNextMax(
    EsinxeRandom *rng,
    uint64_t maxvalue)
{
    uint64_t value = EsinxeBounded(EsinxeMix64(rng->key), maxvalue);
    rng->key += ESINXE_GAMMA;
    rng->index++;
    return value;
}

static inline uint64_t EsinxeNextMinMaxAt(
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

static inline uint64_t EsinxeNextMinMax(
    EsinxeRandom *rng,
    uint64_t minvalue,
    uint64_t maxvalue)
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

/*
 * Legacy process-wide wrappers are defined in Esinxec1-0-0.c. New code should
 * prefer caller-owned EsinxeRandom instances, which are thread-safe when each
 * instance is owned by one thread.
 */
void SetSeed(uint64_t seed);
void SetTimeSeed(void);
uint64_t NextRawAt(uint64_t offset);
uint64_t NextRaw(void);
uint64_t NextAt(uint64_t offset);
uint64_t Next(void);
uint64_t NextMaxAt(uint64_t offset, uint64_t maxvalue);
uint64_t NextMax(uint64_t maxvalue);
uint64_t NextMinMaxAt(
    uint64_t offset,
    uint64_t minvalue,
    uint64_t maxvalue);
uint64_t NextMinMax(
    uint64_t minvalue,
    uint64_t maxvalue);

#endif
