#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# TokenEquityX Platform V3 — Linux/Mac Installer
# ═══════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "============================================"
echo "  TokenEquityX Platform V3 — Installer"
echo "  Africa's Digital Capital Market"
echo "============================================"
echo ""

# Check Docker
echo "[1/6] Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}ERROR: Docker is not installed.${NC}"
    echo "Install Docker from https://docker.com then run this script again."
    exit 1
fi
echo -e "${GREEN}Docker found: $(docker --version)${NC}"

# Check Docker Compose
echo "[2/6] Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
    echo -e "${RED}ERROR: Docker Compose not found.${NC}"
    echo "Update Docker Desktop to the latest version."
    exit 1
fi
echo -e "${GREEN}Docker Compose found.${NC}"

# Setup .env
echo "[3/6] Setting up configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}Configuration file created from template.${NC}"
    echo ""
    echo "IMPORTANT: Edit .env before continuing!"
    echo "At minimum set:"
    echo "  - DB_PASSWORD"
    echo "  - JWT_SECRET (run: openssl rand -hex 64)"
    echo "  - SETUP_SECRET"
    echo "  - PLATFORM_ADMIN_WALLET"
    echo ""
    read -p "Press Enter when you have edited .env..."
else
    echo -e "${GREEN}Configuration file already exists.${NC}"
fi

# Create directories
echo "[4/6] Creating directories..."
mkdir -p uploads logs
echo -e "${GREEN}Directories created.${NC}"

# Build and start
echo "[5/6] Building and starting platform..."
echo "This may take 5-10 minutes on first run..."
echo ""
docker compose up --build -d

# Wait for services
echo "[6/6] Waiting for services to start..."
sleep 15

# Check health
echo ""
echo "Checking API health..."
if curl -sf http://localhost:3001/api/health > /dev/null; then
    echo -e "${GREEN}API is healthy!${NC}"
else
    echo -e "${YELLOW}API not responding yet — it may still be starting.${NC}"
fi

echo ""
echo "============================================"
echo -e "${GREEN}  Installation Complete!${NC}"
echo "============================================"
echo ""
echo "  Platform URL:  http://localhost:3000"
echo "  Setup Wizard:  http://localhost:3000/setup"
echo "  API Health:    http://localhost:3001/api/health"
echo ""
echo "  Opening setup wizard..."
echo ""

# Open browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000/setup
elif command -v open &> /dev/null; then
    open http://localhost:3000/setup
fi

echo "  To stop the platform: docker compose down"
echo "  To view logs:         docker compose logs -f"
echo "  To load demo data:    docker compose exec api node src/db/seed.js"
echo ""