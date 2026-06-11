using System;
using System.Collections.Generic;
using System.Text;

namespace Esinxecs
{
    public class Random
    {
        private const ulong Gamma = 0x9E3779B97F4A7C15UL;
        private const ulong MaxIntValue = 1000000000000000000UL;
        private const ulong FnvOffsetBasis = 0xCBF29CE484222325UL;
        private const ulong FnvPrime = 0x100000001B3UL;
        private static readonly byte[] V1Prefix = Encoding.ASCII.GetBytes("esinxe-v1\0");

        public sealed class Key
        {
            internal readonly byte Tag;
            internal readonly ulong Integer;
            internal readonly byte[] Data;

            private Key(byte tag, ulong integer, byte[]? data)
            {
                Tag = tag;
                Integer = integer;
                Data = data ?? Array.Empty<byte>();
            }

            public static Key I64(long value) => new(0x01, unchecked((ulong)value), null);
            public static Key U64(ulong value) => new(0x02, value, null);
            public static Key String(string value) => new(0x03, 0, Encoding.UTF8.GetBytes(value));
            public static Key Bytes(byte[] value) => new(0x04, 0, (byte[])value.Clone());
        }

        private ulong seed = (ulong)DateTime.Now.Ticks;
        private ulong index;
        private ulong key;

        public Random()
        {
            key = seed;
        }

        public Random(ulong seed)
        {
            SetSeed(seed);
        }

        private static ulong Mix64(ulong value)
        {
            unchecked
            {
                value = (value ^ (value >> 30)) * 0xBF58476D1CE4E5B9UL;
                value = (value ^ (value >> 27)) * 0x94D049BB133111EBUL;
                return value ^ (value >> 31);
            }
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
                value = Mix64(unchecked(value + nonce * Gamma));
            }
            return value % maxvalue;
        }

        private static ulong FnvUpdate(ulong hash, byte[] data)
        {
            unchecked
            {
                foreach (byte value in data)
                {
                    hash = (hash ^ value) * FnvPrime;
                }
                return hash;
            }
        }

        private static ulong FnvByte(ulong hash, byte value)
        {
            return unchecked((hash ^ value) * FnvPrime);
        }

        private static ulong FnvUInt64(ulong hash, ulong value)
        {
            for (int shift = 0; shift < 64; shift += 8)
            {
                hash = FnvByte(hash, (byte)(value >> shift));
            }
            return hash;
        }

        private static ulong HashKey(ulong hash, Key component)
        {
            hash = FnvByte(hash, component.Tag);
            if (component.Tag == 0x01 || component.Tag == 0x02)
            {
                return FnvUInt64(hash, component.Integer);
            }
            hash = FnvUInt64(hash, (ulong)component.Data.LongLength);
            return FnvUpdate(hash, component.Data);
        }

        private ulong KeyedRaw(string? domain, params Key[] components)
        {
            ulong hash = FnvUpdate(FnvOffsetBasis, V1Prefix);
            hash = FnvUInt64(hash, seed);
            if (domain != null)
            {
                byte[] data = Encoding.ASCII.GetBytes(domain);
                hash = FnvByte(hash, 0xF0);
                hash = FnvUInt64(hash, (ulong)data.LongLength);
                hash = FnvUpdate(hash, data);
            }
            foreach (Key component in components)
            {
                hash = HashKey(hash, component);
            }
            return Mix64(hash);
        }

        public ulong Raw(params Key[] components) => KeyedRaw(null, components);

        public ulong Int(ulong maxvalue, params Key[] components)
        {
            if (maxvalue == 0)
            {
                throw new ArgumentOutOfRangeException(nameof(maxvalue));
            }
            return Bounded(Raw(components), maxvalue);
        }

        public long Range(long minvalue, long maxvalue, params Key[] components)
        {
            if (maxvalue <= minvalue)
            {
                throw new ArgumentOutOfRangeException(nameof(maxvalue));
            }
            ulong width = unchecked((ulong)maxvalue - (ulong)minvalue);
            return unchecked((long)((ulong)minvalue + Bounded(Raw(components), width)));
        }

        public double Float01(params Key[] components)
        {
            return (Raw(components) >> 11) / (double)(1UL << 53);
        }

        public ulong At2D(long x, long y, string? namespaceValue = null)
        {
            return namespaceValue == null
                ? KeyedRaw("at2d", Key.I64(x), Key.I64(y))
                : KeyedRaw("at2d", Key.I64(x), Key.I64(y), Key.String(namespaceValue));
        }

        public ulong At3D(long x, long y, long z, string? namespaceValue = null)
        {
            return namespaceValue == null
                ? KeyedRaw("at3d", Key.I64(x), Key.I64(y), Key.I64(z))
                : KeyedRaw(
                    "at3d",
                    Key.I64(x),
                    Key.I64(y),
                    Key.I64(z),
                    Key.String(namespaceValue));
        }

        public bool ChanceRatio(long numerator, long denominator, params Key[] components)
        {
            if (denominator <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(denominator));
            }
            if (numerator <= 0)
            {
                return false;
            }
            if (numerator >= denominator)
            {
                return true;
            }
            return Int((ulong)denominator, components) < (ulong)numerator;
        }

        public T Choose<T>(IReadOnlyList<T> items, params Key[] components)
        {
            if (items.Count == 0)
            {
                throw new ArgumentException("items must not be empty", nameof(items));
            }
            return items[(int)Int((ulong)items.Count, components)];
        }

        public List<T> Shuffle<T>(IReadOnlyList<T> items, params Key[] components)
        {
            List<T> values = new(items);
            for (int position = values.Count - 1; position > 0; position--)
            {
                Key[] iterationKeys = new Key[components.Length + 1];
                Array.Copy(components, iterationKeys, components.Length);
                iterationKeys[^1] = Key.U64((ulong)position);
                int picked = (int)Bounded(
                    KeyedRaw("shuffle", iterationKeys),
                    (ulong)position + 1);
                (values[position], values[picked]) = (values[picked], values[position]);
            }
            return values;
        }

        public T WeightedChoice<T>(
            IReadOnlyList<T> items,
            IReadOnlyList<ulong> integerWeights,
            params Key[] components)
        {
            if (items.Count == 0 || items.Count != integerWeights.Count)
            {
                throw new ArgumentException("items and weights must have the same non-zero length");
            }
            ulong total = 0;
            foreach (ulong weight in integerWeights)
            {
                ulong next = unchecked(total + weight);
                if (next < total)
                {
                    throw new OverflowException("total weight exceeds uint64");
                }
                total = next;
            }
            if (total == 0)
            {
                throw new ArgumentException("total weight must be positive");
            }
            ulong target = Int(total, components);
            ulong running = 0;
            for (int position = 0; position < items.Count; position++)
            {
                running += integerWeights[position];
                if (target < running)
                {
                    return items[position];
                }
            }
            throw new InvalidOperationException("unreachable weighted choice");
        }

        private ulong RawAt(ulong offset)
        {
            return Mix64(unchecked(seed + offset * Gamma));
        }

        public void SetSeed(ulong localSeed)
        {
            seed = localSeed;
            index = 0;
            key = seed;
        }

        public ulong NextAt(ulong offset) => Bounded(RawAt(offset), MaxIntValue);

        public ulong Next()
        {
            ulong value = Bounded(Mix64(key), MaxIntValue);
            key = unchecked(key + Gamma);
            index++;
            return value;
        }

        public ulong NextRawAt(ulong offset) => RawAt(offset);

        public ulong NextRaw()
        {
            ulong value = Mix64(key);
            key = unchecked(key + Gamma);
            index++;
            return value;
        }

        public ulong NextMaxAt(ulong offset, ulong maxvalue) => Bounded(RawAt(offset), maxvalue);

        public ulong NextMax(ulong maxvalue)
        {
            ulong value = Bounded(Mix64(key), maxvalue);
            key = unchecked(key + Gamma);
            index++;
            return value;
        }

        public ulong NextMinMaxAt(ulong offset, ulong minvalue, ulong maxvalue)
        {
            return maxvalue <= minvalue
                ? minvalue
                : minvalue + NextMaxAt(offset, maxvalue - minvalue);
        }

        public ulong NextMinMax(ulong minvalue, ulong maxvalue)
        {
            ulong value = minvalue;
            if (maxvalue > minvalue)
            {
                value = minvalue + Bounded(Mix64(key), maxvalue - minvalue);
            }
            key = unchecked(key + Gamma);
            index++;
            return value;
        }

        public List<ulong> NextList(ulong length)
        {
            List<ulong> values = new();
            for (ulong i = 0; i < length; i++)
            {
                values.Add(Bounded(Mix64(key), MaxIntValue));
                key = unchecked(key + Gamma);
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
                key = unchecked(key + Gamma);
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
                key = unchecked(key + Gamma);
            }
            index += length;
            return values;
        }
    }
}
