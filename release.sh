#!/bin/bash
set -e

# Check prerequisites
missing=()
command -v node >/dev/null 2>&1 || missing+=("node (https://nodejs.org/)")
command -v pnpm >/dev/null 2>&1 || missing+=("pnpm (https://pnpm.io/installation)")
command -v python3 >/dev/null 2>&1 || missing+=("python3 (https://www.python.org/)")
command -v poetry >/dev/null 2>&1 || missing+=("poetry (https://python-poetry.org/)")
command -v zip >/dev/null 2>&1 || missing+=("zip")
command -v git >/dev/null 2>&1 || missing+=("git")

if [ ${#missing[@]} -ne 0 ]; then
  echo "Error: the following required tools are not installed:"
  for tool in "${missing[@]}"; do
    echo "  - $tool"
  done
  exit 1
fi

export NODE_ENV=production

# Build and package
echo "Building..."
pnpm run build

NAME=${PWD##*/}
BRANCH=${1:-$(git branch --show-current)}
TIMESTAMP=$(date '+%Y-%m-%d')
BUILD_NR=${2:-local}

mkdir -p releases
RELEASE_NAME="${NAME}_${BRANCH}_${TIMESTAMP}_${BUILD_NR}.zip"

cd packages/data-collector/dist
zip -r ../../../releases/${RELEASE_NAME} .

echo "Created: releases/${RELEASE_NAME}"