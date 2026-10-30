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

:: ── Step 2: Rust Backend Check ─────────────
echo   [93m[2/3][0m Checking Rust environment...
where cargo >nul 2>nul
if errorlevel 1 (
  echo         [93m!  Cargo not found -- ensure Rust is installed: https://rustup.rs[0m
) else (
  echo         [92mv  Rust / Cargo verified[0m
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
