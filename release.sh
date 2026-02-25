#!/bin/bash
set -e
export NODE_ENV=production

# Run tests
echo "Running Python unit tests..."
cd packages/python && poetry run pytest tests/ -v
cd ../..

echo "Running JS unit tests..."
pnpm test

# Build and package
echo "Building..."
NAME=${PWD##*/}
mkdir -p releases
NR=$(find ./releases -type f | wc -l | xargs)
NR=$(($NR + 1))
TIMESTAMP=$(date '+%Y-%m-%d')
pnpm run build
cd packages/data-collector/dist
zip -r ../../../releases/${NAME}_${TIMESTAMP}_${NR}.zip .