const Graph = require('graphology');
const louvain = require('graphology-communities-louvain');
const { degree } = require('./graph');

const MAX_COMMUNITY_FRACTION = 0.25;
const MIN_SPLIT_SIZE = 10;

function toGraphology(graph, nodeIds = null) {
  const g = new Graph({ type: 'undirected', multi: true });
  const allowed = nodeIds ? new Set(nodeIds) : null;
  for (const [id, node] of graph.nodes.entries()) {
    if (allowed && !allowed.has(id)) continue;
    g.addNode(id, { ...node });
  }
  graph.edges.forEach((edge, index) => {
    if (allowed && (!allowed.has(edge.source) || !allowed.has(edge.target))) {
      return;
    }
    const key = `e${index}`;
    if (!g.hasNode(edge.source)) g.addNode(edge.source, { ...(graph.nodes.get(edge.source) || {}) });
    if (!g.hasNode(edge.target)) g.addNode(edge.target, { ...(graph.nodes.get(edge.target) || {}) });
    if (!g.hasEdge(key)) {
      g.addEdgeWithKey(key, edge.source, edge.target, { ...edge });
    }
  });
  return g;
}

function _splitCommunity(graph, nodes) {
  const sub = toGraphology(graph, nodes);
  if (sub.order <= 1 || sub.size === 0) {
    return [nodes.slice().sort()];
  }
  louvain.assign(sub);
  const grouped = new Map();
  sub.forEachNode((nodeId, attrs) => {
    const cid = attrs.community ?? 0;
    if (!grouped.has(cid)) grouped.set(cid, []);
    grouped.get(cid).push(nodeId);
  });
  if (grouped.size <= 1) {
    return [nodes.slice().sort()];
  }
  return Array.from(grouped.values()).map((items) => items.sort());
}

function cluster(graph) {
  const nodeIds = Array.from(graph.nodes.keys());
  if (nodeIds.length === 0) {
    return {};
  }
  if (graph.edges.length === 0) {
    const communities = {};
    nodeIds.sort().forEach((nodeId, index) => {
      communities[index] = [nodeId];
      const node = graph.nodes.get(nodeId);
      node.community = index;
      node.community_name = `Community ${index + 1}`;
    });
    return communities;
  }

  const isolates = nodeIds.filter((nodeId) => degree(graph, nodeId) === 0);
  const connected = nodeIds.filter((nodeId) => degree(graph, nodeId) > 0);
  const connectedGraph = toGraphology(graph, connected);
  louvain.assign(connectedGraph);

  const raw = new Map();
  connectedGraph.forEachNode((nodeId, attrs) => {
    const cid = attrs.community ?? 0;
    if (!raw.has(cid)) raw.set(cid, []);
    raw.get(cid).push(nodeId);
  });

  let nextCid = Math.max(...Array.from(raw.keys(), (value) => Number(value)), -1) + 1;
  for (const nodeId of isolates) {
    raw.set(nextCid, [nodeId]);
    nextCid += 1;
  }

  const maxSize = Math.max(MIN_SPLIT_SIZE, Math.floor(nodeIds.length * MAX_COMMUNITY_FRACTION));
  const finalCommunities = [];
  for (const items of raw.values()) {
    if (items.length > maxSize) {
      finalCommunities.push(..._splitCommunity(graph, items));
    } else {
      finalCommunities.push(items.slice().sort());
    }
  }

  finalCommunities.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  const result = {};
  finalCommunities.forEach((items, cid) => {
    result[cid] = items;
    for (const nodeId of items) {
      const node = graph.nodes.get(nodeId);
      if (node) {
        node.community = cid;
        node.community_name = `Community ${cid + 1}`;
      }
    }
  });
  return result;
}

function cohesionScore(graph, communityNodes) {
  const items = communityNodes.slice();
  if (items.length <= 1) return 1;
  const set = new Set(items);
  let actual = 0;
  for (const edge of graph.edges) {
    if (set.has(edge.source) && set.has(edge.target)) actual += 1;
  }
  const possible = items.length * (items.length - 1) / 2;
  return possible > 0 ? Number((actual / possible).toFixed(2)) : 0;
}

function scoreAll(graph, communities) {
  const scores = {};
  for (const [cid, nodes] of Object.entries(communities || {})) {
    scores[cid] = cohesionScore(graph, nodes);
  }
  return scores;
}

module.exports = {
  MAX_COMMUNITY_FRACTION,
  MIN_SPLIT_SIZE,
  cohesionScore,
  cluster,
  scoreAll,
  toGraphology,
};

