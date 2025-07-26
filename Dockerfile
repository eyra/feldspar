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

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy pnpm workspace configuration
COPY pnpm-workspace.yaml ./

# Copy package.json files for dependency installation
COPY package.json ./
COPY packages/feldspar/package.json ./packages/feldspar/
COPY packages/data-collector/package.json ./packages/data-collector/

# Copy pnpm lock file for reliable installs
COPY pnpm-lock.yaml* ./

# Copy postcss config
COPY postcss.config.js ./

# Install all dependencies, including devDependencies
RUN pnpm install

# Expose port
EXPOSE 3000
