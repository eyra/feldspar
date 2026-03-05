#!/bin/bash
set -e

# Usage: ./check-deps.sh [release]
# Without arguments: checks deps needed for development (npm start)
# With "release": also checks deps needed for release.sh

missing=()
command -v node >/dev/null 2>&1 || missing+=("node (https://nodejs.org/)")
command -v pnpm >/dev/null 2>&1 || missing+=("pnpm (https://pnpm.io/installation)")
command -v python3 >/dev/null 2>&1 || missing+=("python3 (https://www.python.org/)")
command -v poetry >/dev/null 2>&1 || missing+=("poetry (https://python-poetry.org/)")

if [ "$1" = "release" ]; then
  command -v zip >/dev/null 2>&1 || missing+=("zip")
  command -v git >/dev/null 2>&1 || missing+=("git")
fi

if [ ${#missing[@]} -ne 0 ]; then
  echo "Error: the following required tools are not installed:"
  for tool in "${missing[@]}"; do
    echo "  - $tool"
  done
  exit 1
fi
