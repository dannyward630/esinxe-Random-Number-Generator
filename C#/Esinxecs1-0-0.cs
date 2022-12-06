namespace Esinxecs
{
    public class Random
    {
        readonly decimal e = 2.718281828459045235M;
        readonly ulong maxintvalue = 10000000000000000000;
        ulong globalseed = (ulong)DateTime.Now.Ticks;

        static void Main()
        {
            /*
            Console.WriteLine("Hello RNGs!");
            var random = new Random();

            Console.WriteLine(random.Next());
            Console.WriteLine(random.NextMax(100));
            Console.WriteLine(random.NextMinMax(50, 100));
            Console.WriteLine(random.NextList(5));
            Console.WriteLine(random.NextListMax(5, 100));
            Console.WriteLine(random.NextListMinMax(5, 50, 100));

            random.SetSeed(10101);

            Console.WriteLine(random.Next());
            Console.WriteLine(random.NextMax(100));
            Console.WriteLine(random.NextMinMax(50, 100));
            Console.WriteLine(random.NextList(5));
            Console.WriteLine(random.NextListMax(5, 100));
            Console.WriteLine(random.NextListMinMax(5, 50, 100));
            */
        }

        public void SetSeed(ulong seed)
        {
            globalseed = seed;
        }

        public ulong Next()
        {
            decimal equation = (decimal)(Math.Pow((double)e, Math.Sin(Math.Pow(globalseed, (double)e)) - 1 / (double)e) / 2.3504);

            if (equation > 1)
            {
                equation = 1;
            }
            if (equation < 0)
            {
                equation = 0;
            }
            equation *= maxintvalue;
            ulong adjustedvalue = (ulong)equation;
            string adjuster = adjustedvalue.ToString();
            string next = adjuster.Remove(4);
            adjustedvalue += ulong.Parse(next);

            return adjustedvalue;
        }

        public ulong NextMax(ulong maxvalue)
        {
            if (maxvalue <= 0)
            {
                maxvalue = 1;
            }

            decimal equation = (decimal)(Math.Pow((double)e, Math.Sin(Math.Pow(globalseed, (double)e)) - 1 / (double)e) / 2.3504);

            if (equation > 1)
            {
                equation = 1;
            }
            if (equation < 0)
            {
                equation = 0;
            }
            equation *= maxvalue;
            ulong adjustedvalue = (ulong)equation;
            string adjuster = adjustedvalue.ToString();
            string next = adjuster;
            try
            {
                next = adjuster.Remove(4);
            }
            catch(ArgumentOutOfRangeException)
            {
                
            }
            adjustedvalue += ulong.Parse(next);

            return adjustedvalue;
        }

        public ulong NextMinMax(ulong minvalue, ulong maxvalue)
        {
            if (minvalue < 0)
            {
                minvalue = 0;
            }
            if (minvalue > maxintvalue)
            {
                minvalue = maxintvalue - 1;
            }
            if (maxvalue < 0)
            {
                maxvalue = 1;
            }
            if (maxvalue <= minvalue)
            {
                return 0;
            }

            decimal equation = (decimal)(Math.Pow((double)e, Math.Sin(Math.Pow(globalseed, (double)e)) - 1 / (double)e) / 2.3504);

            if (equation > 1)
            {
                equation = 1;
            }
            if (equation < 0)
            {
                equation = 0;
            }
            equation *= maxvalue - minvalue;
            equation += minvalue;
            ulong adjustedvalue = (ulong)equation;
            string adjuster = adjustedvalue.ToString();
            string next = adjuster;
            try
            {
                next = adjuster.Remove(4);
            }
            catch (ArgumentOutOfRangeException)
            {

            }
            adjustedvalue += ulong.Parse(next);

            return adjustedvalue;
        }

        public List<ulong> NextList(ulong length)
        {
            List<ulong> randlist = new();
            for (ulong i = 0; i < length; i++)
            {
                decimal equation = (decimal)(Math.Pow((double)e, Math.Sin(Math.Pow(globalseed, (double)e)) - 1 / (double)e) / 2.3504);

                if (equation > 1)
                {
                    equation = 1;
                }
                if (equation < 0)
                {
                    equation = 0;
                }
                equation *= maxintvalue;
                ulong adjustedvalue = (ulong)equation;
                string adjuster = adjustedvalue.ToString();
                string next = adjuster;
                try
                {
                    next = adjuster.Remove(4);
                }
                catch (ArgumentOutOfRangeException)
                {

                }
                adjustedvalue += ulong.Parse(next);

                randlist.Add(adjustedvalue);
            }
            return randlist;
        }

        public List<ulong> NextListMax(ulong length, ulong maxvalue)
        {
            if (maxvalue <= 0)
            {
                maxvalue = 1;
            }

            List<ulong> randlist = new();
            for (ulong i = 0; i < length; i++)
            {
                decimal equation = (decimal)(Math.Pow((double)e, Math.Sin(Math.Pow(globalseed, (double)e)) - 1 / (double)e) / 2.3504);

                if (equation > 1)
                {
                    equation = 1;
                }
                if (equation < 0)
                {
                    equation = 0;
                }
                equation *= maxvalue;
                ulong adjustedvalue = (ulong)equation;
                string adjuster = adjustedvalue.ToString();
                string next = adjuster;
                try
                {
                    next = adjuster.Remove(4);
                }
                catch (ArgumentOutOfRangeException)
                {

                }
                adjustedvalue += ulong.Parse(next);

                randlist.Add(adjustedvalue);
            }
            return randlist;
        }

        public List<ulong> NextListMinMax(ulong length, ulong minvalue, ulong maxvalue)
        {
            List<ulong> randlist = new();
            if (minvalue < 0)
            {
                minvalue = 0;
            }
            if (minvalue > maxintvalue)
            {
                minvalue = maxintvalue - 1;
            }
            if (maxvalue < 0)
            {
                maxvalue = 1;
            }
            if (maxvalue <= minvalue)
            {
                return randlist;
            }

            for (ulong i = 0; i < length; i++)
            {
                decimal equation = (decimal)(Math.Pow((double)e, Math.Sin(Math.Pow(globalseed, (double)e)) - 1 / (double)e) / 2.3504);

                if (equation > 1)
                {
                    equation = 1;
                }
                if (equation < 0)
                {
                    equation = 0;
                }
                equation *= maxvalue - minvalue;
                equation += minvalue;
                ulong adjustedvalue = (ulong)equation;
                string adjuster = adjustedvalue.ToString();
                string next = adjuster;
                try
                {
                    next = adjuster.Remove(4);
                }
                catch (ArgumentOutOfRangeException)
                {

                }
                adjustedvalue += ulong.Parse(next);

                randlist.Add(adjustedvalue);
            }
            return randlist;
        }
    }
}
