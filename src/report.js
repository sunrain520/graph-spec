const { godNodes, surprisingConnections, suggestQuestions } = require('./analyze');
const { scoreAll, cohesionScore } = require('./cluster');

function renderReport(graph, analysis = {}) {
  const communities = analysis.communities || {};
  const communityScores = scoreAll(graph, communities);
  const gods = analysis.god_nodes || godNodes(graph, 10);
  const bridges = analysis.surprising_connections || surprisingConnections(graph, communities, 5);
  const questions = analysis.suggest_questions || suggestQuestions(graph, communities, 5);

  const lines = [];
  lines.push('# GRAPH_REPORT');
  lines.push('');
  lines.push(`- 节点数: ${graph.nodes.size}`);
  lines.push(`- 边数: ${graph.edges.length}`);
  lines.push(`- 社区数: ${Object.keys(communities).length}`);
  lines.push('');
  lines.push('## God Nodes');
  for (const node of gods) {
    lines.push(`- ${node.label} (${node.edges} edges${node.community != null ? `, community ${node.community}` : ''})`);
  }
  lines.push('');
  lines.push('## Surprising Connections');
  for (const bridge of bridges) {
    lines.push(`- ${bridge.source_label} -> ${bridge.target_label} [${bridge.relation}] (${bridge.confidence})`);
  }
  lines.push('');
  lines.push('## Suggested Questions');
  for (const question of questions) {
    lines.push(`- ${question}`);
  }
  lines.push('');
  lines.push('## Communities');
  for (const [cid, nodes] of Object.entries(communities)) {
    const score = communityScores[cid] ?? cohesionScore(graph, nodes);
    lines.push(`- Community ${Number(cid) + 1}: ${nodes.length} nodes, cohesion ${score}`);
  }
  return lines.join('\n');
}

module.exports = {
  renderReport,
};

