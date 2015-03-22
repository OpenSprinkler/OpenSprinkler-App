#!/bin/bash

cd build/firmware

if [ $1 == "start" ]; then
	git clone https://github.com/dan-in-ca/ospi
	cd ospi
	python ospi.py &
	echo $! > pid
else
	kill -9 `cat ospi/pid`
	rm ospi/pid
fi
