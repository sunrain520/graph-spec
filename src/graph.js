function createGraph() {
  return {
    nodes: new Map(),
    edges: [],
    hyperedges: [],
    adjacency: new Map(),
    degrees: new Map(),
    meta: {},
  };
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function mergeNode(graph, node) {
  const existing = graph.nodes.get(node.id);
  const merged = existing ? { ...existing, ...clone(node), id: node.id } : { ...clone(node), id: node.id };
  graph.nodes.set(node.id, merged);
  if (!graph.adjacency.has(node.id)) {
    graph.adjacency.set(node.id, new Set());
  }
  if (!graph.degrees.has(node.id)) {
    graph.degrees.set(node.id, 0);
  }
  return merged;
}

function addEdge(graph, edge) {
  const normalized = {
    ...clone(edge),
    source: edge.source,
    target: edge.target,
    _src: edge.source,
    _tgt: edge.target,
  };
  graph.edges.push(normalized);
  if (!graph.adjacency.has(edge.source)) {
    graph.adjacency.set(edge.source, new Set());
  }
  if (!graph.adjacency.has(edge.target)) {
    graph.adjacency.set(edge.target, new Set());
  }
  graph.adjacency.get(edge.source).add(edge.target);
  graph.adjacency.get(edge.target).add(edge.source);
  graph.degrees.set(edge.source, (graph.degrees.get(edge.source) || 0) + 1);
  if (edge.target !== edge.source) {
    graph.degrees.set(edge.target, (graph.degrees.get(edge.target) || 0) + 1);
  }
  return normalized;
}

function addHyperedge(graph, hyperedge) {
  graph.hyperedges.push(clone(hyperedge));
}

function neighbors(graph, nodeId) {
  return Array.from(graph.adjacency.get(nodeId) || []);
}

function degree(graph, nodeId) {
  return graph.degrees.get(nodeId) || 0;
}

function toJSON(graph) {
  return {
    nodes: Array.from(graph.nodes.values()),
    edges: graph.edges.map(clone),
    hyperedges: graph.hyperedges.map(clone),
    meta: clone(graph.meta) || {},
  };
}

function fromJSON(data) {
  const graph = createGraph();
  for (const node of data.nodes || []) {
    mergeNode(graph, node);
  }
  for (const edge of data.edges || []) {
    addEdge(graph, edge);
  }
  for (const hyperedge of data.hyperedges || []) {
    addHyperedge(graph, hyperedge);
  }
  graph.meta = clone(data.meta) || {};
  return graph;
}

module.exports = {
  addEdge,
  addHyperedge,
  degree,
  fromJSON,
  createGraph,
  mergeNode,
  neighbors,
  toJSON,
};

