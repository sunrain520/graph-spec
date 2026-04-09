const fs = require('node:fs');
const path = require('node:path');
const { renderReport } = require('./report');
const { toJSON: graphToJSON } = require('./graph');
const { toWiki } = require('./wiki');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function serializeNodes(graph) {
  return Array.from(graph.nodes.values()).map((node) => ({ ...node }));
}

function serializeEdges(graph) {
  return graph.edges.map((edge) => ({ ...edge }));
}

function toJSON(graph, communities, outputPath) {
  const payload = {
    ...graphToJSON(graph),
    communities: communities || {},
  };
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  return outputPath;
}

function toGraphML(graph, outputPath) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<graphml xmlns="http://graphml.graphdrawing.org/xmlns">');
  lines.push('<graph id="graph" edgedefault="undirected">');
  for (const node of serializeNodes(graph)) {
    lines.push(`  <node id="${escapeXml(node.id)}">`);
    lines.push(`    <data key="label">${escapeXml(node.label || node.id)}</data>`);
    lines.push(`    <data key="kind">${escapeXml(node.kind || '')}</data>`);
    lines.push('  </node>');
  }
  graph.edges.forEach((edge, index) => {
    lines.push(`  <edge id="e${index}" source="${escapeXml(edge.source)}" target="${escapeXml(edge.target)}">`);
    lines.push(`    <data key="relation">${escapeXml(edge.relation || '')}</data>`);
    lines.push(`    <data key="confidence">${escapeXml(edge.confidence || '')}</data>`);
    lines.push('  </edge>');
  });
  lines.push('</graph>');
  lines.push('</graphml>');
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  return outputPath;
}

function toCypher(graph, outputPath) {
  const lines = [];
  for (const node of serializeNodes(graph)) {
    lines.push(`MERGE (n:${cypherLabel(node.kind || 'Node')} {id: ${cypherString(node.id)}}) SET n.label = ${cypherString(node.label || node.id)};`);
  }
  graph.edges.forEach((edge) => {
    lines.push(
      `MATCH (a {id: ${cypherString(edge.source)}}), (b {id: ${cypherString(edge.target)}}) MERGE (a)-[:${cypherLabel(edge.relation || 'RELATED_TO')} {confidence: ${cypherString(edge.confidence || '')}}]->(b);`,
    );
  });
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  return outputPath;
}

function toSvg(graph, outputPath) {
  const nodes = serializeNodes(graph);
  const width = 1600;
  const height = 1200;
  const perRow = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const cellW = Math.floor(width / perRow);
  const cellH = Math.floor(height / perRow);
  const circles = nodes
    .map((node, index) => {
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const x = 80 + col * cellW;
      const y = 80 + row * cellH;
      return `<g><circle cx="${x}" cy="${y}" r="24" fill="#2d6cdf"/><text x="${x}" y="${y + 40}" text-anchor="middle" font-size="14" fill="#111">${escapeXml(shortLabel(node.label || node.id))}</text></g>`;
    })
    .join('\n');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n<rect width="100%" height="100%" fill="#f8fafc"/>\n${circles}\n</svg>`;
  fs.writeFileSync(outputPath, svg, 'utf8');
  return outputPath;
}

function toHtml(graph, communities, outputPath) {
  const nodes = serializeNodes(graph);
  const edges = serializeEdges(graph);
  const report = renderReport(graph, { communities });
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>graph-spec</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
    .wrap { display: grid; grid-template-columns: 360px 1fr; min-height: 100vh; }
    .panel { padding: 20px; border-right: 1px solid rgba(255,255,255,.08); overflow: auto; }
    .graph { padding: 20px; }
    input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,.12); background: #111827; color: #fff; }
    .item { padding: 10px 12px; margin-top: 8px; background: #111827; border-radius: 12px; cursor: pointer; }
    .item:hover { background: #1f2937; }
    pre { white-space: pre-wrap; background: #020617; padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,.08); }
  </style>
</head>
<body>
  <div class="wrap">
    <aside class="panel">
      <h1>graph-spec</h1>
      <input id="search" placeholder="搜索节点" />
      <div id="list"></div>
    </aside>
    <main class="graph">
      <pre id="detail">${escapeHtml(report)}</pre>
    </main>
  </div>
  <script>
    const NODES = ${JSON.stringify(nodes)};
    const EDGES = ${JSON.stringify(edges)};
    const list = document.getElementById('list');
    const search = document.getElementById('search');
    const detail = document.getElementById('detail');
    function render(filter='') {
      list.innerHTML = '';
      const items = NODES.filter(n => n.label.toLowerCase().includes(filter)).slice(0, 100);
      items.forEach(node => {
        const div = document.createElement('div');
        div.className = 'item';
        div.textContent = node.label + (node.community != null ? ' · C' + (node.community + 1) : '');
        div.onclick = () => {
          const incoming = EDGES.filter(e => e.target === node.id).length;
          const outgoing = EDGES.filter(e => e.source === node.id).length;
          detail.textContent = JSON.stringify({ node, incoming, outgoing }, null, 2);
        };
        list.appendChild(div);
      });
    }
    search.addEventListener('input', () => render(search.value.toLowerCase().trim()));
    render('');
  </script>
</body>
</html>`;
  fs.writeFileSync(outputPath, html, 'utf8');
  return outputPath;
}

function exportGraph(graph, outDir, communities = {}, options = {}) {
  ensureDir(outDir);
  const graphJson = path.join(outDir, 'graph.json');
  const reportPath = path.join(outDir, 'GRAPH_REPORT.md');
  const htmlPath = path.join(outDir, 'graph.html');
  const svgPath = path.join(outDir, 'graph.svg');
  const graphmlPath = path.join(outDir, 'graph.graphml');
  const cypherPath = path.join(outDir, 'cypher.txt');
  const wikiDir = path.join(outDir, 'wiki');

  toJSON(graph, communities, graphJson);
  fs.writeFileSync(reportPath, renderReport(graph, { communities }), 'utf8');
  toHtml(graph, communities, htmlPath);
  toSvg(graph, svgPath);
  toGraphML(graph, graphmlPath);
  toCypher(graph, cypherPath);
  const wiki = options.wiki ? toWiki(graph, communities, options.wikiDir || wikiDir, options.wikiOptions || {}) : null;

  return {
    graphJson,
    reportPath,
    htmlPath,
    svgPath,
    graphmlPath,
    cypherPath,
    wikiPath: wiki?.outputDir || null,
    wikiIndexPath: wiki?.indexPath || null,
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value) {
  return escapeXml(value);
}

function cypherString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function cypherLabel(value) {
  return String(value).replace(/[^A-Za-z0-9_]/g, '_') || 'Node';
}

function shortLabel(value) {
  const text = String(value);
  return text.length > 16 ? `${text.slice(0, 15)}…` : text;
}

module.exports = {
  cypherLabel,
  cypherString,
  escapeHtml,
  escapeXml,
  exportGraph,
  ensureDir,
  renderReport,
  serializeEdges,
  serializeNodes,
  toCypher,
  toGraphML,
  toHtml,
  toJSON,
  toSvg,
};
