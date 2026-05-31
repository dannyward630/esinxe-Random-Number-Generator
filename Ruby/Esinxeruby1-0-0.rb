class Random
    Mask64 = (1 << 64) - 1
    Gamma = 0x9E3779B97F4A7C15
    Maxintvalue = 1_000_000_000_000_000_000

    def initialize(seed = nil)
        @seed = (seed || Time.now.to_i) & Mask64
        @index = 0
    end

    def SetSeed(seed = Time.now.to_i)
        @seed = seed.to_i & Mask64
        @index = 0
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

    def NextAt(offset)
        Bounded(RawAt(offset), Maxintvalue)
    end

    def NextRawAt(offset)
        RawAt(offset)
    end

    def NextRaw
        value = NextRawAt(@index)
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

    # Backwards-compatible overloads:
    # Next() advances, Next(offset), Next(offset, max), Next(offset, min, max).
    def Next(*args)
        case args.size
        when 0
            value = NextAt(@index)
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
            values = (0...length).map { |i| NextAt(@index + i) }
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
