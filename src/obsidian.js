const fs = require('node:fs');
const path = require('node:path');
const { degree, neighbors } = require('./graph');

const COMMUNITY_COLORS = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
];

function safeName(label) {
  return String(label || 'unnamed').replace(/[\\/*?:"<>|#^[\]]/g, '').trim().replace(/\s+/g, '_') || 'unnamed';
}

function nodeCommunityMap(communities = {}) {
  const map = {};
  for (const [cid, members] of Object.entries(communities)) {
    for (const nodeId of members) {
      map[nodeId] = Number(cid);
    }
  }
  return map;
}

function nodeFilenameMap(graph) {
  const filenames = {};
  const seen = new Map();
  for (const [nodeId, data] of graph.nodes.entries()) {
    const base = safeName(data.label || nodeId);
    const count = seen.get(base) || 0;
    filenames[nodeId] = count === 0 ? base : `${base}_${count}`;
    seen.set(base, count + 1);
  }
  return filenames;
}

function dominantConfidence(graph, nodeId) {
  const counts = new Map();
  for (const edge of graph.edges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue;
    const confidence = edge.confidence || 'EXTRACTED';
    counts.set(confidence, (counts.get(confidence) || 0) + 1);
  }
  let best = 'EXTRACTED';
  let bestCount = -1;
  for (const [confidence, count] of counts.entries()) {
    if (count > bestCount) {
      best = confidence;
      bestCount = count;
    }
  }
  return best;
}

function interCommunityEdges(graph, communities, communityMap) {
  const counts = {};
  for (const cid of Object.keys(communities)) {
    counts[cid] = {};
  }
  for (const edge of graph.edges) {
    const left = communityMap[edge.source];
    const right = communityMap[edge.target];
    if (left == null || right == null || left === right) continue;
    counts[left][right] = (counts[left][right] || 0) + 1;
    counts[right][left] = (counts[right][left] || 0) + 1;
  }
  return counts;
}

function communityReach(graph, nodeId, communityMap) {
  const current = communityMap[nodeId];
  const reach = new Set();
  for (const neighbor of neighbors(graph, nodeId)) {
    const cid = communityMap[neighbor];
    if (cid != null && cid !== current) {
      reach.add(cid);
    }
  }
  return reach.size;
}

function communityNote(graph, communityId, members, labels, cohesion, filenames, communityMap, crossEdges) {
  const label = labels[communityId] || `Community ${Number(communityId) + 1}`;
  const lines = ['---', 'type: community'];
  if (cohesion != null) lines.push(`cohesion: ${Number(cohesion).toFixed(2)}`);
  lines.push(`members: ${members.length}`);
  lines.push('---', '', `# ${label}`, '');
  if (cohesion != null) {
    const rating = cohesion >= 0.7 ? 'tightly connected' : cohesion >= 0.4 ? 'moderately connected' : 'loosely connected';
    lines.push(`**Cohesion:** ${Number(cohesion).toFixed(2)} - ${rating}`);
  }
  lines.push(`**Members:** ${members.length} nodes`, '', '## Members');
  for (const nodeId of [...members].sort((a, b) => (graph.nodes.get(a)?.label || a).localeCompare(graph.nodes.get(b)?.label || b))) {
    const node = graph.nodes.get(nodeId);
    lines.push(`- [[${filenames[nodeId]}]]${node?.file_type ? ` - ${node.file_type}` : ''}${node?.source_file ? ` - ${node.source_file}` : ''}`);
  }
  lines.push('', '## Live Query (requires Dataview plugin)', '', '```dataview', `TABLE source_file, type FROM #community/${safeName(label)}`, 'SORT file.name ASC', '```', '');
  const cross = crossEdges[communityId] || {};
  const crossList = Object.entries(cross).sort((a, b) => b[1] - a[1]);
  if (crossList.length > 0) {
    lines.push('## Connections to other communities');
    for (const [otherCid, edgeCount] of crossList) {
      const otherLabel = labels[otherCid] || `Community ${Number(otherCid) + 1}`;
      lines.push(`- ${edgeCount} edge${edgeCount === 1 ? '' : 's'} to [[_COMMUNITY_${safeName(otherLabel)}]]`);
    }
    lines.push('');
  }
  const bridges = members
    .map((nodeId) => ({ nodeId, degree: degree(graph, nodeId), reach: communityReach(graph, nodeId, communityMap) }))
    .filter((item) => item.reach > 0)
    .sort((a, b) => b.reach - a.reach || b.degree - a.degree)
    .slice(0, 5);
  if (bridges.length > 0) {
    lines.push('## Top bridge nodes');
    for (const bridge of bridges) {
      lines.push(`- [[${filenames[bridge.nodeId]}]] - degree ${bridge.degree}, connects to ${bridge.reach} ${bridge.reach === 1 ? 'community' : 'communities'}`);
    }
    lines.push('');
  }
  lines.push('---', '', '*Part of the graph-spec knowledge wiki. See [[index]] to navigate.*');
  return lines.join('\n');
}

function nodeNote(graph, nodeId, communityMap, labels, filenames) {
  const node = graph.nodes.get(nodeId);
  const communityId = communityMap[nodeId];
  const communityLabel = communityId != null ? labels[communityId] || `Community ${Number(communityId) + 1}` : null;
  const confidence = dominantConfidence(graph, nodeId);
  const tagType = node?.file_type || 'document';
  const tags = [
    `graphify/${tagType}`,
    `graphify/${confidence}`,
    communityLabel ? `community/${safeName(communityLabel)}` : null,
  ].filter(Boolean);

  const lines = [
    '---',
    `source_file: "${String(node?.source_file || '').replace(/"/g, '\\"')}"`,
    `type: "${String(node?.file_type || '')}"`,
    `community: "${String(communityLabel || '')}"`,
  ];
  if (node?.source_location) {
    lines.push(`location: "${String(node.source_location).replace(/"/g, '\\"')}"`);
  }
  lines.push('tags:');
  for (const tag of tags) {
    lines.push(`  - ${tag}`);
  }
  lines.push('---', '', `# ${node?.label || nodeId}`, '');
  const relationGroups = {};
  for (const neighbor of neighbors(graph, nodeId)) {
    const edge = graph.edges.find(
      (item) =>
        (item.source === nodeId && item.target === neighbor) ||
        (item.source === neighbor && item.target === nodeId),
    );
    const relation = edge?.relation || 'related';
    const neighborLabel = filenames[neighbor];
    const relLine = `- [[${neighborLabel}]] - \`${relation}\` [${edge?.confidence || 'EXTRACTED'}]`;
    if (!relationGroups[relation]) relationGroups[relation] = [];
    relationGroups[relation].push(relLine);
  }
  if (Object.keys(relationGroups).length > 0) {
    lines.push('## Connections');
    for (const relation of Object.keys(relationGroups).sort()) {
      lines.push(...relationGroups[relation]);
    }
    lines.push('');
  }
  lines.push(tags.map((tag) => `#${tag}`).join(' '));
  return lines.join('\n');
}

function toCanvas(graph, communities, outputPath, options = {}) {
  const filenames = options.nodeFilenames || nodeFilenameMap(graph);
  const communityMap = options.communityMap || nodeCommunityMap(communities);
  const labels = options.communityLabels || {};
  const members = Object.values(communities).flat();
  const canvasNodes = [];
  const canvasEdges = [];
  const sortedCids = Object.keys(communities).map(Number).sort((a, b) => a - b);
  const cols = Math.max(1, Math.ceil(Math.sqrt(sortedCids.length)));
  const gap = 80;
  const groupSizes = {};

  for (const cid of sortedCids) {
    const count = communities[cid].length;
    const width = Math.max(600, 220 * Math.ceil(Math.sqrt(count || 1)));
    const height = Math.max(400, 100 * Math.ceil((count || 1) / 3) + 120);
    groupSizes[cid] = { width, height };
  }

  const colWidths = Array.from({ length: cols }, (_, colIdx) => {
    let maxWidth = 0;
    for (let index = colIdx; index < sortedCids.length; index += cols) {
      const cid = sortedCids[index];
      maxWidth = Math.max(maxWidth, groupSizes[cid].width);
    }
    return maxWidth;
  });

  const rows = Math.max(1, Math.ceil(sortedCids.length / cols));
  const rowHeights = Array.from({ length: rows }, (_, rowIdx) => {
    let maxHeight = 0;
    for (let colIdx = 0; colIdx < cols; colIdx += 1) {
      const index = rowIdx * cols + colIdx;
      if (index < sortedCids.length) {
        const cid = sortedCids[index];
        maxHeight = Math.max(maxHeight, groupSizes[cid].height);
      }
    }
    return maxHeight;
  });

  const groupLayout = {};
  sortedCids.forEach((cid, index) => {
    const colIdx = index % cols;
    const rowIdx = Math.floor(index / cols);
    const x = colWidths.slice(0, colIdx).reduce((sum, value) => sum + value, 0) + colIdx * gap;
    const y = rowHeights.slice(0, rowIdx).reduce((sum, value) => sum + value, 0) + rowIdx * gap;
    groupLayout[cid] = { x, y, ...groupSizes[cid] };
  });

  const canvasNodeIds = new Set();
  for (const cid of sortedCids) {
    const label = labels[cid] || `Community ${Number(cid) + 1}`;
    const { x, y, width, height } = groupLayout[cid];
    canvasNodes.push({
      id: `g${cid}`,
      type: 'group',
      label,
      x,
      y,
      width,
      height,
      color: String((cid % COMMUNITY_COLORS.length) + 1),
    });
    const sortedMembers = [...communities[cid]].sort((a, b) => (graph.nodes.get(a)?.label || a).localeCompare(graph.nodes.get(b)?.label || b));
    sortedMembers.forEach((nodeId, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      canvasNodes.push({
        id: `n_${nodeId}`,
        type: 'file',
        file: `graphify/obsidian/${filenames[nodeId]}.md`,
        x: x + 20 + col * 200,
        y: y + 80 + row * 80,
        width: 180,
        height: 60,
      });
      canvasNodeIds.add(nodeId);
    });
  }

  for (const edge of graph.edges) {
    if (!canvasNodeIds.has(edge.source) || !canvasNodeIds.has(edge.target)) continue;
    canvasEdges.push({
      id: `e_${edge.source}_${edge.target}`,
      fromNode: `n_${edge.source}`,
      toNode: `n_${edge.target}`,
      label: edge.relation ? `${edge.relation} [${edge.confidence || 'EXTRACTED'}]` : `[${edge.confidence || 'EXTRACTED'}]`,
    });
  }

  fs.writeFileSync(outputPath, JSON.stringify({ nodes: canvasNodes, edges: canvasEdges }, null, 2), 'utf8');
  return outputPath;
}

function toObsidian(graph, communities, outputDir, options = {}) {
  const out = path.resolve(outputDir);
  fs.mkdirSync(out, { recursive: true });
  const communityMap = options.communityMap || nodeCommunityMap(communities);
  const labels = options.communityLabels || {};
  const cohesion = options.cohesion || {};
  const filenames = options.nodeFilenames || nodeFilenameMap(graph);
  const crossEdges = interCommunityEdges(graph, communities, communityMap);

  let noteCount = 0;

  for (const nodeId of graph.nodes.keys()) {
    const content = nodeNote(graph, nodeId, communityMap, labels, filenames);
    fs.writeFileSync(path.join(out, `${filenames[nodeId]}.md`), content, 'utf8');
    noteCount += 1;
  }

  for (const cid of Object.keys(communities)) {
    const content = communityNote(graph, cid, communities[cid], labels, cohesion[cid], filenames, communityMap, crossEdges);
    fs.writeFileSync(path.join(out, `_COMMUNITY_${safeName(labels[cid] || `Community ${Number(cid) + 1}`)}.md`), content, 'utf8');
    noteCount += 1;
  }

  const obsidianDir = path.join(out, '.obsidian');
  fs.mkdirSync(obsidianDir, { recursive: true });
  const graphJson = {
    colorGroups: Object.entries(labels).map(([cid, label]) => ({
      query: `tag:#community/${safeName(label)}`,
      color: { a: 1, rgb: parseInt(COMMUNITY_COLORS[Number(cid) % COMMUNITY_COLORS.length].slice(1), 16) },
    })),
  };
  fs.writeFileSync(path.join(obsidianDir, 'graph.json'), JSON.stringify(graphJson, null, 2), 'utf8');
  toCanvas(graph, communities, path.join(out, 'graph.canvas'), {
    communityLabels: labels,
    nodeFilenames: filenames,
  });
  return noteCount;
}

module.exports = {
  COMMUNITY_COLORS,
  communityNote,
  interCommunityEdges,
  nodeFilenameMap,
  nodeNote,
  nodeCommunityMap,
  safeName,
  toCanvas,
  toObsidian,
};
