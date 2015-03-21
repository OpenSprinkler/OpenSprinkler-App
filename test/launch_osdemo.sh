#!/bin/bash

cd build
git clone https://github.com/opensprinkler/opensprinklergen2
cd opensprinklergen2
./build_demo.sh
./OpenSprinkler &
