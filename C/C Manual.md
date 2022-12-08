$$___$$_ __$$$___ $$___$$_ $$___$$_ __$$$___ $$______
$$$_$$$_ _$$_$$__ $$$__$$_ $$___$$_ _$$_$$__ $$______
$$$$$$$_ $$___$$_ $$$$_$$_ $$___$$_ $$___$$_ $$______
$$_$_$$_ $$$$$$$_ $$_$$$$_ $$___$$_ $$$$$$$_ $$______
$$___$$_ $$___$$_ $$__$$$_ $$___$$_ $$___$$_ $$____$_
$$___$$_ $$___$$_ $$___$$_ _$$$$$__ $$___$$_ $$$$$$$_

DEPENDENCIES: time.h, math.h, stdio.h

NOTES: 
  1. The maximum value is capped at 10^9 for now; May change in future versions, or upon request.

SetSeed() sets the seed, currently it takes any number between 0 and 10^9. 

SetTimeSeed() sets the seed to the current time.

Next() returns a random integer.

NextMax(maxvalue) Returns a random integer between 0 and maxvalue.

NextMinMax(minvalue, maxvalue) Returns a random integer within a specified range.
