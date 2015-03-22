#!/bin/bash

cd build/firmware

if [ $1 == "start" ]; then
	if [ ! -d "ospi" ]; then
		git clone https://github.com/dan-in-ca/ospi
	fi
	cd ospi
	nohup python ospi.py &
	echo $! > pid
else
	kill -9 `cat ospi/pid`
	rm ospi/pid
fi
