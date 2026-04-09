const path = require('node:path');
const { degree } = require('./graph');
const { cohesionScore } = require('./cluster');

function nodeCommunityMap(communities) {
  const map = {};
  for (const [cid, nodes] of Object.entries(communities || {})) {
    for (const nodeId of nodes) {
      map[nodeId] = Number(cid);
    }
  }
  return map;
}

function isFileNode(graph, nodeId) {
  const node = graph.nodes.get(nodeId);
  if (!node) return false;
  if (node.kind === 'file') return true;
  if (node.source_file && node.label === path.basename(node.source_file)) return true;
  return false;
}

function isStructuralNode(graph, nodeId) {
  const node = graph.nodes.get(nodeId);
  if (!node) return true;
  return ['file', 'section', 'rationale', 'import'].includes(node.kind);
}

function godNodes(graph, topN = 10) {
  const ranked = Array.from(graph.nodes.keys())
    .filter((nodeId) => !isFileNode(graph, nodeId) && !isStructuralNode(graph, nodeId))
    .map((nodeId) => ({
      id: nodeId,
      label: graph.nodes.get(nodeId).label || nodeId,
      edges: degree(graph, nodeId),
      kind: graph.nodes.get(nodeId).kind,
      source_file: graph.nodes.get(nodeId).source_file,
      community: graph.nodes.get(nodeId).community,
    }))
    .sort((a, b) => b.edges - a.edges || a.label.localeCompare(b.label));
  return ranked.slice(0, topN);
}

function confidenceWeight(confidence) {
  if (confidence === 'AMBIGUOUS') return 3;
  if (confidence === 'INFERRED') return 2;
  return 1;
}

function surprisingConnections(graph, communities = null, topN = 5) {
  const communityMap = communities ? nodeCommunityMap(communities) : null;
  const sourceFiles = new Set(
    Array.from(graph.nodes.values())
      .map((node) => node.source_file)
      .filter(Boolean),
  );
  const connections = [];

  for (const edge of graph.edges) {
    const source = graph.nodes.get(edge.source);
    const target = graph.nodes.get(edge.target);
    if (!source || !target) continue;
    if (isStructuralNode(graph, edge.source) || isStructuralNode(graph, edge.target)) continue;
    const sourceCommunity = communityMap ? communityMap[edge.source] : source.community;
    const targetCommunity = communityMap ? communityMap[edge.target] : target.community;
    const crossCommunity = sourceCommunity != null && targetCommunity != null && sourceCommunity !== targetCommunity;
    const crossFile = source.source_file && target.source_file && source.source_file !== target.source_file;
    if (!crossCommunity && !crossFile) continue;
    connections.push({
      source: edge.source,
      source_label: source.label,
      target: edge.target,
      target_label: target.label,
      relation: edge.relation,
      confidence: edge.confidence || 'EXTRACTED',
      source_file: source.source_file,
      target_file: target.source_file,
      why: crossCommunity
        ? '跨社区连接'
        : sourceFiles.size > 1
          ? '跨文件连接'
          : '图中不明显的连接',
      score: confidenceWeight(edge.confidence) + (crossCommunity ? 2 : 0) + (crossFile ? 1 : 0),
    });
  }

  return connections
    .sort((a, b) => b.score - a.score || a.source_label.localeCompare(b.source_label))
    .slice(0, topN);
}

function suggestQuestions(graph, communities = null, topN = 5) {
  const gods = godNodes(graph, 5);
  const bridges = surprisingConnections(graph, communities, 5);
  const questions = [];
  for (const god of gods.slice(0, 3)) {
    questions.push(`这个仓库里 ${god.label} 和哪些模块关系最强？`);
  }
  for (const bridge of bridges.slice(0, 2)) {
    questions.push(`为什么 ${bridge.source_label} 会连接到 ${bridge.target_label}？`);
  }
  while (questions.length < topN) {
    questions.push('这个知识图里最值得继续追问的结构是什么？');
  }
  return questions.slice(0, topN);
}

function graphDiff(oldGraph, newGraph) {
  const oldNodes = new Set(oldGraph.nodes.keys());
  const newNodes = new Set(newGraph.nodes.keys());
  const oldEdges = new Set(oldGraph.edges.map((edge) => `${edge.source}->${edge.target}:${edge.relation}`));
  const newEdges = new Set(newGraph.edges.map((edge) => `${edge.source}->${edge.target}:${edge.relation}`));

  return {
    added_nodes: Array.from(newNodes).filter((id) => !oldNodes.has(id)),
    removed_nodes: Array.from(oldNodes).filter((id) => !newNodes.has(id)),
    added_edges: Array.from(newEdges).filter((id) => !oldEdges.has(id)),
    removed_edges: Array.from(oldEdges).filter((id) => !newEdges.has(id)),
  };
}

module.exports = {
  confidenceWeight,
  godNodes,
  graphDiff,
  isFileNode,
  nodeCommunityMap,
  surprisingConnections,
  suggestQuestions,
};

