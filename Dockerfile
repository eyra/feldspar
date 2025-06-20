FROM node:24-bookworm AS builder

RUN npx -y playwright install --with-deps

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

# Add Poetry to PATH
ENV PATH="/root/.local/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy package.json files for dependency installation
COPY package.json ./
COPY packages/feldspar/package.json ./packages/feldspar/
COPY packages/data-collector/package.json ./packages/data-collector/

# Copy package lock for reliable installs
COPY package-lock.json* ./

# Copy postcss config
COPY postcss.config.js ./

# Ensure workspaces are configured properly
COPY .npmrc* ./

# Install all dependencies, including devDependencies
RUN npm install

# Expose port
EXPOSE 3000
