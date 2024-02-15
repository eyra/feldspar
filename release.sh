#!/bin/bash 
NAME=$1
mkdir -p releases
NR=$(find ./releases -type f | wc -l | xargs)
NR=$(($NR + 1))
TIMESTAMP=$(date '+%Y-%m-%d')
cd build
zip -r ../releases/${NAME}_${TIMESTAMP}_${NR}.zip .