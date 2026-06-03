using System;
using System.Collections.Generic;

namespace Esinxecs
{
    public class Random
    {
        private const ulong Gamma = 0x9E3779B97F4A7C15UL;
        private const ulong MaxIntValue = 1000000000000000000UL;
        private ulong seed = (ulong)DateTime.Now.Ticks;
        private ulong index = 0;
        private ulong key = 0;

        public Random()
        {
            key = seed;
        }

        private static ulong Mix64(ulong value)
        {
            value = (value ^ (value >> 30)) * 0xBF58476D1CE4E5B9UL;
            value = (value ^ (value >> 27)) * 0x94D049BB133111EBUL;
            return value ^ (value >> 31);
        }

        private ulong RawAt(ulong offset)
        {
            return Mix64(seed + (offset * Gamma));
        }

        private static ulong Bounded(ulong value, ulong maxvalue)
        {
            if (maxvalue == 0)
            {
                return 0;
            }

            ulong threshold = unchecked(0UL - maxvalue) % maxvalue;
            ulong nonce = 0;
            while (value < threshold)
            {
                nonce++;
                value = Mix64(value + (nonce * Gamma));
            }
            return value % maxvalue;
        }

        public void SetSeed(ulong localSeed)
        {
            seed = localSeed;
            index = 0;
            key = seed;
        }

        public ulong NextAt(ulong offset)
        {
            return Bounded(RawAt(offset), MaxIntValue);
        }

        public ulong Next()
        {
            ulong value = Bounded(Mix64(key), MaxIntValue);
            key += Gamma;
            index++;
            return value;
        }

        public ulong NextRawAt(ulong offset)
        {
            return RawAt(offset);
        }

        public ulong NextRaw()
        {
            ulong value = Mix64(key);
            key += Gamma;
            index++;
            return value;
        }

        public ulong NextMaxAt(ulong offset, ulong maxvalue)
        {
            return Bounded(RawAt(offset), maxvalue);
        }

        public ulong NextMax(ulong maxvalue)
        {
            ulong value = Bounded(Mix64(key), maxvalue);
            key += Gamma;
            index++;
            return value;
        }

        public ulong NextMinMaxAt(ulong offset, ulong minvalue, ulong maxvalue)
        {
            if (maxvalue <= minvalue)
            {
                return minvalue;
            }
            return minvalue + NextMaxAt(offset, maxvalue - minvalue);
        }

        public ulong NextMinMax(ulong minvalue, ulong maxvalue)
        {
            ulong value = minvalue;
            if (maxvalue > minvalue)
            {
                value = minvalue + Bounded(Mix64(key), maxvalue - minvalue);
            }
            key += Gamma;
            index++;
            return value;
        }

        public List<ulong> NextList(ulong length)
        {
            List<ulong> values = new();
            for (ulong i = 0; i < length; i++)
            {
                values.Add(Bounded(Mix64(key), MaxIntValue));
                key += Gamma;
            }
            index += length;
            return values;
        }

        public List<ulong> NextListMax(ulong length, ulong maxvalue)
        {
            List<ulong> values = new();
            for (ulong i = 0; i < length; i++)
            {
                values.Add(Bounded(Mix64(key), maxvalue));
                key += Gamma;
            }
            index += length;
            return values;
        }

        public List<ulong> NextListMinMax(ulong length, ulong minvalue, ulong maxvalue)
        {
            List<ulong> values = new();
            for (ulong i = 0; i < length; i++)
            {
                values.Add(
                    maxvalue > minvalue
                        ? minvalue + Bounded(Mix64(key), maxvalue - minvalue)
                        : minvalue);
                key += Gamma;
            }
            index += length;
            return values;
        }
    }
}
