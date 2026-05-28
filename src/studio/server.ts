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
  const nodes = index.files.map((file) => ({
    id: file.path,
    imports: file.imports.length,
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
        color-scheme: dark;
        --bg: #101114;
        --panel: #17191e;
        --panel-2: #20242b;
        --border: #303640;
        --text: #f3f5f7;
        --muted: #9da7b3;
        --accent: #66d9c7;
        --danger: #ff6b6b;
        --warn: #f8c555;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      button, input {
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--panel-2);
        color: var(--text);
        font: inherit;
      }

      button {
        cursor: pointer;
        padding: 9px 12px;
      }

      input {
        min-width: 260px;
        padding: 10px 12px;
      }

      .shell {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        min-height: 100vh;
      }

      aside {
        border-right: 1px solid var(--border);
        background: #14161a;
        padding: 18px;
      }

      main {
        display: grid;
        grid-template-rows: auto minmax(360px, 1fr) 280px;
        min-width: 0;
      }

      header {
        align-items: center;
        border-bottom: 1px solid var(--border);
        display: flex;
        gap: 12px;
        justify-content: space-between;
        padding: 14px 18px;
      }

      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 18px; letter-spacing: 0; }
      h2 { font-size: 13px; color: var(--muted); font-weight: 600; text-transform: uppercase; }
      h3 { font-size: 14px; }

      .stats {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(3, 1fr);
        margin: 16px 0;
      }

      .stat, .panel, .file {
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--panel);
      }

      .stat { padding: 10px; }
      .stat strong { display: block; font-size: 20px; }
      .stat span, .muted { color: var(--muted); }

      .files {
        display: grid;
        gap: 8px;
        margin-top: 12px;
        max-height: calc(100vh - 210px);
        overflow: auto;
      }

      .file {
        display: grid;
        gap: 4px;
        padding: 10px;
      }

      .file button {
        border: 0;
        background: transparent;
        color: var(--accent);
        padding: 0;
        text-align: left;
      }

      .map {
        height: 100%;
        min-height: 360px;
        position: relative;
      }

      svg {
        display: block;
        height: 100%;
        width: 100%;
      }

      .bottom {
        border-top: 1px solid var(--border);
        display: grid;
        gap: 12px;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        padding: 12px;
      }

      .panel {
        min-width: 0;
        overflow: auto;
        padding: 12px;
      }

      .result {
        border-bottom: 1px solid var(--border);
        padding: 8px 0;
      }

      .result:last-child { border-bottom: 0; }
      code { color: var(--accent); }
      pre { white-space: pre-wrap; word-break: break-word; }

      @media (max-width: 880px) {
        .shell { grid-template-columns: 1fr; }
        aside { border-right: 0; border-bottom: 1px solid var(--border); }
        main { grid-template-rows: auto 420px auto; }
        .bottom { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside>
        <h1>Ship Clean Studio</h1>
        <p class="muted">Local code map, impact, and agent context.</p>
        <div class="stats">
          <div class="stat"><strong id="fileCount">0</strong><span>files</span></div>
          <div class="stat"><strong id="symbolCount">0</strong><span>symbols</span></div>
          <div class="stat"><strong id="edgeCount">0</strong><span>imports</span></div>
        </div>
        <h2>Files</h2>
        <div class="files" id="files"></div>
      </aside>
      <main>
        <header>
          <div>
            <h1>Project Brain</h1>
            <p class="muted" id="createdAt">Loading index...</p>
          </div>
          <div>
            <input id="query" placeholder="Search symbols or ask for context" />
            <button id="search">Search</button>
            <button id="sync">Sync</button>
          </div>
        </header>
        <section class="map" aria-label="Import graph">
          <svg id="graph" role="img"></svg>
        </section>
        <section class="bottom">
          <div class="panel">
            <h2>Results</h2>
            <div id="results"></div>
          </div>
          <div class="panel">
            <h2>Impact / Context</h2>
            <pre id="details" class="muted">Select a file or search a task.</pre>
          </div>
        </section>
      </main>
    </div>
    <script>
      const state = { graph: { nodes: [], edges: [] }, files: [] };
      const $ = (id) => document.getElementById(id);

      async function request(path, options) {
        const response = await fetch(path, options);
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      }

      function drawGraph() {
        const svg = $("graph");
        const width = svg.clientWidth || 900;
        const height = svg.clientHeight || 500;
        const nodes = state.graph.nodes;
        const edges = state.graph.edges;
        const radius = Math.min(width, height) * 0.34;
        const cx = width / 2;
        const cy = height / 2;
        const positions = new Map();
        nodes.forEach((node, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1);
          positions.set(node.id, {
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
          });
        });
        const edgeMarkup = edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return "";
          return '<line x1="' + from.x + '" y1="' + from.y + '" x2="' + to.x + '" y2="' + to.y + '" stroke="#303640" stroke-width="1" />';
        }).join("");
        const nodeMarkup = nodes.map((node) => {
          const point = positions.get(node.id);
          const label = node.id.split("/").slice(-2).join("/");
          return '<g><circle cx="' + point.x + '" cy="' + point.y + '" r="7" fill="#66d9c7" />' +
            '<text x="' + (point.x + 10) + '" y="' + (point.y + 4) + '" fill="#f3f5f7" font-size="12">' +
            label.replaceAll("&", "&amp;").replaceAll("<", "&lt;") + '</text></g>';
        }).join("");
        svg.setAttribute("viewBox", "0 0 " + width + " " + height);
        svg.innerHTML = edgeMarkup + nodeMarkup;
      }

      function renderFiles() {
        $("files").innerHTML = state.files.map((file) =>
          '<div class="file"><button data-file="' + file.path + '">' + file.path +
          '</button><span class="muted">' + file.symbols.length + ' symbols · ' +
          file.imports.length + ' imports</span></div>'
        ).join("");
        document.querySelectorAll("[data-file]").forEach((button) => {
          button.addEventListener("click", () => loadImpact(button.dataset.file));
        });
      }

      async function loadIndex() {
        const data = await request("/api/index");
        state.files = data.files;
        state.graph = data.graph;
        $("fileCount").textContent = data.stats.fileCount;
        $("symbolCount").textContent = data.stats.symbolCount;
        $("edgeCount").textContent = data.stats.edgeCount;
        $("createdAt").textContent = "Indexed " + new Date(data.createdAt).toLocaleString();
        renderFiles();
        drawGraph();
      }

      async function runSearch() {
        const query = $("query").value.trim();
        if (!query) return;
        const data = await request("/api/search?q=" + encodeURIComponent(query));
        $("results").innerHTML = data.results.map((result) =>
          '<div class="result"><h3>' + result.symbol.name + '</h3><p><code>' +
          result.symbol.file + ':' + result.symbol.startLine + '</code> <span class="muted">' +
          result.symbol.kind + ' · score ' + result.score + '</span></p><p class="muted">' +
          result.symbol.signature.replaceAll("<", "&lt;") + '</p></div>'
        ).join("") || '<p class="muted">No symbols found.</p>';
        const context = await request("/api/context?q=" + encodeURIComponent(query));
        $("details").textContent = context.context;
      }

      async function loadImpact(file) {
        const data = await request("/api/impact?file=" + encodeURIComponent(file));
        $("details").textContent = JSON.stringify(data, null, 2);
      }

      $("search").addEventListener("click", runSearch);
      $("query").addEventListener("keydown", (event) => {
        if (event.key === "Enter") runSearch();
      });
      $("sync").addEventListener("click", async () => {
        $("createdAt").textContent = "Syncing...";
        await request("/api/sync", { method: "POST" });
        await loadIndex();
      });
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
