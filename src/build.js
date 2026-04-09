const { createGraph, mergeNode, addEdge, addHyperedge, toJSON } = require('./graph');
const { validateExtraction } = require('./validate');

function buildFromJSON(extraction) {
  const errors = validateExtraction(extraction);
  if (errors.length > 0) {
    const realErrors = errors.filter((error) => !error.includes('does not match any node id'));
    if (realErrors.length > 0) {
      throw new Error(`Invalid extraction: ${realErrors[0]}`);
    }
  }

  const graph = createGraph();
  for (const node of extraction.nodes || []) {
    mergeNode(graph, node);
  }
  for (const edge of extraction.edges || []) {
    if (!graph.nodes.has(edge.source) || !graph.nodes.has(edge.target)) {
      continue;
    }
    addEdge(graph, edge);
  }
  for (const hyperedge of extraction.hyperedges || []) {
    addHyperedge(graph, hyperedge);
  }
  graph.meta = { ...(extraction.meta || {}) };
  return graph;
}

function build(extractions) {
  const graph = createGraph();
  const allExtractions = extractions || [];

  for (const extraction of allExtractions) {
    const errors = validateExtraction(extraction);
    const realErrors = errors.filter((error) => !error.includes('does not match any node id'));
    if (realErrors.length > 0) {
      throw new Error(`Invalid extraction: ${realErrors[0]}`);
    }
    for (const node of extraction.nodes || []) {
      mergeNode(graph, node);
    }
  }

  for (const extraction of allExtractions) {
    for (const edge of extraction.edges || []) {
      if (!graph.nodes.has(edge.source) || !graph.nodes.has(edge.target)) {
        continue;
      }
      addEdge(graph, edge);
    }
    for (const hyperedge of extraction.hyperedges || []) {
      addHyperedge(graph, hyperedge);
    }
  }
  return graph;
}

module.exports = {
  build,
  buildFromJSON,
  toJSON,
};
