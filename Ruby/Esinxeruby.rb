class Random 

    include Math
    E = 2.718281828459045
    Maxintvalue = 100000000000000000
    $globalseed = Time.now.to_i
    
    def SetSeed(*args)
        case args.size
            when 0
                $globalseed = Time.now.to_i
            when 1
                $globalseed = args[0]
        end
    end

    def Esinxe(*args)    # 0 = globalseed, 1 = globalseed and offset
        equation = 0
        case args.size
            when 0
                equation = (E ** Math.sin($globalseed.to_f ** E) - 1 / E) / 2.3504
            when 1
                equation = (E ** Math.sin(($globalseed + args[0]) ** E) - 1 / E) / 2.3504
        end
        
        if equation < 0
            equation = 0
        end
        if equation > 1
            equation = 1
        end

        return equation
    end

    def Next(*args)     # 1 = NextOffset(), 2 = NextOffsetMax(), 3 = NextOffsetMinMax() :: args[0] = offset, args[1] = min, args[2] = max
        case args.size
            when 0
                return 0
            when 1
                return (Maxintvalue * Random.new.Esinxe(args[0])).to_i
            when 2
                return (args[1] * Random.new.Esinxe(args[0])).to_i
            when 3
                return ((args[2] - args[1]) * Random.new.Esinxe(args[0]) + args[1]).to_i
        end
    end

    def NextArray(*args)     # 2 = NextLengthOffset(), 3 = NextLengthOffsetMax(), 4 = NextLengthOffsetMinMax() :: args[0] = length, args[1] = offset, args[2] = min, args[3] = max
        case args.size
            when 0
                return 0
            when 1
                return 0
            when 2
                values = Array.new(args[0])
                for i in 0..args[0] do
                    values[i] = (Maxintvalue * Random.new.Esinxe(args[1] + i)).to_i
                end

                return values
            when 3
                values = Array.new(args[0])
                for i in 0..args[0] do
                    values[i] = (args[2] * Random.new.Esinxe(args[1] + i)).to_i
                end

                return values
            when 4
                values = Array.new(args[0])
                for i in 0..args[0] do
                    values[i] = ((args[3] - args[2]) * Random.new.Esinxe(args[1] + i) + args[2]).to_i
                end

                return values
        end
    end
end