# Graph Report - instachat-viewer  (2026-08-27)

## Corpus Check
- Corpus is ~4,802 words - fits in a single context window. You may not need a graph.

## Summary
- 69 nodes · 78 edges · 16 communities (8 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- External Dependencies
- Package Configuration
- Core Application
- Header Components
- Chat UI Components
- Dev Dependencies
- ESLint Configuration
- React Hooks Linting
- React Refresh
- Globals
- JSDom
- React DOM Types
- Vite Server
- Vite React Plugin

## God Nodes (most connected - your core abstractions)
1. `scripts` - 5 edges
2. `App()` - 4 edges
3. `JumpToDate()` - 3 edges
4. `parseInstagramHTML()` - 3 edges
5. `mergeParseResults()` - 3 edges
6. `date-fns` - 2 edges
7. `lucide-react` - 2 edges
8. `react` - 2 edges
9. `react-dom` - 2 edges
10. `react-swipeable` - 2 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `mergeParseResults()`  [EXTRACTED]
  src/App.jsx → src/utils/parseInstagram.js
- `App()` --calls--> `parseInstagramHTML()`  [EXTRACTED]
  src/App.jsx → src/utils/parseInstagram.js

## Import Cycles
- None detected.

## Communities (16 total, 8 thin omitted)

### Community 0 - "External Dependencies"
Cohesion: 0.15
Nodes (13): date-fns, lucide-react, dependencies, date-fns, lucide-react, react, react-dom, react-swipeable (+5 more)

### Community 1 - "Package Configuration"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 2 - "Core Application"
Cohesion: 0.36
Nodes (5): App(), FileUpload(), ParticipantSelector(), mergeParseResults(), parseInstagramHTML()

### Community 3 - "Header Components"
Cohesion: 0.38
Nodes (3): ChatSearch(), Header(), JumpToDate()

### Community 4 - "Chat UI Components"
Cohesion: 0.47
Nodes (3): ChatBubble(), ChatWindow(), DateSeparator()

### Community 5 - "Dev Dependencies"
Cohesion: 0.40
Nodes (5): eslint, devDependencies, eslint, @types/react, @types/react

## Knowledge Gaps
- **24 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Dev Dependencies` to `Package Configuration`, `ESLint Configuration`, `React Hooks Linting`, `React Refresh`, `Globals`, `JSDom`, `React DOM Types`, `Vite Server`, `Vite React Plugin`?**
  _High betweenness centrality (0.281) - this node is a cross-community bridge._
- **Why does `dependencies` connect `External Dependencies` to `Package Configuration`?**
  _High betweenness centrality (0.190) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._