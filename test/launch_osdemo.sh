#!/bin/bash

cd build/firmware
git clone -b fix-nonblock https://github.com/opensprinkler/opensprinklergen2 unified
cd unified
./build_demo.sh
./OpenSprinkler &
