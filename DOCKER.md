# Docker Development Setup for Feldspar

This document provides instructions for setting up and using Docker for both development and production environments for the Feldspar project.

## Development Environment

The development setup uses `Dockerfile.dev` and `docker-compose.dev.yml` to create a container with all necessary dependencies while allowing for live code reloading.

### Starting the Development Environment

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This will:
- Build the Docker image with Node.js, Python, and all required dependencies
- Mount your local codebase into the container
- Start the development servers with hot reloading
- Make the application available on the following ports:
  - Feldspar: http://localhost:3000
  - Data Collector: http://localhost:3001

### Running Commands Inside the Container

To run commands inside the running container:

```bash
docker-compose -f docker-compose.dev.yml exec feldspar-dev bash
```

This gives you a shell inside the container where you can run pnpm commands, tests, etc.

### Stopping the Development Environment

```bash
docker-compose -f docker-compose.dev.yml down
```

## Production Environment

The production setup uses `Dockerfile` and `docker-compose.yml` to create an optimized, production-ready container.

### Building and Starting the Production Environment

```bash
docker-compose up --build
```

This will:
- Build the Docker image with an optimized multi-stage build
- Create an optimized production build of the application
- Make the application available at http://localhost:3000

### Stopping the Production Environment

```bash
docker-compose down
```

## Volume Management

The development setup uses Docker volumes to store:
- Node module dependencies
- Poetry cache

This prevents having to reinstall dependencies on every build and keeps your host machine clean.

## Troubleshooting

### Port Conflicts

If you encounter port conflicts, edit the port mappings in the docker-compose files:

```yaml
ports:
  - "NEW_HOST_PORT:CONTAINER_PORT"
```

### Node Modules Issues

If you encounter problems with node modules, you might need to clear the volumes:

```bash
docker-compose -f docker-compose.dev.yml down -v
```

This will remove the volumes, and dependencies will be reinstalled on the next build.