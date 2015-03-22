#!/bin/bash

cd build/firmware

if [ $1 == "start" ]; then
	if [ ! -d "ospi" ]; then
		git clone https://github.com/dan-in-ca/ospi
	fi
	cd ospi
	nohup python ospi.py >/dev/null 2>&1 &
	echo $! > pid
	sleep 5
else
	kill -9 `cat ospi/pid`
	rm ospi/pid
	sleep 5
fi
