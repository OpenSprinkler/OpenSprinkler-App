#!/bin/bash

mkdir -p build/firmware
cd build/firmware

if [ $1 == "start" ]; then
	if [ ! -d "unified" ]; then
		git clone https://github.com/OpenSprinkler/OpenSprinkler-Firmware unified
	fi
	cd unified
	sudo ./build.sh demo
	./OpenSprinkler >/dev/null 2>&1 &
	echo $! > pid
	sleep 5
else
	kill -9 `cat unified/pid`
	rm unified/pid
	sleep 5
fi
