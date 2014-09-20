#!/bin/bash

cd build/firmware
unzip UI.zip
rsync -azp * $1
