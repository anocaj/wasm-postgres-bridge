#!/bin/bash

# Database setup script for WASM-PostgreSQL learning project

echo "Setting up PostgreSQL database for WASM-PostgreSQL learning..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start PostgreSQL container
echo "Starting PostgreSQL container..."
docker compose up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
timeout=60
counter=0

while ! docker compose exec postgres pg_isready -U postgres > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        echo "Error: PostgreSQL failed to start within $timeout seconds"
        exit 1
    fi
    echo "Waiting for PostgreSQL... ($counter/$timeout)"
    sleep 1
    counter=$((counter + 1))
done

echo "PostgreSQL is ready!"

# Run schema initialization (if not already done by docker-entrypoint-initdb.d)
echo "Ensuring database schema is up to date..."
docker compose exec postgres psql -U postgres -d wasm_learning -f /docker-entrypoint-initdb.d/schema.sql

echo "Database setup complete!"
echo ""
echo "Connection details:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: wasm_learning"
echo "  Username: postgres"
echo "  Password: password"
echo ""
echo "To connect manually:"
echo "  docker compose exec postgres psql -U postgres -d wasm_learning"
echo ""
echo "To stop the database:"
echo "  docker compose down"