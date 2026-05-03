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
    fs.unlinkSync(inputPath);

    if (err) {
      console.error(`Error converting with libreoffice: ${err}`);
      return res.status(500).send('Conversion failed. Is LibreOffice installed?');
    }

    res.setHeader('Content-Disposition', `attachment; filename="converted${fileExt}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(done);
  });
});

// --- Endpoint: Python PDF to DOCX ---
app.post('/api/convert/pdf-to-docx', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');

  const inputPath = req.file.path;
  const outputPath = `${inputPath}.docx`;

  console.log(`Converting ${req.file.originalname} to DOCX via Python pdf2docx...`);

  // Path to the virtual environment python executable
  const pythonExec = path.join(__dirname, 'venv', 'bin', 'python3');
  const scriptPath = path.join(__dirname, 'pdf_to_docx.py');

  exec(`"${pythonExec}" "${scriptPath}" "${inputPath}" "${outputPath}"`, (error, stdout, stderr) => {
    // Clean up input PDF
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

    if (error) {
      console.error(`Python conversion error: ${error.message}`);
      return res.status(500).send('Python PDF to DOCX conversion failed.');
    }

    res.setHeader('Content-Disposition', 'attachment; filename="converted.docx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    
    res.sendFile(path.resolve(outputPath), (err) => {
      // Clean up output DOCX after sending
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  });
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
