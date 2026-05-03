import express from 'express';
import cors from 'cors';
import multer from 'multer';
import libre from 'libreoffice-convert';
import CloudmersiveConvertApiClient from 'cloudmersive-convert-api-client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Cloudmersive setup
const defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
const Apikey = defaultClient.authentications['Apikey'];
Apikey.apiKey = process.env.CLOUDMERSIVE_API_KEY || 'YOUR_API_KEY_HERE';
const cloudmersiveApi = new CloudmersiveConvertApiClient.ConvertDocumentApi();

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

// --- Endpoint: Cloudmersive PDF to DOCX ---
app.post('/api/convert/pdf-to-docx', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  
  if (!process.env.CLOUDMERSIVE_API_KEY && Apikey.apiKey === 'YOUR_API_KEY_HERE') {
    fs.unlinkSync(req.file.path);
    return res.status(500).send('Cloudmersive API Key is missing. Please set CLOUDMERSIVE_API_KEY in backend .env.');
  }

  const inputFile = Buffer.from(fs.readFileSync(req.file.path).buffer);
  
  console.log(`Converting ${req.file.originalname} to DOCX via Cloudmersive...`);

  const callback = function(error, data, response) {
    // Clean up
    fs.unlinkSync(req.file.path);

    if (error) {
      console.error(error);
      return res.status(500).send('Cloudmersive conversion failed: ' + error.message);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="converted.docx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.send(data);
    }
  };

  // ConvertDocumentPdfToDocx can take a Buffer or a File. 
  cloudmersiveApi.convertDocumentPdfToDocx(inputFile, callback);
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
