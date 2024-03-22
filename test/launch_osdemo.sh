#!/bin/bash

cd build/firmware

if [ $1 == "start" ]; then
	if [ ! -d "unified" ]; then
		git clone https://github.com/opensprinkler/opensprinklergen2 unified
	fi
	cd unified
	g++ -o OpenSprinkler -m32 main.cpp OpenSprinkler.cpp program.cpp server.cpp utils.cpp weather.cpp gpio.cpp etherport.cpp
	./OpenSprinkler >/dev/null 2>&1 &
	echo $! > pid
	sleep 5
else
	kill -9 `cat unified/pid`
	rm unified/pid
	sleep 5
fi
