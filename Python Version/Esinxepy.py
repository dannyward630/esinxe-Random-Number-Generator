import math
import time

#e = 2.718281828459045235
#maxintvalue = 1000000000000000000

# Returns a random integer between 0 and 10^18

class Random:    
    
    __e = 2.718281828459045235
    __maxintvalue = 1000000000000000000
    seed = time.time()
    
    def SetSeed(self, localseed):
        Random.seed = localseed

    def Next(self):
        x = Random.seed
        e = Random.__e
        maxintvalue = Random.__maxintvalue
        equation = (math.pow(e, math.sin(math.pow(x, e))) - 1 / e) / 2.3504
        
        if equation > 1:
            equation == 1
        if equation < 0:
            equation == 0
            
        equation *= maxintvalue
        
        return int(equation)

    # Returns a random integer between 0 and maxvalue

    def NextMax(self, maxvalue):
        x = Random.seed
        e = Random.__e
        maxintvalue = Random.__maxintvalue
        max = int(maxvalue)
        if max > maxintvalue:
            max = maxintvalue
        if max <= 0:
            max = 1
            
        equation = (math.pow(e, math.sin(math.pow(x, e))) - 1 / e) / 2.3504
        
        if equation > 1:
            equation == 1
        if equation < 0:
            equation == 0
            
        equation *= max
        
        return int(equation)

    # Returns a random integer within a specified range

    def NextMinMax(self, minvalue, maxvalue):
        x = Random.seed
        e = Random.__e
        maxintvalue = Random.__maxintvalue
        min = int(minvalue)
        max = int(maxvalue)
        
        if min > maxintvalue:
            min = maxintvalue - 2
        if min < 0:
            min = 0
        if max > maxintvalue:
            max = maxintvalue
        if max < 0:
            max = 2
            
        if max <= min:
            return None
        
        equation = (math.pow(e, math.sin(math.pow(x, e))) - 1 / e) / 2.3504
        
        if equation > 1:
            equation == 1
        if equation < 0:
            equation == 0
            
        equation *= max - min
        equation += min
        
        return int(equation)
    
    # Returns a list of random integers
    
    def NextList(self, length):
        x = Random.seed
        e = Random.__e
        maxintvalue = Random.__maxintvalue
        randlist = list()    
        
        listlength = int(length)
        
        for i in range(listlength):
            
            equation = (math.pow(e, math.sin(math.pow(x + i, e))) - 1 / e) / 2.3504
            
            if equation > 1:
                equation == 1
            if equation < 0:
                equation == 0
                
            equation *= maxintvalue
            
            randlist.append(int(equation))
        
        return randlist
    
    # Returns a list of random integers between 0 and maxvalue
    
    def NextListMax(self, length, maxvalue):
        max = int(maxvalue)
        x = Random.seed
        e = Random.__e
        maxintvalue = Random.__maxintvalue
        if max > maxintvalue:
            max = maxintvalue
        if max <= 0:
            max = 1
        randlist = list()
        listlength = int(length)
        
        for i in range(listlength):
            
            equation = (math.pow(e, math.sin(math.pow(x + i, e))) - 1 / e) / 2.3504
            
            if equation > 1:
                equation == 1
            if equation < 0:
                equation == 0
                
            equation *= max
            
            randlist.append(int(equation))
        
        return randlist
    
    # Returns a list of random integers between minvalue and maxvalue
    
    def NextListMinMax(self, length, minvalue, maxvalue):
        x = Random.seed
        e = Random.__e
        maxintvalue = Random.__maxintvalue
        min = int(minvalue)
        max = int(maxvalue)
        
        if min > maxintvalue:
            min = maxintvalue - 2
        if min < 0:
            min = 0
        if max > maxintvalue:
            max = maxintvalue
        if max < 0:
            max = 2
            
        if max <= min:
            return None
        randlist = list()
        listlength = int(length)
        
        for i in range(listlength):
                        
            equation = (math.pow(e, math.sin(math.pow(x + i, e))) - 1 / e) / 2.3504
            
            if equation > 1:
                equation == 1
            if equation < 0:
                equation == 0
                
            equation *= max - min
            equation += min
            
            randlist.append(int(equation))
        
        return randlist