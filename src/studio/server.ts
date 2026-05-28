import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

import pc from "picocolors";

import { buildAgentContext } from "../intelligence/context.js";
import { buildIntelligenceIndex } from "../intelligence/indexer.js";
import { affectedFiles, impactForFile, searchIntelligence } from "../intelligence/query.js";
import { readIntelligenceIndex } from "../intelligence/store.js";
import { syncIntelligenceIndex } from "../intelligence/sync.js";
import type { IntelligenceIndex } from "../intelligence/types.js";
import { resolveCwd } from "../utils/paths.js";

export interface StudioServerOptions {
  configPath?: string | undefined;
  cwd?: string | undefined;
  port?: number | undefined;
}

export interface StudioServer {
  close(): Promise<void>;
  port: number;
  url: string;
}

const defaultPort = 4317;

const json = (response: ServerResponse, body: unknown, status = 200): void => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
};

const html = (response: ServerResponse, body: string): void => {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
  });
  response.end(body);
};

const notFound = (response: ServerResponse): void => {
  json(response, { error: "Not found" }, 404);
};

const readBody = async (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });

const loadIndex = async (options: StudioServerOptions): Promise<IntelligenceIndex> =>
  (await readIntelligenceIndex(resolveCwd(options.cwd))) ?? buildIntelligenceIndex(options);

const graphPayload = (index: IntelligenceIndex): unknown => {
  const dependents = new Map<string, number>();
  for (const file of index.files) {
    for (const item of file.imports) {
      if (item.target) {
        dependents.set(item.target, (dependents.get(item.target) ?? 0) + 1);
      }
    }
  }

  const nodes = index.files.map((file) => ({
    folder: file.path.split("/").slice(0, -1).join("/") || ".",
    id: file.path,
    imports: file.imports.length,
    importedBy: dependents.get(file.path) ?? 0,
    symbols: file.symbols.length,
  }));
  const edges = index.files.flatMap((file) =>
    file.imports
      .filter((item): item is { line: number; source: string; target: string } =>
        Boolean(item.target),
      )
      .map((item) => ({
        from: file.path,
        line: item.line,
        source: item.source,
        to: item.target,
      })),
  );
  return { edges, nodes };
};

export const renderStudioHtml = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ship Clean Studio</title>
    <style>
      :root {
        color-scheme: light;
        --bg: oklch(98.2% 0.006 95);
        --surface: oklch(99.4% 0.004 95);
        --surface-2: oklch(96.4% 0.006 95);
        --surface-3: oklch(92.8% 0.008 95);
        --ink: oklch(20.8% 0.015 95);
        --soft: oklch(47.5% 0.018 95);
        --faint: oklch(68% 0.015 95);
        --line: oklch(88.4% 0.008 95);
        --accent: oklch(48% 0.09 174);
        --accent-2: oklch(83% 0.06 174);
        --selected: oklch(93% 0.035 174);
        --warn: oklch(72% 0.13 75);
        --radius: 10px;
        --shadow: 0 20px 70px -48px oklch(22% 0.015 95 / 58%);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font-size: 14px;
        line-height: 1.45;
      }

      button,
      input {
        border: 1px solid var(--line);
        border-radius: 8px;
        color: inherit;
        font: inherit;
      }

      button {
        align-items: center;
        background: var(--surface);
        cursor: pointer;
        display: inline-flex;
        font-weight: 560;
        gap: 8px;
        min-height: 36px;
        padding: 0 12px;
        transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
      }

      button:hover { background: var(--surface-2); border-color: var(--surface-3); }
      button:active { transform: translateY(1px); }

      input {
        background: var(--surface);
        min-height: 40px;
        min-width: 320px;
        outline: none;
        padding: 0 12px;
      }

      input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent-2), transparent 62%);
      }

      h1,
      h2,
      h3,
      p { margin: 0; }

      h1 {
        font-size: 19px;
        letter-spacing: 0;
        line-height: 1.15;
      }

      h2 {
        color: var(--soft);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      h3 { font-size: 13px; letter-spacing: 0; }

      .shell {
        display: grid;
        grid-template-columns: 336px minmax(0, 1fr);
        min-height: 100dvh;
      }

      .sidebar {
        background: var(--surface);
        border-right: 1px solid var(--line);
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
        min-height: 100dvh;
        padding: 20px 16px;
      }

      .brand {
        display: grid;
        gap: 6px;
        padding: 0 2px 18px;
      }

      .muted { color: var(--soft); }

      .stats {
        border-bottom: 1px solid var(--line);
        border-top: 1px solid var(--line);
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        margin-bottom: 18px;
      }

      .stat {
        display: grid;
        gap: 1px;
        padding: 14px 10px;
      }

      .stat + .stat { border-left: 1px solid var(--line); }
      .stat strong { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 21px; }
      .stat span { color: var(--soft); font-size: 12px; }

      .section-head {
        align-items: center;
        display: flex;
        justify-content: space-between;
        padding: 0 2px 10px;
      }

      .file-count { color: var(--faint); font-size: 12px; }

      .files {
        display: grid;
        gap: 4px;
        overflow: auto;
        padding-right: 4px;
      }

      .file {
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        display: grid;
        gap: 3px;
        padding: 9px 10px;
        text-align: left;
        width: 100%;
      }

      .file:hover { background: var(--surface-2); border-color: var(--line); }
      .file.active { background: var(--selected); border-color: color-mix(in oklch, var(--accent), transparent 52%); }
      .file-name { color: var(--ink); font-weight: 620; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .file-meta { color: var(--soft); font-size: 12px; }

      main {
        display: grid;
        grid-template-rows: auto minmax(420px, 1fr) 300px;
        min-width: 0;
      }

      .topbar {
        align-items: center;
        background: color-mix(in oklch, var(--bg), var(--surface) 66%);
        border-bottom: 1px solid var(--line);
        display: flex;
        gap: 16px;
        justify-content: space-between;
        padding: 18px 22px;
      }

      .title-stack {
        display: grid;
        gap: 5px;
        min-width: 220px;
      }

      .toolbar {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }

      .primary {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--surface);
      }

      .primary:hover { background: oklch(27% 0.014 95); border-color: oklch(27% 0.014 95); }

      .canvas-wrap {
        min-height: 0;
        padding: 18px 18px 12px;
      }

      .canvas-panel {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        height: 100%;
        min-height: 420px;
        overflow: hidden;
        position: relative;
      }

      .graph-toolbar {
        align-items: center;
        background: color-mix(in oklch, var(--surface), transparent 6%);
        border: 1px solid var(--line);
        border-radius: 999px;
        display: flex;
        gap: 6px;
        left: 14px;
        padding: 5px;
        position: absolute;
        top: 14px;
        z-index: 2;
      }

      .graph-toolbar button {
        border-color: transparent;
        min-height: 30px;
        padding: 0 10px;
      }

      .graph-hint {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 999px;
        bottom: 14px;
        color: var(--soft);
        font-size: 12px;
        left: 14px;
        padding: 6px 10px;
        position: absolute;
      }

      svg {
        display: block;
        height: 100%;
        width: 100%;
      }

      .edge {
        stroke: var(--line);
        stroke-width: 1.1;
        transition: opacity 160ms ease, stroke 160ms ease, stroke-width 160ms ease;
      }

      .edge.dimmed { opacity: .12; }
      .edge.active { opacity: .9; stroke: var(--accent); stroke-width: 1.8; }
      .node-hit { cursor: pointer; fill: transparent; }
      .node-dot { fill: var(--surface); stroke: var(--accent); stroke-width: 1.8; transition: r 160ms ease, fill 160ms ease; }
      .node-label { fill: var(--ink); font-size: 12px; font-weight: 650; pointer-events: none; }
      .node-sub { fill: var(--soft); font-size: 10.5px; pointer-events: none; }
      .node.dimmed { opacity: .24; }
      .node.active .node-dot { fill: var(--accent); r: 8; }
      .node.active .node-label { fill: var(--ink); font-weight: 780; }

      .bottom {
        border-top: 1px solid var(--line);
        display: grid;
        gap: 12px;
        grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr);
        min-height: 0;
        padding: 0 18px 18px;
      }

      .panel {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        min-width: 0;
        overflow: hidden;
      }

      .panel-head {
        align-items: center;
        border-bottom: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        padding: 12px 14px;
      }

      .panel-body {
        height: calc(100% - 46px);
        overflow: auto;
        padding: 6px 14px 14px;
      }

      .result {
        border-bottom: 1px solid var(--line);
        display: grid;
        gap: 4px;
        padding: 10px 0;
      }

      .result:last-child { border-bottom: 0; }
      code { color: var(--accent); font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 12px; }
      pre {
        color: var(--soft);
        font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
        font-size: 12px;
        line-height: 1.55;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .empty {
        align-content: center;
        color: var(--soft);
        display: grid;
        min-height: 160px;
      }

      @media (max-width: 980px) {
        .shell { grid-template-columns: 1fr; }
        .sidebar { border-right: 0; min-height: auto; }
        .files { max-height: 300px; }
        main { grid-template-rows: auto 460px auto; }
        .topbar { align-items: stretch; flex-direction: column; }
        .toolbar { justify-content: stretch; }
        input { min-width: 0; width: 100%; }
        .bottom { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <h1>Ship Clean Studio</h1>
          <p class="muted">Code map, impact radius, and agent context from SQLite.</p>
        </div>
        <div class="stats">
          <div class="stat"><strong id="fileCount">0</strong><span>files</span></div>
          <div class="stat"><strong id="symbolCount">0</strong><span>symbols</span></div>
          <div class="stat"><strong id="edgeCount">0</strong><span>imports</span></div>
        </div>
        <section>
          <div class="section-head">
            <h2>Files</h2>
            <span class="file-count" id="visibleFiles">0 shown</span>
          </div>
          <div class="files" id="files"></div>
        </section>
      </aside>
      <main>
        <header class="topbar">
          <div class="title-stack">
            <h1>Project Brain</h1>
            <p class="muted" id="createdAt">Loading SQLite index...</p>
          </div>
          <div class="toolbar">
            <input id="query" placeholder="Search symbols or ask for context" />
            <button class="primary" id="search">Search</button>
            <button id="sync">Sync</button>
          </div>
        </header>
        <section class="canvas-wrap">
          <div class="canvas-panel">
            <div class="graph-toolbar">
              <button id="zoomOut" title="Zoom out">−</button>
              <button id="resetView" title="Reset graph view">Reset</button>
              <button id="zoomIn" title="Zoom in">+</button>
            </div>
            <svg id="graph" role="img" aria-label="Import graph"></svg>
            <div class="graph-hint">Drag to pan, scroll to zoom, select a node to focus impact.</div>
          </div>
        </section>
        <section class="bottom">
          <div class="panel">
            <div class="panel-head">
              <h2>Results</h2>
              <span class="muted" id="resultCount">No query</span>
            </div>
            <div class="panel-body" id="results">
              <div class="empty">Search a symbol or select a file from the graph.</div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head">
              <h2>Impact / Context</h2>
              <span class="muted" id="selectedFile">No file selected</span>
            </div>
            <div class="panel-body">
              <pre id="details">Select a file to inspect dependencies, dependents, and affected files.</pre>
            </div>
          </div>
        </section>
      </main>
    </div>
    <script>
      const state = {
        files: [],
        graph: { nodes: [], edges: [] },
        selected: null,
        transform: { x: 0, y: 0, scale: 1 },
      };
      const $ = (id) => document.getElementById(id);

      async function request(path, options) {
        const response = await fetch(path, options);
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      }

      function escapeHtml(value) {
        return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
      }

      function labelFor(path) {
        return path.split("/").slice(-2).join("/");
      }

      function relatedSet(file) {
        const related = new Set([file]);
        for (const edge of state.graph.edges) {
          if (edge.from === file) related.add(edge.to);
          if (edge.to === file) related.add(edge.from);
        }
        return related;
      }

      function layoutGraph(width, height) {
        const nodes = [...state.graph.nodes].sort((left, right) => {
          const folderSort = left.folder.localeCompare(right.folder);
          return folderSort || left.id.localeCompare(right.id);
        });
        const columns = Math.max(3, Math.ceil(Math.sqrt(nodes.length * 1.45)));
        const rows = Math.max(1, Math.ceil(nodes.length / columns));
        const left = 90;
        const top = 86;
        const usableWidth = Math.max(1, width - left * 2);
        const usableHeight = Math.max(1, height - top * 2);
        const xStep = usableWidth / Math.max(columns - 1, 1);
        const yStep = usableHeight / Math.max(rows - 1, 1);
        const positions = new Map();

        nodes.forEach((node, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          const stagger = row % 2 === 0 ? 0 : xStep * .34;
          const folderNudge = (node.folder.length % 5) * 4;
          positions.set(node.id, {
            x: Math.min(width - 76, left + col * xStep + stagger),
            y: top + row * yStep + folderNudge,
          });
        });

        return positions;
      }

      function drawGraph() {
        const svg = $("graph");
        const width = svg.clientWidth || 960;
        const height = svg.clientHeight || 540;
        const canvasWidth = Math.max(width, 1200);
        const canvasHeight = Math.max(height, 760);
        const positions = layoutGraph(canvasWidth, canvasHeight);
        const active = state.selected ? relatedSet(state.selected) : null;

        const edgeMarkup = state.graph.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return "";
          const isActive = state.selected && (edge.from === state.selected || edge.to === state.selected);
          const isDimmed = active && !active.has(edge.from) && !active.has(edge.to);
          return '<line class="edge ' + (isActive ? "active" : "") + ' ' + (isDimmed ? "dimmed" : "") + '" x1="' + from.x + '" y1="' + from.y + '" x2="' + to.x + '" y2="' + to.y + '" />';
        }).join("");

        const nodeMarkup = state.graph.nodes.map((node) => {
          const point = positions.get(node.id);
          const isSelected = node.id === state.selected;
          const isDimmed = active && !active.has(node.id);
          const label = escapeHtml(labelFor(node.id));
          const meta = escapeHtml(node.symbols + " symbols, " + node.importedBy + " inbound");
          const r = Math.min(10, 4 + Math.sqrt(node.symbols + node.importedBy));
          const importance = node.symbols + node.importedBy + node.imports;
          const showLabel = isSelected || (active ? active.has(node.id) : importance >= 18);
          return '<g class="node ' + (isSelected ? "active" : "") + ' ' + (isDimmed ? "dimmed" : "") + '" data-node="' + escapeHtml(node.id) + '">' +
            '<title>' + escapeHtml(node.id) + '</title>' +
            '<circle class="node-dot" cx="' + point.x + '" cy="' + point.y + '" r="' + r + '" />' +
            '<circle class="node-hit" cx="' + point.x + '" cy="' + point.y + '" r="18" />' +
            (showLabel ? '<text class="node-label" x="' + (point.x + 13) + '" y="' + (point.y - 2) + '">' + label + '</text>' +
            '<text class="node-sub" x="' + (point.x + 13) + '" y="' + (point.y + 12) + '">' + meta + '</text>' : '') +
          '</g>';
        }).join("");

        svg.setAttribute("viewBox", (-state.transform.x) + " " + (-state.transform.y) + " " + (canvasWidth / state.transform.scale) + " " + (canvasHeight / state.transform.scale));
        svg.innerHTML = edgeMarkup + nodeMarkup;
        document.querySelectorAll("[data-node]").forEach((node) => {
          node.addEventListener("click", () => selectFile(node.dataset.node));
        });
      }

      function renderFiles() {
        $("visibleFiles").textContent = state.files.length + " shown";
        $("files").innerHTML = state.files.map((file) =>
          '<button class="file ' + (file.path === state.selected ? "active" : "") + '" data-file="' + escapeHtml(file.path) + '">' +
            '<span class="file-name">' + escapeHtml(file.path) + '</span>' +
            '<span class="file-meta">' + file.symbols.length + ' symbols · ' + file.imports.length + ' imports</span>' +
          '</button>'
        ).join("");
        document.querySelectorAll("[data-file]").forEach((button) => {
          button.addEventListener("click", () => selectFile(button.dataset.file));
        });
      }

      async function selectFile(file) {
        if (!file) return;
        state.selected = file;
        $("selectedFile").textContent = file;
        renderFiles();
        drawGraph();
        const data = await request("/api/impact?file=" + encodeURIComponent(file));
        $("details").textContent = JSON.stringify(data, null, 2);
      }

      async function loadIndex() {
        const data = await request("/api/index");
        state.files = data.files;
        state.graph = data.graph;
        $("fileCount").textContent = data.stats.fileCount;
        $("symbolCount").textContent = data.stats.symbolCount;
        $("edgeCount").textContent = data.stats.edgeCount;
        $("createdAt").textContent = "Indexed " + new Date(data.createdAt).toLocaleString() + " · SQLite";
        renderFiles();
        drawGraph();
      }

      async function runSearch() {
        const query = $("query").value.trim();
        if (!query) return;
        $("resultCount").textContent = "Searching";
        const data = await request("/api/search?q=" + encodeURIComponent(query));
        $("resultCount").textContent = data.results.length + " results";
        $("results").innerHTML = data.results.map((result) =>
          '<div class="result"><h3>' + escapeHtml(result.symbol.name) + '</h3><p><code>' +
          escapeHtml(result.symbol.file + ':' + result.symbol.startLine) + '</code> <span class="muted">' +
          escapeHtml(result.symbol.kind + ' · score ' + result.score) + '</span></p><p class="muted">' +
          escapeHtml(result.symbol.signature) + '</p></div>'
        ).join("") || '<div class="empty">No symbols found.</div>';
        const context = await request("/api/context?q=" + encodeURIComponent(query));
        $("details").textContent = context.context;
      }

      $("search").addEventListener("click", runSearch);
      $("query").addEventListener("keydown", (event) => {
        if (event.key === "Enter") runSearch();
      });
      $("sync").addEventListener("click", async () => {
        $("createdAt").textContent = "Syncing SQLite index...";
        await request("/api/sync", { method: "POST" });
        await loadIndex();
      });
      $("zoomIn").addEventListener("click", () => {
        state.transform.scale = Math.min(2.4, state.transform.scale * 1.18);
        drawGraph();
      });
      $("zoomOut").addEventListener("click", () => {
        state.transform.scale = Math.max(.55, state.transform.scale / 1.18);
        drawGraph();
      });
      $("resetView").addEventListener("click", () => {
        state.transform = { x: 0, y: 0, scale: 1 };
        drawGraph();
      });
      $("graph").addEventListener("wheel", (event) => {
        event.preventDefault();
        state.transform.scale = Math.max(.55, Math.min(2.4, state.transform.scale * (event.deltaY > 0 ? .92 : 1.08)));
        drawGraph();
      }, { passive: false });

      let dragStart = null;
      $("graph").addEventListener("pointerdown", (event) => {
        dragStart = { x: event.clientX, y: event.clientY, tx: state.transform.x, ty: state.transform.y };
        $("graph").setPointerCapture(event.pointerId);
      });
      $("graph").addEventListener("pointermove", (event) => {
        if (!dragStart) return;
        state.transform.x = dragStart.tx - (event.clientX - dragStart.x) / state.transform.scale;
        state.transform.y = dragStart.ty - (event.clientY - dragStart.y) / state.transform.scale;
        drawGraph();
      });
      $("graph").addEventListener("pointerup", () => { dragStart = null; });
      window.addEventListener("resize", drawGraph);
      loadIndex().catch((error) => {
        $("details").textContent = error.message;
      });
    </script>
  </body>
</html>`;

const route = async (
  request: IncomingMessage,
  response: ServerResponse,
  options: StudioServerOptions,
): Promise<void> => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (request.method === "GET" && url.pathname === "/") {
    html(response, renderStudioHtml());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/index") {
    const index = await loadIndex(options);
    json(response, { ...index, graph: graphPayload(index) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/search") {
    const index = await loadIndex(options);
    json(response, { results: searchIntelligence(index, url.searchParams.get("q") ?? "", 20) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/context") {
    const index = await loadIndex(options);
    const cwd = resolveCwd(options.cwd);
    const context = await buildAgentContext(cwd, index, url.searchParams.get("q") ?? "");
    json(response, { context });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/impact") {
    const index = await loadIndex(options);
    const file = url.searchParams.get("file") ?? "";
    json(response, {
      affected: file ? affectedFiles(index, [file]) : [],
      impact: impactForFile(index, file),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sync") {
    await readBody(request);
    const result = await syncIntelligenceIndex(options);
    json(response, {
      durationMs: result.durationMs,
      stats: result.index.stats,
      storage: result.storage,
    });
    return;
  }

  notFound(response);
};

export const startStudioServer = async (options: StudioServerOptions): Promise<StudioServer> => {
  await buildIntelligenceIndex(options);

  const server = createServer((request, response) => {
    route(request, response, options).catch((error: unknown) => {
      json(response, { error: error instanceof Error ? error.message : String(error) }, 500);
    });
  });

  const port = options.port ?? defaultPort;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  const url = `http://127.0.0.1:${actualPort}`;
  process.stdout.write(`\n  ${pc.bold("Ship Clean Studio")} ${pc.green(url)}\n\n`);

  return {
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
    port: actualPort,
    url,
  };
};
