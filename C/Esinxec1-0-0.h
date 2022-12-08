#ifndef ESINXEC_H_INCLUDED
#define ESINXEC_H_INCLUDED

#include <time.h>
#include <math.h>
#include <stdio.h>

static const long double e = 2.718281828459045235;
static const unsigned long long int maxintvalue = 1000000000000000000; // 10^18
static unsigned long long int globalseed = 0;

void SetSeed(unsigned long long int seed)
{
    globalseed = seed;
}

void SetTimeSeed()
{
    globalseed = time(0);
}

long double Esinxe()
{
    if (globalseed == 0)
    {
        globalseed = time(0);
    }
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

long double EsinxeOffset(unsigned long long int offset)
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

unsigned long long int Next()
{
    long double value = Esinxe();
    value *= maxintvalue;
    return abs((unsigned long long int)value);
}

unsigned long long int NextMax(unsigned long long int maxvalue)
{
    if (maxvalue <= 0)
    {
        maxvalue = 1;
    }

    long double value = Esinxe();
    value *= maxvalue;
    return abs((unsigned long long int)value);
}

unsigned long long int NextMinMax(unsigned long long int minvalue, unsigned long long int maxvalue)
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
    return abs((unsigned long long int)value);
}

#endif // ESINXEC_H_INCLUDED
