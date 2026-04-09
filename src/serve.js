const fs = require('node:fs');
const path = require('node:path');
const { fromJSON, degree, neighbors } = require('./graph');
const { sanitizeLabel } = require('./security');

function loadGraph(graphPath) {
  const json = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  return fromJSON(json);
}

function scoreNodes(graph, terms) {
  const scored = [];
  for (const [nodeId, node] of graph.nodes.entries()) {
    const label = String(node.label || '').toLowerCase();
    const source = String(node.source_file || '').toLowerCase();
    const score = terms.reduce((sum, term) => {
      if (label.includes(term)) return sum + 1;
      if (source.includes(term)) return sum + 0.5;
      return sum;
    }, 0);
    if (score > 0) {
      scored.push([score, nodeId]);
    }
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]));
}

function bfs(graph, startNodes, depth) {
  const visited = new Set(startNodes);
  const frontier = [...startNodes];
  const edges = [];
  for (let i = 0; i < depth; i += 1) {
    const next = [];
    for (const nodeId of frontier) {
      for (const neighbor of neighbors(graph, nodeId)) {
        edges.push([nodeId, neighbor]);
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier.splice(0, frontier.length, ...next);
    if (frontier.length === 0) break;
  }
  return { nodes: visited, edges };
}

function dfs(graph, startNodes, depth) {
  const visited = new Set();
  const stack = startNodes.slice().reverse().map((nodeId) => [nodeId, 0]);
  const edges = [];
  while (stack.length > 0) {
    const [nodeId, currentDepth] = stack.pop();
    if (visited.has(nodeId) || currentDepth > depth) continue;
    visited.add(nodeId);
    for (const neighbor of neighbors(graph, nodeId)) {
      edges.push([nodeId, neighbor]);
      if (!visited.has(neighbor)) {
        stack.push([neighbor, currentDepth + 1]);
      }
    }
  }
  return { nodes: visited, edges };
}

function subgraphToText(graph, nodeIds, edges, tokenBudget = 2000) {
  const limit = tokenBudget * 3;
  const lines = [];
  const sorted = Array.from(nodeIds).sort((a, b) => degree(graph, b) - degree(graph, a));
  for (const nodeId of sorted) {
    const node = graph.nodes.get(nodeId);
    lines.push(
      `NODE ${sanitizeLabel(node.label || nodeId)} [src=${node.source_file || ''} loc=${node.source_location || ''} community=${node.community ?? ''}]`,
    );
  }
  for (const [source, target] of edges) {
    const edge = graph.edges.find((item) => item.source === source && item.target === target) || graph.edges.find((item) => item.source === target && item.target === source);
    if (!edge) continue;
    lines.push(`EDGE ${sanitizeLabel(graph.nodes.get(source)?.label || source)} --${edge.relation || ''} [${edge.confidence || ''}]--> ${sanitizeLabel(graph.nodes.get(target)?.label || target)}`);
  }
  const text = lines.join('\n');
  return text.length > limit ? `${text.slice(0, limit)}\n... (truncated to ~${tokenBudget} token budget)` : text;
}

function shortestPath(graph, source, target, maxHops = 8) {
  const queue = [[source, [source]]];
  const visited = new Set([source]);
  while (queue.length > 0) {
    const [nodeId, trail] = queue.shift();
    if (trail.length > maxHops + 1) continue;
    if (nodeId === target) return trail;
    for (const neighbor of neighbors(graph, nodeId)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, trail.concat(neighbor)]);
      }
    }
  }
  return null;
}

function graphStats(graph) {
  const communities = new Set();
  for (const node of graph.nodes.values()) {
    if (node.community != null) communities.add(node.community);
  }
  const confidence = { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 };
  for (const edge of graph.edges) {
    if (confidence[edge.confidence] == null) confidence[edge.confidence] = 0;
    confidence[edge.confidence] += 1;
  }
  return {
    nodes: graph.nodes.size,
    edges: graph.edges.length,
    communities: communities.size,
    confidence,
  };
}

function getNode(graph, label) {
  const term = String(label).toLowerCase();
  for (const [nodeId, node] of graph.nodes.entries()) {
    if (nodeId.toLowerCase() === term || String(node.label || '').toLowerCase().includes(term)) {
      return {
        id: nodeId,
        label: node.label || nodeId,
        source_file: node.source_file || '',
        source_location: node.source_location || '',
        file_type: node.file_type || '',
        community: node.community ?? null,
        degree: degree(graph, nodeId),
      };
    }
  }
  return null;
}

function getNeighbors(graph, label, relationFilter = null) {
  const node = getNode(graph, label);
  if (!node) return [];
  const nodeId = node.id;
  const results = [];
  for (const edge of graph.edges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue;
    if (relationFilter && edge.relation !== relationFilter) continue;
    const otherId = edge.source === nodeId ? edge.target : edge.source;
    const other = graph.nodes.get(otherId);
    results.push({
      id: otherId,
      label: other?.label || otherId,
      relation: edge.relation || '',
      confidence: edge.confidence || '',
      source_file: other?.source_file || '',
    });
  }
  return results;
}

function getCommunity(graph, communityId) {
  return Array.from(graph.nodes.entries())
    .filter(([, node]) => node.community === communityId)
    .map(([id, node]) => ({ id, label: node.label || id }));
}

function queryGraph(graph, question, { mode = 'bfs', depth = 2, tokenBudget = 2000 } = {}) {
  const terms = String(question)
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);
  const scored = scoreNodes(graph, terms);
  const starts = scored.slice(0, 5).map(([, nodeId]) => nodeId);
  if (starts.length === 0) return 'No matching nodes found.';
  const traversal = mode === 'dfs' ? dfs(graph, starts, depth) : bfs(graph, starts, depth);
  const header = `Traversal: ${String(mode).toUpperCase()} depth=${depth} | Start: ${starts.map((id) => graph.nodes.get(id)?.label || id).join(', ')} | ${traversal.nodes.size} nodes found\n\n`;
  return header + subgraphToText(graph, traversal.nodes, traversal.edges, tokenBudget);
}

function serve(graphPath = path.resolve('graphify-out/graph.json')) {
  const graph = loadGraph(graphPath);
  process.stdout.write(`Loaded graph with ${graph.nodes.size} nodes\n`);
  return graph;
}

module.exports = {
  bfs,
  dfs,
  getCommunity,
  getNeighbors,
  getNode,
  graphStats,
  loadGraph,
  queryGraph,
  serve,
  shortestPath,
  scoreNodes,
  subgraphToText,
};

