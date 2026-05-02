import { readFileSync, writeFileSync } from 'fs';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import * as mammoth from 'mammoth';

// Wait, html2canvas needs a DOM. I can't easily test html2canvas without puppeteer/JSDOM.
// Let me check what the overlapping issue might be natively.
