# PDF Manager (Full-Stack Document Engine)

A powerful, pixel-perfect document conversion and PDF merging application built with React, Vite, and Express.

## Features
- **Convert & Merge:** Drop DOCX, PPTX, Images, and TXT files, and merge them all into a single PDF.
- **File Converter:** Universal converter between PDF, Word, PowerPoint, Images, HTML, and Text.
- **Pixel-Perfect Formatting:** Uses a LibreOffice backend to guarantee zero layout distortion when converting Microsoft Office files.
- **Global Shared State:** Files uploaded in one tab persist seamlessly across all features.

---

## 🛠 Option 1: Docker Setup (Recommended)
**"It just works — comes with LibreOffice included!"**

If you want to clone this repository and run it without installing LibreOffice or Node.js on your computer, use Docker. The container automatically installs the LibreOffice engine.

1. Install [Docker Desktop](https://www.docker.com/).
2. Run the following command in the project root:
```bash
docker-compose up --build
```
The app will be available at `http://localhost:5173`.

---

## 💻 Option 2: Local Development Setup

If you want to run the code natively on your machine, you must install the dependencies yourself.

### 1. System Requirements (Crucial)
Because this application guarantees pixel-perfect document conversions, it relies on the core engine of **LibreOffice**. **You must have LibreOffice installed on your host machine to process DOCX/PPTX files.**
- **macOS:** `brew install --cask libreoffice`
- **Ubuntu/Debian:** `sudo apt-get install -y libreoffice`
- **Windows:** Download from [libreoffice.org](https://www.libreoffice.org/)

### 2. Install NPM Packages
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory. If you want to use the PDF-to-DOCX feature, you need a free API key from [Cloudmersive](https://cloudmersive.com/):
```env
CLOUDMERSIVE_API_KEY=your_free_api_key_here
```

### 4. Start the Application
Run the frontend and backend servers concurrently:
```bash
npm run dev:all
```
*The frontend runs on `localhost:5173` and the Express backend runs on `localhost:3001`.*
