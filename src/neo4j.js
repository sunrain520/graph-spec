const fs = require('node:fs');
const path = require('node:path');
const neo4j = require('neo4j-driver');
const { nodeCommunityMap } = require('./obsidian');

function sanitizeRelationship(relation) {
  return String(relation || 'RELATED_TO').toUpperCase().replace(/[^A-Z0-9_]/g, '_') || 'RELATED_TO';
}

function sanitizeNodeLabel(label) {
  const safe = String(label || 'Entity').replace(/[^A-Za-z0-9_]/g, '');
  return safe ? safe[0].toUpperCase() + safe.slice(1) : 'Entity';
}

function neo4jProperties(data) {
  const props = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      props[key] = value;
    }
  }
  return props;
}

function cypherString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function cypherKey(key) {
  return String(key).replace(/[^A-Za-z0-9_]/g, '_') || 'property';
}

function cypherLiteral(value) {
  if (value == null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map((item) => cypherLiteral(item)).join(', ')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .map(([key, item]) => `${cypherKey(key)}: ${cypherLiteral(item)}`)
      .join(', ')}}`;
  }
  return cypherString(value);
}

function defaultDriverFactory(uri, user, password) {
  return neo4j.driver(uri, neo4j.auth.basic(user, password));
}

async function pushToNeo4j(graph, options = {}) {
  const uri = options.uri || 'bolt://localhost:7687';
  const user = options.user || 'neo4j';
  const password = options.password || 'neo4j';
  const driverFactory = options.driverFactory || defaultDriverFactory;
  const driver = driverFactory(uri, user, password);
  const session = driver.session();
  const nodeMap = options.communities ? nodeCommunityMap(options.communities) : {};
  let nodes = 0;
  let edges = 0;

  try {
    for (const [nodeId, data] of graph.nodes.entries()) {
      const props = { ...neo4jProperties(data), id: nodeId };
      if (nodeMap[nodeId] != null) {
        props.community = nodeMap[nodeId];
      }
      const label = sanitizeNodeLabel(data.file_type || data.kind || 'Entity');
      await session.run(`MERGE (n:${label} {id: $id}) SET n += $props`, { id: nodeId, props });
      nodes += 1;
    }

    for (const edge of graph.edges) {
      const rel = sanitizeRelationship(edge.relation);
      const props = neo4jProperties(edge);
      await session.run(
        `MATCH (a {id: $src}), (b {id: $tgt}) MERGE (a)-[r:${rel}]->(b) SET r += $props`,
        { src: edge.source, tgt: edge.target, props },
      );
      edges += 1;
    }
  } finally {
    await session.close();
    await driver.close();
  }

  return { uri, user, nodes, edges };
}

function toNeo4jCypher(graph, outputPath, communities = null) {
  const lines = [];
  const nodeMap = communities ? nodeCommunityMap(communities) : {};
  for (const [nodeId, data] of graph.nodes.entries()) {
    const label = sanitizeNodeLabel(data.file_type || data.kind || 'Entity');
    const props = { ...neo4jProperties(data), id: nodeId };
    if (nodeMap[nodeId] != null) props.community = nodeMap[nodeId];
    lines.push(`MERGE (n:${label} {id: ${cypherString(nodeId)}}) SET n += ${cypherLiteral(props)};`);
  }
  for (const edge of graph.edges) {
    const rel = sanitizeRelationship(edge.relation);
    const props = neo4jProperties(edge);
    lines.push(
      `MATCH (a {id: ${cypherString(edge.source)}}), (b {id: ${cypherString(edge.target)}}) MERGE (a)-[r:${rel}]->(b) SET r += ${cypherLiteral(props)};`,
    );
  }
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, lines.join('\n'), 'utf8');
  return resolved;
}

module.exports = {
  defaultDriverFactory,
  cypherKey,
  cypherLiteral,
  cypherString,
  neo4jProperties,
  pushToNeo4j,
  sanitizeNodeLabel,
  sanitizeRelationship,
  toNeo4jCypher,
};
