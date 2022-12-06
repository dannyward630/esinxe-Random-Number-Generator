This is a Random Number Generator for Python, C# and C++ (Other languages coming soon)

Version 1.0.0 @ 12/5/2022

Author: Danny Ward

This is a unique generator in that it chooses value y from key x using the function e^sin(x^e), instead of running values through an algorithm. The seed can be specified or not, depending on your preference.

One primary advantage this generator gives over other generators is this: If you want to generate the xth random value in a series beginning at the seed value, a standard generator would calculate every value from the seed until x. By using a function instead of an algorithm, this generator can calculate the xth value instantly, without having to cycle through every previous one. In certain applications, especially in the gaming industry, this can become a bottleneck when procedurally generating terrain far from the starting (seed) value. I discovered the issue earlier in 2022 when creating a Minecraft clone.

I can't find any repetitions in the first 100 billion digits, but if you can find any please bring it to my notice. I am not experienced in detecting patterns in data sets, so any feedback would be appreciated.

As you can probably see, this is in it's infancy. Any comments, tips or suggestions would be greatly appreciated.

$$___$$_ __$$$___ $$___$$_ $$___$$_ __$$$___ $$______
$$$_$$$_ _$$_$$__ $$$__$$_ $$___$$_ _$$_$$__ $$______
$$$$$$$_ $$___$$_ $$$$_$$_ $$___$$_ $$___$$_ $$______
$$_$_$$_ $$$$$$$_ $$_$$$$_ $$___$$_ $$$$$$$_ $$______
$$___$$_ $$___$$_ $$__$$$_ $$___$$_ $$___$$_ $$____$_
$$___$$_ $$___$$_ $$___$$_ _$$$$$__ $$___$$_ $$$$$$$_

DEPENDENCIES:
  math
  time
  
NOTES:
  1. The maximum value is capped at 10^18 for now; May change in future versions, or upon request.

Class Random() is the primary class

    SetSeed() sets the seed, currently it takes any number between 0 and 10^18.
    Next() returns a random integer
    NextMax(maxvalue) Returns a random integer between 0 and maxvalue
    NextMinMax(minvalue, maxvalue) Returns a random integer within a specified range
    NextList(length) Returns a list of random integers
    NextListMax(length, maxvalue) Returns a list of random integers between 0 and maxvalue
    NextListMinMax(length, minvalue, maxvalue) Returns a list of random integers between minvalue and maxvalue
