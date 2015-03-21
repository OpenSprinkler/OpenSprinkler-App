#!/bin/bash

cd build/firmware
git clone https://github.com/dan-in-ca/ospi
cd ospi
python ospi.py &
