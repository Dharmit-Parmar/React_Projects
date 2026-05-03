import express from 'express';
import cors from 'cors';
import multer from 'multer';
import libre from 'libreoffice-convert';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// --- Endpoint: LibreOffice Conversions (DOCX -> PDF, PPTX -> PDF, etc.) ---
app.post('/api/convert/libreoffice', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const toExt = req.body.toExt; // e.g. '.pdf'
  if (!toExt) return res.status(400).send('Missing target extension (toExt).');

  const fileExt = req.body.toExt.startsWith('.') ? req.body.toExt : `.${req.body.toExt}`;

  const inputPath = req.file.path;
  const fileData = fs.readFileSync(inputPath);

  console.log(`Converting ${req.file.originalname} to ${fileExt} via LibreOffice...`);

  libre.convert(fileData, fileExt, undefined, (err, done) => {
    // Clean up uploaded file
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

    if (err) {
      console.error(`Error converting with libreoffice: ${err}`);
      return res.status(500).send(
        'LibreOffice conversion failed. Make sure LibreOffice is installed and the file is not corrupted.'
      );
    }

    res.setHeader('Content-Disposition', `attachment; filename="converted${fileExt}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', done.length);
    res.send(done);
  });
});

// --- Endpoint: Python PDF to DOCX ---
app.post('/api/convert/pdf-to-docx', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');

  const inputPath = req.file.path;
  const outputPath = `${inputPath}.docx`;

  console.log(`Converting ${req.file.originalname} to DOCX via Python pdf2docx...`);

  // Cross-platform python path: Linux/Mac uses bin/python3, Windows uses Scripts/python.exe
  const isWin = process.platform === 'win32';
  const pythonExec = isWin
    ? path.join(__dirname, 'venv', 'Scripts', 'python.exe')
    : path.join(__dirname, 'venv', 'bin', 'python3');
  const scriptPath = path.join(__dirname, 'pdf_to_docx.py');

  // Check venv exists before trying
  if (!fs.existsSync(pythonExec)) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    return res.status(500).send(
      'Python environment not set up. Run: python3 -m venv server/venv && server/venv/bin/pip install pdf2docx'
    );
  }

  exec(`"${pythonExec}" "${scriptPath}" "${inputPath}" "${outputPath}"`, { timeout: 120000 }, (error, stdout, stderr) => {
    // Clean up input PDF
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

    if (error) {
      console.error(`Python conversion error: ${error.message}`, stderr);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      return res.status(500).send(`PDF to DOCX conversion failed: ${stderr || error.message}`);
    }

    if (!fs.existsSync(outputPath)) {
      return res.status(500).send('Conversion produced no output file.');
    }

    const stat = fs.statSync(outputPath);
    res.setHeader('Content-Disposition', 'attachment; filename="converted.docx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Length', stat.size);

    res.sendFile(path.resolve(outputPath), (err) => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  });
});

// --- Health check ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
