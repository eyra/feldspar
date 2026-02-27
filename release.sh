#!/bin/bash
set -e
export NODE_ENV=production

# Build and package
echo "Building..."
pnpm run build

NAME=${PWD##*/}
BRANCH=${1:-$(git branch --show-current)}
BRANCH=${BRANCH//\//-}
TIMESTAMP=$(date '+%Y-%m-%d')
BUILD_NR=${2:-local}

mkdir -p releases
RELEASE_NAME="${NAME}_${BRANCH}_${TIMESTAMP}_${BUILD_NR}.zip"

cd packages/data-collector/dist
zip -r ../../../releases/${RELEASE_NAME} .

echo "Created: releases/${RELEASE_NAME}"