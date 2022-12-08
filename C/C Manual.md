DEPENDENCIES: time.h, cmath, iostream, list, std

NOTES: 

The maximum value is capped at 10^18 for now; May change in future versions, or upon request.


Class Random() is the primary class

SetSeed() sets the seed, currently it takes any number between 0 and 10^18. 
Next() returns a random integer 
NextMax(maxvalue) Returns a random integer between 0 and maxvalue 
NextMinMax(minvalue, maxvalue) Returns a random integer within a specified range 
NextList(length) Returns a list of random integers 
NextListMax(length, maxvalue) Returns a list of random integers between 0 and maxvalue 
NextListMinMax(length, minvalue, maxvalue) Returns a list of random integers between minvalue and maxvalue
