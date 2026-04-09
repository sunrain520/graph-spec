const fs = require('node:fs');
const path = require('node:path');
const { degree, neighbors } = require('./graph');
const { godNodes } = require('./analyze');

function safeFilename(name) {
  return String(name).replace(/[\\/]/g, '-').replace(/\s+/g, '_').replace(/:/g, '-');
}

function collectCommunities(graph, communities = null) {
  if (communities && Object.keys(communities).length > 0) {
    return communities;
  }
  const grouped = {};
  for (const [nodeId, node] of graph.nodes.entries()) {
    if (node.community == null) continue;
    const cid = Number(node.community);
    if (!grouped[cid]) grouped[cid] = [];
    grouped[cid].push(nodeId);
  }
  for (const items of Object.values(grouped)) {
    items.sort();
  }
  return grouped;
}

function collectCommunityLabels(graph, communities, overrides = {}) {
  const labels = { ...overrides };
  for (const [cid, nodes] of Object.entries(communities)) {
    if (labels[cid]) continue;
    const sample = nodes.map((nodeId) => graph.nodes.get(nodeId)).find(Boolean);
    labels[cid] = sample?.community_name || `Community ${Number(cid) + 1}`;
  }
  return labels;
}

function crossCommunityLinks(graph, nodes, ownCid, labels) {
  const counts = new Map();
  for (const nodeId of nodes) {
    for (const neighbor of neighbors(graph, nodeId)) {
      const neighborNode = graph.nodes.get(neighbor);
      const cid = neighborNode?.community;
      if (cid == null || Number(cid) === Number(ownCid)) continue;
      const label = labels[cid] || `Community ${Number(cid) + 1}`;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function communityArticle(graph, cid, nodes, label, labels, cohesion) {
  const topNodes = nodes
    .slice()
    .sort((a, b) => degree(graph, b) - degree(graph, a) || a.localeCompare(b))
    .slice(0, 25);
  const cross = crossCommunityLinks(graph, nodes, cid, labels);

  const confCounts = new Map();
  for (const nodeId of nodes) {
    for (const neighbor of neighbors(graph, nodeId)) {
      const other = graph.nodes.get(neighbor);
      if (!other) continue;
      const edge = graph.edges.find(
        (item) =>
          (item.source === nodeId && item.target === neighbor) ||
          (item.source === neighbor && item.target === nodeId),
      );
      if (!edge) continue;
      const confidence = edge.confidence || 'EXTRACTED';
      confCounts.set(confidence, (confCounts.get(confidence) || 0) + 1);
    }
  }
  const totalEdges = Array.from(confCounts.values()).reduce((sum, value) => sum + value, 0) || 1;
  const sources = Array.from(
    new Set(nodes.map((nodeId) => graph.nodes.get(nodeId)?.source_file || '').filter(Boolean)),
  ).sort();

  const lines = [];
  lines.push(`# ${label}`);
  lines.push('');
  const metaParts = [`${nodes.length} nodes`];
  if (cohesion != null) metaParts.push(`cohesion ${Number(cohesion).toFixed(2)}`);
  lines.push(`> ${metaParts.join(' · ')}`);
  lines.push('');
  lines.push('## Key Concepts');
  lines.push('');
  for (const nodeId of topNodes) {
    const node = graph.nodes.get(nodeId);
    lines.push(`- **${node?.label || nodeId}** (${degree(graph, nodeId)} connections)${node?.source_file ? ` — \`${node.source_file}\`` : ''}`);
  }
  const remaining = nodes.length - topNodes.length;
  if (remaining > 0) {
    lines.push(`- *... and ${remaining} more nodes in this community*`);
  }
  lines.push('');
  lines.push('## Relationships');
  lines.push('');
  if (cross.length > 0) {
    for (const [otherLabel, count] of cross.slice(0, 12)) {
      lines.push(`- [[${otherLabel}]] (${count} shared connections)`);
    }
  } else {
    lines.push('- No strong cross-community connections detected');
  }
  lines.push('');
  if (sources.length > 0) {
    lines.push('## Source Files');
    lines.push('');
    for (const source of sources.slice(0, 20)) {
      lines.push(`- \`${source}\``);
    }
    lines.push('');
  }
  lines.push('## Audit Trail');
  lines.push('');
  for (const confidence of ['EXTRACTED', 'INFERRED', 'AMBIGUOUS']) {
    const count = confCounts.get(confidence) || 0;
    const percent = Math.round((count / totalEdges) * 100);
    lines.push(`- ${confidence}: ${count} (${percent}%)`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Part of the graph-spec knowledge wiki. See [[index]] to navigate.*');
  return lines.join('\n');
}

function godNodeArticle(graph, nodeId, labels) {
  const node = graph.nodes.get(nodeId);
  if (!node) return '';
  const communityId = node.community;
  const communityName = communityId != null ? labels[communityId] || `Community ${Number(communityId) + 1}` : null;
  const lines = [];
  lines.push(`# ${node.label || nodeId}`);
  lines.push('');
  lines.push(`> God node · ${degree(graph, nodeId)} connections · \`${node.source_file || ''}\``);
  lines.push('');
  if (communityName) {
    lines.push(`**Community:** [[${communityName}]]`);
    lines.push('');
  }
  const byRelation = new Map();
  for (const neighbor of neighbors(graph, nodeId)) {
    const other = graph.nodes.get(neighbor);
    if (!other) continue;
    const edge = graph.edges.find(
      (item) =>
        (item.source === nodeId && item.target === neighbor) ||
        (item.source === neighbor && item.target === nodeId),
    );
    const relation = edge?.relation || 'related';
    const confidence = edge?.confidence ? ` \`${edge.confidence}\`` : '';
    if (!byRelation.has(relation)) byRelation.set(relation, []);
    byRelation.get(relation).push(`[[${other.label || neighbor}]]${confidence}`);
  }
  lines.push('## Connections by Relation');
  lines.push('');
  for (const [relation, targets] of Array.from(byRelation.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`### ${relation}`);
    for (const target of targets.slice(0, 20)) {
      lines.push(`- ${target}`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('*Part of the graph-spec knowledge wiki. See [[index]] to navigate.*');
  return lines.join('\n');
}

function indexMarkdown(communities, labels, godNodesData, totalNodes, totalEdges) {
  const lines = [];
  lines.push('# Knowledge Graph Index');
  lines.push('');
  lines.push('> Auto-generated by graph-spec. Start here, read community articles for context, then drill into god nodes for detail.');
  lines.push('');
  lines.push(`**${totalNodes} nodes · ${totalEdges} edges · ${Object.keys(communities).length} communities**`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Communities');
  lines.push('(sorted by size, largest first)');
  lines.push('');
  for (const [cid, nodes] of Object.entries(communities).sort((a, b) => b[1].length - a[1].length)) {
    const label = labels[cid] || `Community ${Number(cid) + 1}`;
    lines.push(`- [[${label}]] — ${nodes.length} nodes`);
  }
  lines.push('');
  if (godNodesData.length > 0) {
    lines.push('## God Nodes');
    lines.push('(most connected concepts)');
    lines.push('');
    for (const node of godNodesData) {
      lines.push(`- [[${node.label}]] — ${node.edges} connections`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('*Generated by [graph-spec](https://www.npmjs.com/package/graph-spec)*');
  return lines.join('\n');
}

function toWiki(graph, communities = null, outputDir = path.join('.', 'wiki'), options = {}) {
  const resolvedCommunities = collectCommunities(graph, communities);
  const labels = collectCommunityLabels(graph, resolvedCommunities, options.communityLabels || {});
  const topGodNodes = options.godNodes || godNodes(graph, options.godNodeLimit || 20);
  const out = path.resolve(outputDir);
  fs.mkdirSync(out, { recursive: true });

  for (const [cid, nodes] of Object.entries(resolvedCommunities)) {
    const label = labels[cid] || `Community ${Number(cid) + 1}`;
    const article = communityArticle(graph, cid, nodes, label, labels, options.cohesion?.[cid]);
    fs.writeFileSync(path.join(out, `${safeFilename(label)}.md`), article, 'utf8');
  }

  for (const node of topGodNodes) {
    if (!graph.nodes.has(node.id)) continue;
    const article = godNodeArticle(graph, node.id, labels);
    fs.writeFileSync(path.join(out, `${safeFilename(node.label)}.md`), article, 'utf8');
  }

  const indexPath = path.join(out, 'index.md');
  fs.writeFileSync(indexPath, indexMarkdown(resolvedCommunities, labels, topGodNodes, graph.nodes.size, graph.edges.length), 'utf8');

  return {
    outputDir: out,
    indexPath,
    articleCount: Object.keys(resolvedCommunities).length + topGodNodes.length,
  };
}

module.exports = {
  collectCommunityLabels,
  collectCommunities,
  communityArticle,
  godNodeArticle,
  indexMarkdown,
  safeFilename,
  toWiki,
};
