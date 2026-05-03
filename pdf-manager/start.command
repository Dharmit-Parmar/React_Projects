#!/bin/bash
# ─────────────────────────────────────────────
#  PDF Manager — macOS Launcher
#  Double-click this file in Finder to start!
# ─────────────────────────────────────────────

# Navigate to the folder where this script lives
cd "$(dirname "$0")"

# ── Colours ──────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
RESET='\033[0m'

clear

# ── Logo ─────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}"
echo "  ██████╗ ██████╗ ███████╗    ███╗   ███╗ █████╗ ███╗   ██╗ █████╗  ██████╗ ███████╗██████╗ "
echo "  ██╔══██╗██╔══██╗██╔════╝    ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝ ██╔════╝██╔══██╗"
echo "  ██████╔╝██║  ██║█████╗      ██╔████╔██║███████║██╔██╗ ██║███████║██║  ███╗█████╗  ██████╔╝"
echo "  ██╔═══╝ ██║  ██║██╔══╝      ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══██║██║   ██║██╔══╝  ██╔══██╗"
echo "  ██║     ██████╔╝██║         ██║ ╚═╝ ██║██║  ██║██║ ╚████║██║  ██║╚██████╔╝███████╗██║  ██║"
echo "  ╚═╝     ╚═════╝ ╚═╝         ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝"
echo -e "${RESET}"
echo -e "  ${MAGENTA}${BOLD}  ⚡  Pixel-perfect PDF conversion & merging  ⚡${RESET}"
echo ""
echo -e "  ${CYAN}────────────────────────────────────────────────────────────────${RESET}"
echo ""

# ── Step 1: npm install ───────────────────────
echo -e "  ${YELLOW}${BOLD}[1/3]${RESET} ${BOLD}Installing Node packages...${RESET}"
if [ ! -d "node_modules" ]; then
  npm install
  if [ $? -ne 0 ]; then
    echo -e "\n  ${RED}✗ npm install failed. Make sure Node.js is installed: https://nodejs.org${RESET}\n"
    read -p "  Press Enter to close..."
    exit 1
  fi
else
  echo -e "       ${GREEN}✓ node_modules already exists — skipping${RESET}"
fi
echo ""

# ── Step 2: Python venv + pdf2docx ───────────
echo -e "  ${YELLOW}${BOLD}[2/3]${RESET} ${BOLD}Setting up Python environment (pdf2docx)...${RESET}"
if [ ! -d "server/venv" ]; then
  if command -v python3 &>/dev/null; then
    python3 -m venv server/venv
    server/venv/bin/pip install --upgrade pip --quiet
    server/venv/bin/pip install pdf2docx --quiet
    echo -e "       ${GREEN}✓ Python venv created and pdf2docx installed${RESET}"
  else
    echo -e "       ${YELLOW}⚠  Python 3 not found — PDF→DOCX conversion will be unavailable${RESET}"
    echo -e "       ${YELLOW}   Install from https://www.python.org/downloads/${RESET}"
  fi
else
  echo -e "       ${GREEN}✓ Python venv already exists — skipping${RESET}"
fi
echo ""

# ── Step 3: Start servers ────────────────────
echo -e "  ${YELLOW}${BOLD}[3/3]${RESET} ${BOLD}Starting servers...${RESET}"
echo ""
echo -e "  ${CYAN}────────────────────────────────────────────────────────────────${RESET}"
echo -e "  ${GREEN}${BOLD}  ✓ App will be ready at: http://localhost:5173${RESET}"
echo -e "  ${GREEN}  ✓ API server running at:  http://localhost:3001${RESET}"
echo -e "  ${CYAN}────────────────────────────────────────────────────────────────${RESET}"
echo ""
echo -e "  ${YELLOW}  Press Ctrl+C to stop all servers.${RESET}"
echo ""

npm run dev:all
