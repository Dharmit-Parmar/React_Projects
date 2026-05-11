# PDF Manager

A powerful, pixel-perfect document conversion, PDF merging, editing, and image enhancement application built with React, Vite, and Express.

## Features

- **Merge PDFs:** Effortlessly arrange and combine multiple PDFs into a single document.
- **Convert & Merge:** Drop DOCX, PPTX, Images, and TXT files, and merge them all into a single PDF.
- **File Converter:** Universal converter between PDF, Word, PowerPoint, Images, HTML, and Text. Uses a LibreOffice backend for zero layout distortion on Office files, and Python `pdf2docx` for PDF → DOCX.
- **Edit PDF:** Interactive browser-based PDF editor supporting freehand drawing, text annotation, image insertion, and history-based undo/redo.
- **Enhance Image:** AI-driven super-resolution upscaling for images. Features "Fast 2x" and "Pro 4x" tiers, memory-safe tiling algorithms for large images (2K+), and an intuitive before/after slider comparison UI.
- **Global Shared State:** Files uploaded in one tab persist seamlessly across all features.
- **Modern UI:** Clean, dark-themed, glass-morphism aesthetic for an intuitive and professional user experience.

---

## 🐳 Option 1: Docker (Recommended — no installs needed)

> **The Docker image bundles LibreOffice, Python, and all dependencies.**  
> You only need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.

### Prerequisites
- Install **Docker Desktop**: https://www.docker.com/products/docker-desktop/
- Make sure Docker is running (you'll see the whale icon in your taskbar/menu bar).

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/pdf-manager.git
cd pdf-manager

# 2. Build and start the app (first run takes ~3-5 min to download & build)
docker-compose up --build

# 3. Open the app
# → http://localhost:5173
```

> **Next time**, just run `docker-compose up` (no `--build` needed unless you change the code).

To stop the app: press `Ctrl+C`, then run `docker-compose down`.

---

## 💻 Option 2: Local Development Setup

### 1. System Requirements
This app uses **LibreOffice** for pixel-perfect Office file conversion. You must install it manually:

| OS | Command |
|---|---|
| **macOS** | `brew install --cask libreoffice` |
| **Ubuntu/Debian** | `sudo apt-get install -y libreoffice` |
| **Windows** | Download from [libreoffice.org](https://www.libreoffice.org/) |

You also need **Python 3** and `pdf2docx` for the PDF → DOCX feature, as well as AI libraries (like `opencv-python`) for image enhancement:

```bash
# macOS / Linux
python3 -m venv server/venv
server/venv/bin/pip install -r server/requirements.txt  # Or install individually: pdf2docx opencv-python etc.

# Windows
python -m venv server/venv
server\venv\Scripts\pip install -r server/requirements.txt
```
*(Note: Refer to `server/requirements.txt` if available for exact Python dependencies.)*

### 2. Install Node Packages

```bash
npm install
```

### 3. Environment Variables (Optional)

Create a `.env` file in the root for the Cloudmersive API (used by some conversion routes):

```env
CLOUDMERSIVE_API_KEY=your_free_api_key_here
```

Get a free key at [cloudmersive.com](https://cloudmersive.com/).

### 4. Start the App

```bash
npm run dev:all
```

- **Frontend:** http://localhost:5173  
- **Backend API:** http://localhost:3001

---

## 🛠 Troubleshooting

| Problem | Fix |
|---|---|
| `docker: command not found` | Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| Port 5173 already in use | Run `docker-compose down` first, or change the port in `docker-compose.yml` |
| Build fails on `pdf2docx` or Python | The Python venv setup requires internet access during `docker-compose up --build` |
| LibreOffice conversion fails locally | Make sure `libreoffice` is in your PATH: run `libreoffice --version` |
