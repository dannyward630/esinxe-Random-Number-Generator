#ifndef ESINXECPP_H_INCLUDED
#define ESINXECPP_H_INCLUDED

#include <cstdint>
#include <ctime>
#include <vector>

namespace Esinxecpp
{
    class Random
    {
    private:
        static constexpr std::uint64_t Gamma = 0x9E3779B97F4A7C15ULL;
        static constexpr std::uint64_t MaxIntValue = 1000000000000000000ULL;
        std::uint64_t seed = static_cast<std::uint64_t>(std::time(nullptr));
        std::uint64_t index = 0;

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

    public:
        void SetSeed(std::uint64_t localSeed)
        {
            seed = localSeed;
            index = 0;
        }

        std::uint64_t NextAt(std::uint64_t offset) const
        {
            return RawAt(offset) % MaxIntValue;
        }

        std::uint64_t Next()
        {
            return NextAt(index++);
        }

        std::uint64_t NextMaxAt(std::uint64_t offset, std::uint64_t maxvalue) const
        {
            if (maxvalue == 0)
            {
                return 0;
            }
            return RawAt(offset) % maxvalue;
        }

        std::uint64_t NextMax(std::uint64_t maxvalue)
        {
            return NextMaxAt(index++, maxvalue);
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
            return NextMinMaxAt(index++, minvalue, maxvalue);
        }

        std::vector<std::uint64_t> NextList(std::uint64_t length)
        {
            std::vector<std::uint64_t> values;
            values.reserve(static_cast<std::size_t>(length));
            for (std::uint64_t i = 0; i < length; i++)
            {
                values.push_back(NextAt(index + i));
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
                values.push_back(NextMaxAt(index + i, maxvalue));
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
                values.push_back(NextMinMaxAt(index + i, minvalue, maxvalue));
            }
            index += length;
            return values;
        }
    };
}

#endif
