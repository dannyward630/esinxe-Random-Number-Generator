#ifndef ESINXECPP_H_INCLUDED
#define ESINXECPP_H_INCLUDED

#include <cstdint>
#include <cstring>
#include <ctime>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

namespace Esinxecpp
{
    struct Key
    {
        enum class Type : std::uint8_t
        {
            I64 = 0x01,
            U64 = 0x02,
            String = 0x03,
            Bytes = 0x04
        };

        Type type;
        std::uint64_t integer = 0;
        std::vector<std::uint8_t> data;

        static Key Signed(std::int64_t value)
        {
            return {Type::I64, static_cast<std::uint64_t>(value), {}};
        }

        static Key Unsigned(std::uint64_t value)
        {
            return {Type::U64, value, {}};
        }

        static Key Utf8(const std::string &value)
        {
            return {
                Type::String,
                0,
                std::vector<std::uint8_t>(value.begin(), value.end())};
        }

        static Key Bytes(const std::vector<std::uint8_t> &value)
        {
            return {Type::Bytes, 0, value};
        }
    };

    class Random
    {
    private:
        static constexpr std::uint64_t Gamma = 0x9E3779B97F4A7C15ULL;
        static constexpr std::uint64_t MaxIntValue = 1000000000000000000ULL;
        std::uint64_t seed = static_cast<std::uint64_t>(std::time(nullptr));
        std::uint64_t index = 0;
        std::uint64_t key = seed;

        static std::uint64_t Mix64(std::uint64_t value)
        {
            value = (value ^ (value >> 30)) * 0xBF58476D1CE4E5B9ULL;
            value = (value ^ (value >> 27)) * 0x94D049BB133111EBULL;
            return value ^ (value >> 31);
        }

        std::uint64_t RawAt(std::uint64_t offset) const
        {
            return Mix64(seed + (offset * Gamma));
        }

        static std::uint64_t Bounded(std::uint64_t value, std::uint64_t maxvalue)
        {
            if (maxvalue == 0)
            {
                return 0;
            }
            const std::uint64_t threshold =
                static_cast<std::uint64_t>(0 - maxvalue) % maxvalue;
            std::uint64_t nonce = 0;
            while (value < threshold)
            {
                nonce++;
                value = Mix64(value + (nonce * Gamma));
            }
            return value % maxvalue;
        }

        static std::uint64_t FnvByte(std::uint64_t hash, std::uint8_t value)
        {
            return (hash ^ value) * 0x100000001B3ULL;
        }

        static std::uint64_t FnvData(
            std::uint64_t hash,
            const std::uint8_t *data,
            std::size_t length)
        {
            for (std::size_t i = 0; i < length; i++)
            {
                hash = FnvByte(hash, data[i]);
            }
            return hash;
        }

        static std::uint64_t FnvU64(
            std::uint64_t hash,
            std::uint64_t value)
        {
            for (unsigned int shift = 0; shift < 64; shift += 8)
            {
                hash = FnvByte(
                    hash,
                    static_cast<std::uint8_t>(value >> shift));
            }
            return hash;
        }

        static std::uint64_t HashKey(std::uint64_t hash, const Key &component)
        {
            hash = FnvByte(hash, static_cast<std::uint8_t>(component.type));
            if (component.type == Key::Type::I64 ||
                component.type == Key::Type::U64)
            {
                return FnvU64(hash, component.integer);
            }
            hash = FnvU64(hash, component.data.size());
            return FnvData(hash, component.data.data(), component.data.size());
        }

        std::uint64_t KeyedRaw(
            const std::vector<Key> &components,
            const char *domain = nullptr) const
        {
            static const std::uint8_t prefix[] = {
                101, 115, 105, 110, 120, 101, 45, 118, 49, 0};
            std::uint64_t hash = 0xCBF29CE484222325ULL;
            hash = FnvData(hash, prefix, sizeof(prefix));
            hash = FnvU64(hash, seed);
            if (domain != nullptr)
            {
                const std::size_t length = std::strlen(domain);
                hash = FnvByte(hash, 0xF0);
                hash = FnvU64(hash, length);
                hash = FnvData(
                    hash,
                    reinterpret_cast<const std::uint8_t *>(domain),
                    length);
            }
            for (const Key &component : components)
            {
                hash = HashKey(hash, component);
            }
            return Mix64(hash);
        }

    public:
        explicit Random(std::uint64_t localSeed = static_cast<std::uint64_t>(std::time(nullptr)))
        {
            SetSeed(localSeed);
        }

        std::uint64_t Raw(const std::vector<Key> &components = {}) const
        {
            return KeyedRaw(components);
        }

        std::uint64_t Int(
            std::uint64_t maxvalue,
            const std::vector<Key> &components = {}) const
        {
            if (maxvalue == 0)
            {
                throw std::invalid_argument("maxvalue must be positive");
            }
            return Bounded(Raw(components), maxvalue);
        }

        std::int64_t Range(
            std::int64_t minvalue,
            std::int64_t maxvalue,
            const std::vector<Key> &components = {}) const
        {
            if (maxvalue <= minvalue)
            {
                throw std::invalid_argument(
                    "maxvalue must be greater than minvalue");
            }
            const std::uint64_t width =
                static_cast<std::uint64_t>(maxvalue) -
                static_cast<std::uint64_t>(minvalue);
            const std::uint64_t bits =
                static_cast<std::uint64_t>(minvalue) +
                Bounded(Raw(components), width);
            std::int64_t result;
            std::memcpy(&result, &bits, sizeof(result));
            return result;
        }

        double Float01(const std::vector<Key> &components = {}) const
        {
            return static_cast<double>(Raw(components) >> 11) /
                9007199254740992.0;
        }

        std::uint64_t At2D(
            std::int64_t x,
            std::int64_t y,
            const std::optional<std::string> &namespaceValue = std::nullopt) const
        {
            std::vector<Key> components = {Key::Signed(x), Key::Signed(y)};
            if (namespaceValue.has_value())
            {
                components.push_back(Key::Utf8(*namespaceValue));
            }
            return KeyedRaw(components, "at2d");
        }

        std::uint64_t At3D(
            std::int64_t x,
            std::int64_t y,
            std::int64_t z,
            const std::optional<std::string> &namespaceValue = std::nullopt) const
        {
            std::vector<Key> components = {
                Key::Signed(x),
                Key::Signed(y),
                Key::Signed(z)};
            if (namespaceValue.has_value())
            {
                components.push_back(Key::Utf8(*namespaceValue));
            }
            return KeyedRaw(components, "at3d");
        }

        bool ChanceRatio(
            std::int64_t numerator,
            std::int64_t denominator,
            const std::vector<Key> &components = {}) const
        {
            if (denominator <= 0)
            {
                throw std::invalid_argument("denominator must be positive");
            }
            if (numerator <= 0)
            {
                return false;
            }
            if (numerator >= denominator)
            {
                return true;
            }
            return Int(
                static_cast<std::uint64_t>(denominator),
                components) < static_cast<std::uint64_t>(numerator);
        }

        template <typename T>
        const T &Choose(
            const std::vector<T> &items,
            const std::vector<Key> &components = {}) const
        {
            if (items.empty())
            {
                throw std::invalid_argument("items must not be empty");
            }
            return items[static_cast<std::size_t>(Int(items.size(), components))];
        }

        template <typename T>
        std::vector<T> Shuffle(
            const std::vector<T> &items,
            const std::vector<Key> &components = {}) const
        {
            std::vector<T> values = items;
            for (std::size_t position = values.size(); position > 1; position--)
            {
                const std::size_t current = position - 1;
                std::vector<Key> iterationKeys = components;
                iterationKeys.push_back(Key::Unsigned(current));
                const std::size_t picked = static_cast<std::size_t>(
                    Bounded(
                        KeyedRaw(iterationKeys, "shuffle"),
                        position));
                std::swap(values[current], values[picked]);
            }
            return values;
        }

        template <typename T>
        const T &WeightedChoice(
            const std::vector<T> &items,
            const std::vector<std::uint64_t> &weights,
            const std::vector<Key> &components = {}) const
        {
            if (items.empty() || items.size() != weights.size())
            {
                throw std::invalid_argument(
                    "items and weights must have the same non-zero length");
            }
            std::uint64_t total = 0;
            for (std::uint64_t weight : weights)
            {
                const std::uint64_t next = total + weight;
                if (next < total)
                {
                    throw std::overflow_error("total weight exceeds uint64");
                }
                total = next;
            }
            if (total == 0)
            {
                throw std::invalid_argument("total weight must be positive");
            }
            const std::uint64_t target = Int(total, components);
            std::uint64_t running = 0;
            for (std::size_t i = 0; i < items.size(); i++)
            {
                running += weights[i];
                if (target < running)
                {
                    return items[i];
                }
            }
            throw std::logic_error("unreachable weighted choice");
        }

        void SetSeed(std::uint64_t localSeed)
        {
            seed = localSeed;
            index = 0;
            key = seed;
        }

        std::uint64_t NextAt(std::uint64_t offset) const
        {
            return Bounded(RawAt(offset), MaxIntValue);
        }

        std::uint64_t Next()
        {
            std::uint64_t value = Bounded(Mix64(key), MaxIntValue);
            key += Gamma;
            index++;
            return value;
        }

        std::uint64_t NextRawAt(std::uint64_t offset) const
        {
            return RawAt(offset);
        }

        std::uint64_t NextRaw()
        {
            std::uint64_t value = Mix64(key);
            key += Gamma;
            index++;
            return value;
        }

        std::uint64_t NextMaxAt(std::uint64_t offset, std::uint64_t maxvalue) const
        {
            return Bounded(RawAt(offset), maxvalue);
        }

        std::uint64_t NextMax(std::uint64_t maxvalue)
        {
            std::uint64_t value = Bounded(Mix64(key), maxvalue);
            key += Gamma;
            index++;
            return value;
        }

        std::uint64_t NextMinMaxAt(
            std::uint64_t offset,
            std::uint64_t minvalue,
            std::uint64_t maxvalue) const
        {
            if (maxvalue <= minvalue)
            {
                return minvalue;
            }
            return minvalue + NextMaxAt(offset, maxvalue - minvalue);
        }

        std::uint64_t NextMinMax(std::uint64_t minvalue, std::uint64_t maxvalue)
        {
            std::uint64_t value = minvalue;
            if (maxvalue > minvalue)
            {
                value = minvalue + Bounded(Mix64(key), maxvalue - minvalue);
            }
            key += Gamma;
            index++;
            return value;
        }

        std::vector<std::uint64_t> NextList(std::uint64_t length)
        {
            std::vector<std::uint64_t> values;
            values.reserve(static_cast<std::size_t>(length));
            for (std::uint64_t i = 0; i < length; i++)
            {
                values.push_back(Bounded(Mix64(key), MaxIntValue));
                key += Gamma;
            }
            index += length;
            return values;
        }

        std::vector<std::uint64_t> NextListMax(
            std::uint64_t length,
            std::uint64_t maxvalue)
        {
            std::vector<std::uint64_t> values;
            values.reserve(static_cast<std::size_t>(length));
            for (std::uint64_t i = 0; i < length; i++)
            {
                values.push_back(Bounded(Mix64(key), maxvalue));
                key += Gamma;
            }
            index += length;
            return values;
        }

        std::vector<std::uint64_t> NextListMinMax(
            std::uint64_t length,
            std::uint64_t minvalue,
            std::uint64_t maxvalue)
        {
            std::vector<std::uint64_t> values;
            values.reserve(static_cast<std::size_t>(length));
            for (std::uint64_t i = 0; i < length; i++)
            {
                values.push_back(
                    maxvalue > minvalue
                        ? minvalue + Bounded(Mix64(key), maxvalue - minvalue)
                        : minvalue);
                key += Gamma;
            }
            index += length;
            return values;
        }
    };
}

#endif
