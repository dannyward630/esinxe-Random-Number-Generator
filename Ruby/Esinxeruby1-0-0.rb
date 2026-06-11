module Esinxe
    Mask64 = (1 << 64) - 1
    FnvOffsetBasis = 0xCBF29CE484222325
    FnvPrime = 0x100000001B3
    V1Prefix = "esinxe-v1\0".b.freeze

    def self.i64(value)
        value = value.to_i
        raise RangeError, "signed key components must fit in int64" unless value.between?(-(1 << 63), (1 << 63) - 1)

        [:i64, value].freeze
    end

    def self.u64(value)
        value = value.to_i
        raise RangeError, "unsigned key components must fit in uint64" unless value.between?(0, Mask64)

        [:u64, value].freeze
    end

    def self.bytes(value)
        [:bytes, value.to_s.b].freeze
    end

    class Generator
        Mask64 = Esinxe::Mask64
        Gamma = 0x9E3779B97F4A7C15
        Maxintvalue = 1_000_000_000_000_000_000

        def initialize(seed = nil)
            @seed = (seed || Time.now.to_i) & Mask64
            @index = 0
            @key = @seed
        end

        def SetSeed(seed = Time.now.to_i)
            @seed = seed.to_i & Mask64
            @index = 0
            @key = @seed
        end

        def Mix64(value)
            value &= Mask64
            value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & Mask64
            value = ((value ^ (value >> 27)) * 0x94D049BB133111EB) & Mask64
            (value ^ (value >> 31)) & Mask64
        end

        def RawAt(offset)
            Mix64(@seed + offset.to_i * Gamma)
        end

        def Bounded(value, maxvalue)
            maxvalue = maxvalue.to_i
            return 0 if maxvalue <= 0

            threshold = ((1 << 64) - maxvalue) % maxvalue
            nonce = 0
            while value < threshold
                nonce += 1
                value = Mix64(value + nonce * Gamma)
            end
            value % maxvalue
        end

        def FnvUpdate(hash, bytes)
            bytes.each_byte do |byte|
                hash = ((hash ^ byte) * FnvPrime) & Mask64
            end
            hash
        end

        def LittleEndian64(value)
            [value.to_i & Mask64].pack("Q<")
        end

        def EncodeKey(component)
            if component.is_a?(Array) && component.length == 2
                type, value = component
                return "\x01".b + LittleEndian64(value) if type == :i64
                return "\x02".b + LittleEndian64(value) if type == :u64
                if type == :bytes
                    data = value.to_s.b
                    return "\x04".b + LittleEndian64(data.bytesize) + data
                end
            end
            if component.is_a?(Integer)
                return EncodeKey(component.negative? ? Esinxe.i64(component) : Esinxe.u64(component))
            end
            if component.is_a?(String)
                data = component.encode(Encoding::UTF_8).b
                return "\x03".b + LittleEndian64(data.bytesize) + data
            end
            raise TypeError, "v1 keys must be signed/unsigned integers, UTF-8 strings, or bytes"
        end

        def KeyedRaw(keys, domain = nil)
            hash = FnvUpdate(FnvOffsetBasis, V1Prefix)
            hash = FnvUpdate(hash, LittleEndian64(@seed))
            unless domain.nil?
                data = domain.encode(Encoding::US_ASCII).b
                hash = FnvUpdate(hash, "\xF0".b + LittleEndian64(data.bytesize) + data)
            end
            keys.each { |component| hash = FnvUpdate(hash, EncodeKey(component)) }
            Mix64(hash)
        end

        def raw(*keys)
            KeyedRaw(keys)
        end

        def int(maxvalue, *keys)
            maxvalue = maxvalue.to_i
            raise RangeError, "maxvalue must be in [1, 2^64]" unless maxvalue.between?(1, 1 << 64)

            return raw(*keys) if maxvalue == 1 << 64

            Bounded(raw(*keys), maxvalue)
        end

        def range(minvalue, maxvalue, *keys)
            minvalue = minvalue.to_i
            maxvalue = maxvalue.to_i
            width = maxvalue - minvalue
            raise RangeError, "range width must be in [1, 2^64]" unless width.between?(1, 1 << 64)

            minvalue + int(width, *keys)
        end

        def float01(*keys)
            (raw(*keys) >> 11).fdiv(1 << 53)
        end

        def at2D(x, y, namespace = nil)
            keys = [Esinxe.i64(x), Esinxe.i64(y)]
            keys << namespace.to_s unless namespace.nil?
            KeyedRaw(keys, "at2d")
        end

        def at3D(x, y, z, namespace = nil)
            keys = [Esinxe.i64(x), Esinxe.i64(y), Esinxe.i64(z)]
            keys << namespace.to_s unless namespace.nil?
            KeyedRaw(keys, "at3d")
        end

        def chanceRatio(numerator, denominator, *keys)
            numerator = numerator.to_i
            denominator = denominator.to_i
            raise RangeError, "denominator must be positive" unless denominator.positive?

            return false unless numerator.positive?
            return true if numerator >= denominator

            int(denominator, *keys) < numerator
        end

        def choose(items, *keys)
            raise ArgumentError, "items must not be empty" if items.empty?

            items[int(items.length, *keys)]
        end

        def shuffle(items, *keys)
            values = items.dup
            (values.length - 1).downto(1) do |index|
                picked = Bounded(KeyedRaw(keys + [Esinxe.u64(index)], "shuffle"), index + 1)
                values[index], values[picked] = values[picked], values[index]
            end
            values
        end

        def weightedChoice(items, integer_weights, *keys)
            if items.empty? || items.length != integer_weights.length
                raise ArgumentError, "items and weights must have the same non-zero length"
            end
            weights = integer_weights.map(&:to_i)
            raise RangeError, "weights must be non-negative" if weights.any?(&:negative?)

            total = weights.sum
            raise RangeError, "total weight must be in [1, 2^64 - 1]" unless total.between?(1, Mask64)

            target = int(total, *keys)
            running = 0
            items.zip(weights).each do |item, weight|
                running += weight
                return item if target < running
            end
            raise "unreachable weighted choice"
        end

        def NextAt(offset)
            Bounded(RawAt(offset), Maxintvalue)
        end

        def NextRawAt(offset)
            RawAt(offset)
        end

        def NextRaw
            value = Mix64(@key)
            @key = (@key + Gamma) & Mask64
            @index += 1
            value
        end

        def NextMaxAt(offset, maxvalue)
            Bounded(RawAt(offset), maxvalue)
        end

        def NextMinMaxAt(offset, minvalue, maxvalue)
            minvalue = minvalue.to_i
            maxvalue = maxvalue.to_i
            return nil if maxvalue <= minvalue

            minvalue + NextMaxAt(offset, maxvalue - minvalue)
        end

        def Next(*args)
            case args.size
            when 0
                value = Bounded(Mix64(@key), Maxintvalue)
                @key = (@key + Gamma) & Mask64
                @index += 1
                value
            when 1
                NextAt(args[0])
            when 2
                NextMaxAt(args[0], args[1])
            when 3
                NextMinMaxAt(args[0], args[1], args[2])
            else
                raise ArgumentError, "expected 0 to 3 arguments"
            end
        end

        def NextArray(*args)
            case args.size
            when 1
                length = args[0].to_i
                values = []
                length.times do
                    values << Bounded(Mix64(@key), Maxintvalue)
                    @key = (@key + Gamma) & Mask64
                end
                @index += length
                values
            when 2
                length = args[0].to_i
                offset = args[1].to_i
                (0...length).map { |i| NextAt(offset + i) }
            when 3
                length = args[0].to_i
                offset = args[1].to_i
                maxvalue = args[2].to_i
                (0...length).map { |i| NextMaxAt(offset + i, maxvalue) }
            when 4
                length = args[0].to_i
                offset = args[1].to_i
                minvalue = args[2].to_i
                maxvalue = args[3].to_i
                (0...length).map { |i| NextMinMaxAt(offset + i, minvalue, maxvalue) }
            else
                raise ArgumentError, "expected 1 to 4 arguments"
            end
        end
    end
end
