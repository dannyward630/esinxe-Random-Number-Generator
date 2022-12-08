#ifndef ESINXECPP_H_INCLUDED
#define ESINXECPP_H_INCLUDED

#include <time.h>
#include <cmath>
#include <iostream>
#include <list>
using namespace std;

namespace Esinxecpp
{

    class Random
    {
        private: long double e = 2.718281828459045235;
        private: unsigned long long int maxintvalue = 1000000000000000000; // 10^18
        public: unsigned long long int globalseed = time(0);

        public: void SetSeed(unsigned long long int seed)
        {
            globalseed = seed;
        }

        private: long double Esinxe()
        {
            long double equation = (pow(e, sin(pow(globalseed, e)) - 1 / e) / 2.3504);

            if (equation > 1)
            {
                equation = 1;
            }
            if (equation < 0)
            {
                equation = 0;
            }

            return equation;
        }

        private: long double Esinxe(unsigned long long int offset)
        {
            long double equation = (pow(e, sin(pow(globalseed + offset, e)) - 1 / e) / 2.3504);

            if (equation > 1)
            {
                equation = 1;
            }
            if (equation < 0)
            {
                equation = 0;
            }

            return equation;
        }

        public: unsigned long long int Next()
        {
            long double value = Esinxe();
            value *= maxintvalue;
            return (unsigned long long int)value;
        }

        public: unsigned long long int NextMax(unsigned long long int maxvalue)
        {
            if (maxvalue <= 0)
            {
                maxvalue = 1;
            }

            long double value = Esinxe();
            value *= maxvalue;
            return (unsigned long long int)value;
        }

        public: unsigned long long int NextMinMax(unsigned long long int minvalue, unsigned long long int maxvalue)
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

            long double value = Esinxe();
            value *= maxvalue - minvalue;
            value += minvalue;
            return (unsigned long long int)value;
        }

        public: list<unsigned long long int> NextList(unsigned long long int length)
        {
            list<unsigned long long int> values;

            for (unsigned long long int i = 0; i < length; i++)
            {
                long double value = Esinxe(i);
                value *= maxintvalue;
                values.push_back((unsigned long long int)value);
            }
            return values;
        }

        public: list<unsigned long long int> NextListMax(unsigned long long int length, unsigned long long int maxvalue)
        {
            list<unsigned long long int> values;

            if (maxvalue <= 0)
            {
                maxvalue = 1;
            }

            for (unsigned long long int i = 0; i < length; i++)
            {
                long double value = Esinxe(i);
                value *= maxvalue;
                values.push_back((unsigned long long int)value);
            }
            return values;
        }

        public: list<unsigned long long int> NextListMinMax(unsigned long long int length, unsigned long long int minvalue, unsigned long long int maxvalue)
        {
            list<unsigned long long int> values;

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
                return values;
            }

            for (unsigned long long int i = 0; i < length; i++)
            {
                long double value = Esinxe(i);
                value *= maxvalue - minvalue;
                value += minvalue;
                values.push_back((unsigned long long int)value);
            }
            return values;
        }
    };
}

#endif // ESINXECPP_H_INCLUDED
