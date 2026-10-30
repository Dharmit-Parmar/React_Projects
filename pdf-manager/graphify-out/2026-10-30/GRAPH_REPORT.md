# Graph Report - pdf-manager  (2026-10-30)

## Corpus Check
- Large corpus: 732 files · ~1,871,783 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 172 nodes · 213 edges · 15 communities (14 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 1,200 input · 450 output

## Community Hubs (Navigation)
- Production Dependencies & Libraries
- File Converter Component
- App Shell & Error Boundary
- DevDependencies & Tooling
- Package Manifest & NPM Scripts
- Convert & Merge Pipeline
- Architecture & System Overview
- Express Server API Runtime
- Test Document Generator

## God Nodes (most connected - your core abstractions)
1. `convertFile()` - 20 edges
2. `ConvertAndMerge()` - 8 edges
3. `scripts` - 7 edges
4. `backendConvert()` - 6 edges
5. `FileConverter()` - 6 edges
6. `convertFileToPdfBytes()` - 5 edges
7. `PdfEditor()` - 5 edges
8. `README Documentation` - 5 edges
9. `ErrorBoundary` - 4 edges
10. `PdfMerger()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `File Converter Feature` --calls_api--> `Express Backend API Server`  [EXTRACTED]
  README.md → server/server.js
- `Docker Container Deployment` --hosts--> `Express Backend API Server`  [EXTRACTED]
  docker-compose.yml → server/server.js
- `Express Backend API Server` --executes_script--> `Python OpenCV Super-Resolution`  [EXTRACTED]
  server/server.js → server/enhance_image.py
- `Express Backend API Server` --executes_script--> `Python PDF to DOCX Converter`  [EXTRACTED]
  server/server.js → server/pdf_to_docx.py

## Import Cycles
- None detected.

## Communities (15 total, 1 thin omitted)

### Community 0 - "Production Dependencies & Libraries"
Cohesion: 0.05
Nodes (43): cloudmersive-convert-api-client, cors, docx, dotenv, express, @hello-pangea/dnd, jspdf, jszip (+35 more)

### Community 1 - "File Converter Component"
Cohesion: 0.11
Nodes (32): backendConvert(), CONVERSION_MAP, convertFile(), DOC_EXTS, docxToHtml(), docxToPdf(), docxToTxt(), downloadImageBlobs() (+24 more)

### Community 2 - "App Shell & Error Boundary"
Cohesion: 0.12
Nodes (13): App(), ErrorBoundary, FileConverter, ImageEnhancer, TABS, applyTransform(), getStandardFontName(), hexToRgb() (+5 more)

### Community 3 - "DevDependencies & Tooling"
Cohesion: 0.10
Nodes (21): concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, concurrently (+13 more)

### Community 4 - "Package Manifest & NPM Scripts"
Cohesion: 0.17
Nodes (11): name, private, scripts, build, dev, dev:all, lint, preview (+3 more)

### Community 5 - "Convert & Merge Pipeline"
Cohesion: 0.30
Nodes (11): backendConvert(), ConvertAndMerge(), convertFileToPdfBytes(), convertImageToPdf(), convertTextToPdf(), formatBytes(), getCategoryBadge(), getCategoryIcon() (+3 more)

### Community 6 - "Architecture & System Overview"
Cohesion: 0.20
Nodes (10): Express Backend API Server, Python OpenCV Super-Resolution, Python PDF to DOCX Converter, Docker Container Deployment, README Documentation, Convert & Merge Feature, File Converter Feature, AI Image Super-Resolution (+2 more)

### Community 7 - "Express Server API Runtime"
Cohesion: 0.40
Nodes (4): app, __dirname, __filename, upload

## Knowledge Gaps
- **62 isolated node(s):** `doc`, `name`, `private`, `version`, `type` (+57 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Production Dependencies & Libraries` to `Package Manifest & NPM Scripts`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `DevDependencies & Tooling` to `Package Manifest & NPM Scripts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **What connects `doc`, `name`, `private` to the rest of the system?**
  _62 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Production Dependencies & Libraries` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `File Converter Component` be split into smaller, more focused modules?**
  _Cohesion score 0.11092436974789915 - nodes in this community are weakly interconnected._
- **Should `App Shell & Error Boundary` be split into smaller, more focused modules?**
  _Cohesion score 0.11594202898550725 - nodes in this community are weakly interconnected._
- **Should `DevDependencies & Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._