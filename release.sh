#!/bin/bash 
export NODE_ENV=production

NAME=${PWD##*/}
mkdir -p releases
NR=$(find ./releases -type f | wc -l | xargs)
NR=$(($NR + 1))
TIMESTAMP=$(date '+%Y-%m-%d')
npm run build
cd packages/data-collector/build
zip -r ../../../releases/${NAME}_${TIMESTAMP}_${NR}.zip .