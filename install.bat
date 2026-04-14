@echo off
title TokenEquityX Platform Installer
color 0A

echo.
echo  ============================================
echo    TokenEquityX Platform V3 — Installer
echo    Africa's Digital Capital Market
echo  ============================================
echo.

:: Check for Docker
echo [1/6] Checking Docker...
docker --version > nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Docker is not installed.
    echo  Please install Docker Desktop from https://docker.com
    echo  Then run this installer again.
    echo.
    pause
    exit /b 1
)
echo  Docker found.

:: Check for Docker Compose
echo [2/6] Checking Docker Compose...
docker compose version > nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Docker Compose not found.
    echo  Please update Docker Desktop to the latest version.
    echo.
    pause
    exit /b 1
)
echo  Docker Compose found.

:: Copy .env file
echo [3/6] Setting up configuration...
if not exist .env (
    copy .env.example .env > nul
    echo  Configuration file created.
    echo.
    echo  IMPORTANT: Edit .env before continuing!
    echo  At minimum set:
    echo    - DB_PASSWORD
    echo    - JWT_SECRET
    echo    - SETUP_SECRET
    echo    - PLATFORM_ADMIN_WALLET
    echo.
    echo  Press any key when you have edited .env...
    pause > nul
) else (
    echo  Configuration file already exists.
)

:: Create required directories
echo [4/6] Creating directories...
if not exist uploads mkdir uploads
if not exist logs mkdir logs
echo  Directories created.

:: Build and start containers
echo [5/6] Building and starting platform...
echo  This may take 5-10 minutes on first run...
echo.
docker compose up --build -d

if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Failed to start platform.
    echo  Check the error messages above.
    echo.
    pause
    exit /b 1
)

:: Wait for services
echo [6/6] Waiting for services to start...
timeout /t 15 /nobreak > nul

:: Open browser
echo.
echo  ============================================
echo    Installation Complete!
echo  ============================================
echo.
echo  Opening setup wizard in your browser...
echo.
echo  Platform URL:  http://localhost:3000
echo  Setup Wizard:  http://localhost:3000/setup
echo  API Health:    http://localhost:3001/api/health
echo.
start http://localhost:3000/setup

echo  To stop the platform: docker compose down
echo  To view logs:         docker compose logs -f
echo.
pause