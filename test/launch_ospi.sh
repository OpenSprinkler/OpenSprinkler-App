#!/bin/bash

cd build/firmware

if [ $1 == "start" ]; then
	if [ ! -d "sip" ]; then
		git clone https://github.com/dan-in-ca/sip
	fi
	cd sip
	#Change port to 8080
	sed -ibak "s/\"htp\": 80,/\"htp\": 8080,/" gv.py
	nohup python sip.py >/dev/null 2>&1 &
	echo $! > pid
	sleep 5
else
	kill -9 `cat sip/pid`
	rm sip/pid
	sleep 5
fi
