@echo off
chcp 65001 >nul
setlocal

:: Navigate to the folder where this script lives
cd /d "%~dp0"

cls

:: ── Logo ────────────────────────────────────
echo.
echo   [96m██████╗ ██████╗ ███████╗    ███╗   ███╗ █████╗ ███╗   ██╗ █████╗  ██████╗ ███████╗██████╗[0m
echo   [96m██╔══██╗██╔══██╗██╔════╝    ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝ ██╔════╝██╔══██╗[0m
echo   [96m██████╔╝██║  ██║█████╗      ██╔████╔██║███████║██╔██╗ ██║███████║██║  ███╗█████╗  ██████╔╝[0m
echo   [96m██╔═══╝ ██║  ██║██╔══╝      ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══██║██║   ██║██╔══╝  ██╔══██╗[0m
echo   [96m██║     ██████╔╝██║         ██║  ╚═╝ ██║██║  ██║██║ ╚████║██║  ██║╚██████╔╝███████╗██║  ██║[0m
echo   [96m╚═╝     ╚═════╝ ╚═╝         ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝[0m
echo.
echo   [95m  ^^  Pixel-perfect PDF conversion ^& merging  ^^[0m
echo.
echo   [96m  ────────────────────────────────────────────────────────────────[0m
echo.

:: ── Step 1: npm install ──────────────────────
echo   [93m[1/3][0m Installing Node packages...
if not exist "node_modules" (
  call npm install
  if errorlevel 1 (
    echo.
    echo   [91mX  npm install failed. Make sure Node.js is installed: https://nodejs.org[0m
    echo.
    pause
    exit /b 1
  )
) else (
  echo         [92mv  node_modules already exists -- skipping[0m
)
echo.

:: ── Step 2: Python venv + pdf2docx ──────────
echo   [93m[2/3][0m Setting up Python environment (pdf2docx)...
if not exist "server\venv" (
  where python >nul 2>nul
  if errorlevel 1 (
    echo         [93m!  Python not found -- PDF-to-DOCX feature will be unavailable[0m
    echo         [93m   Install from https://www.python.org/downloads/[0m
  ) else (
    python -m venv server\venv
    server\venv\Scripts\pip install --upgrade pip --quiet
    server\venv\Scripts\pip install pdf2docx --quiet
    echo         [92mv  Python venv created and pdf2docx installed[0m
  )
) else (
  echo         [92mv  Python venv already exists -- skipping[0m
)
echo.

:: ── Step 3: Start servers ────────────────────
echo   [93m[3/3][0m Starting servers...
echo.
echo   [96m  ────────────────────────────────────────────────────────────────[0m
echo   [92m  v  App will be ready at: http://localhost:5173[0m
echo   [92m  v  API server running at:  http://localhost:3001[0m
echo   [96m  ────────────────────────────────────────────────────────────────[0m
echo.
echo   [93m  Press Ctrl+C to stop all servers.[0m
echo.

call npm run dev:all
pause
