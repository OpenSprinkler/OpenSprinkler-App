#!/bin/bash

cd build/firmware

if [ $1 == "start" ]; then
	if [ ! -d "sip" ]; then
		git clone https://github.com/dan-in-ca/sip
	fi
	cd sip
	nohup python sip.py >/dev/null 2>&1 &
	echo $! > pid
	sleep 5
else
	kill -9 `cat sip/pid`
	rm sip/pid
	sleep 5
fi
