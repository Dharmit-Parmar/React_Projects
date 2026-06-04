import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import exifr from 'exifr';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const dbPath = path.join(app.getPath('userData'), 'photoclone.sqlite');
const db = new sqlite3.Database(dbPath);

// Helper to run queries as promises
const runQuery = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});
const getQuery = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});
const allQuery = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

let mainWindow;
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

async function initDB() {
  try {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_path TEXT UNIQUE NOT NULL,
        thumbnail_path TEXT NOT NULL,
        date_taken TEXT NOT NULL,
        file_hash TEXT UNIQUE
      )
    `);
    
    // Attempt to add file_hash column if it doesn't exist (for existing databases)
    try {
      await runQuery('ALTER TABLE photos ADD COLUMN file_hash TEXT');
      await runQuery('CREATE UNIQUE INDEX IF NOT EXISTS idx_file_hash ON photos(file_hash)');
    } catch (e) {
      // Ignore if column already exists
    }
    
    console.log("SQLite Database initialized at", dbPath);
  } catch (err) {
    console.error("DB Init error:", err);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    // Wait for Vite to start
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  // Register custom protocol to serve local images securely
  protocol.registerFileProtocol('local-image', (request, callback) => {
    const url = request.url.replace(/^local-image:\/\//, '');
    try {
      return callback(decodeURIComponent(url));
    } catch (error) {
      console.error(error);
    }
  });

  await initDB();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


let globalQueue = [];
let globalProcessedCount = 0;
let globalTotalCount = 0;
let isProcessing = false;
let isCancelled = false;

ipcMain.handle('cancel-scan', () => {
  isCancelled = true;
  return true;
});

ipcMain.handle('select-media', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'openDirectory', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'heic'] }]
  });
  if (result.canceled) return null;
  
  // Fast crawl selected paths to build the queue
  for (const p of result.filePaths) {
    if (fs.statSync(p).isDirectory()) {
      await fastCrawlFolder(p);
    } else {
      const ext = path.extname(p).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.heic'].includes(ext)) {
        globalQueue.push(p);
        globalTotalCount++;
      }
    }
  }

  // Start the worker if it isn't already running
  processQueueWorker().catch(console.error);

  return `${result.filePaths.length} item(s) selected`;
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fastCrawlFolder(folderPath) {
  try {
    const dir = await fs.promises.opendir(folderPath);
    for await (const dirent of dir) {
      const fullPath = path.join(folderPath, dirent.name);
      if (dirent.isDirectory()) {
        await fastCrawlFolder(fullPath); // Recursive crawl
      } else if (dirent.isFile()) {
        const ext = path.extname(dirent.name).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.heic'].includes(ext)) {
          globalQueue.push(fullPath);
          globalTotalCount++;
        }
      }
    }
  } catch (err) {
    console.error("Error crawling directory", err);
  }
}

async function processQueueWorker() {
  if (isProcessing) return;
  isProcessing = true;
  isCancelled = false;

  const cacheDir = path.join(app.getPath('userData'), 'thumbnails');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Send initial progress so UI shows immediately
  if (mainWindow) {
    mainWindow.webContents.send('scan-progress', {
      current: globalProcessedCount,
      total: globalTotalCount
    });
  }

  while (globalQueue.length > 0) {
    if (isCancelled) {
      globalQueue = [];
      break;
    }

    const fullPath = globalQueue.shift();
    try {
      const processed = await processSingleFile(fullPath, cacheDir);
      globalProcessedCount++;
      
      if (processed && globalProcessedCount % 5 === 0) {
        await sleep(100); // CPU Throttle
      }
    } catch (err) {
      console.error("Error processing file", fullPath, err);
      globalProcessedCount++; // Always increment so progress bar completes
    }

    // Send realtime progress
    if (mainWindow) {
      mainWindow.webContents.send('scan-progress', {
        current: globalProcessedCount,
        total: globalTotalCount
      });
    }
  }

  // Queue finished or cancelled
  isProcessing = false;
  isCancelled = false;
  globalProcessedCount = 0;
  globalTotalCount = 0;
  if (mainWindow) {
    mainWindow.webContents.send('scan-complete');
  }
}

async function processSingleFile(fullPath, cacheDir) {
  // 1. Path-based deduplication
  const resPath = await getQuery('SELECT id FROM photos WHERE original_path = ?', [fullPath]);
  if (resPath) return false; // Already processed

  // 2. Hash-based deduplication (Catches identical files that were copied/renamed)
  const fileBuffer = await fs.promises.readFile(fullPath);
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  const resHash = await getQuery('SELECT id FROM photos WHERE file_hash = ?', [fileHash]);
  if (resHash) {
    console.log(`Skipped duplicate image: ${fullPath}`);
    return false;
  }

  // Parse EXIF date
  let dateTaken = new Date();
  try {
    const exifData = await exifr.parse(fullPath, { pick: ['DateTimeOriginal'] });
    if (exifData && exifData.DateTimeOriginal) {
      dateTaken = new Date(exifData.DateTimeOriginal);
    } else {
      dateTaken = fs.statSync(fullPath).birthtime;
    }
  } catch(e) {
     dateTaken = fs.statSync(fullPath).birthtime;
  }

  // Generate high quality thumbnail
  const thumbName = crypto.randomUUID() + '.jpg';
  const thumbPath = path.join(cacheDir, thumbName);
  
  await sharp(fullPath)
    .resize(600, 600, { fit: 'cover' })
    .jpeg({ quality: 85 }) // High quality as requested
    .toFile(thumbPath);

  // Save to DB
  await runQuery(
    'INSERT INTO photos (original_path, thumbnail_path, date_taken, file_hash) VALUES (?, ?, ?, ?)',
    [fullPath, thumbPath, dateTaken.toISOString(), fileHash]
  );

  // Notify UI of new photo
  mainWindow.webContents.send('photo-scanned', { original_path: fullPath, thumbnail_path: thumbPath, date_taken: dateTaken.toISOString() });
  return true;
}

ipcMain.handle('get-photos', async () => {
  try {
    const rows = await allQuery('SELECT * FROM photos ORDER BY date_taken ASC');
    return rows;
  } catch (err) {
    console.error(err);
    return [];
  }
});
