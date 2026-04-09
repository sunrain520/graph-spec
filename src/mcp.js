const path = require('node:path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const types = require('@modelcontextprotocol/sdk/types.js');
const { loadGraph, bfs, dfs, getNode, getNeighbors, getCommunity, graphStats, shortestPath, scoreNodes, subgraphToText } = require('./serve');
const { godNodes, surprisingConnections, suggestQuestions } = require('./analyze');

function toolDefinitions(graph) {
  return [
    {
      name: 'query_graph',
      description: 'Search the knowledge graph using BFS or DFS.',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          mode: { type: 'string', enum: ['bfs', 'dfs'], default: 'bfs' },
          depth: { type: 'integer', default: 3 },
          token_budget: { type: 'integer', default: 2000 },
        },
        required: ['question'],
      },
    },
    {
      name: 'get_node',
      description: 'Get full details for a specific node by label or ID.',
      inputSchema: {
        type: 'object',
        properties: { label: { type: 'string' } },
        required: ['label'],
      },
    },
    {
      name: 'get_neighbors',
      description: 'Get all direct neighbors of a node with edge details.',
      inputSchema: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          relation_filter: { type: 'string' },
        },
        required: ['label'],
      },
    },
    {
      name: 'get_community',
      description: 'Get all nodes in a community by community ID.',
      inputSchema: {
        type: 'object',
        properties: { community_id: { type: 'integer' } },
        required: ['community_id'],
      },
    },
    {
      name: 'god_nodes',
      description: 'Return the most connected nodes.',
      inputSchema: {
        type: 'object',
        properties: { top_n: { type: 'integer', default: 10 } },
      },
    },
    {
      name: 'graph_stats',
      description: 'Return summary statistics.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'shortest_path',
      description: 'Find the shortest path between two concepts.',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          max_hops: { type: 'integer', default: 8 },
        },
        required: ['source', 'target'],
      },
    },
    {
      name: 'surprising_connections',
      description: 'List high-value cross-file or cross-community bridges.',
      inputSchema: {
        type: 'object',
        properties: { top_n: { type: 'integer', default: 5 } },
      },
    },
    {
      name: 'suggest_questions',
      description: 'Return follow-up questions the graph is well suited to answer.',
      inputSchema: {
        type: 'object',
        properties: { top_n: { type: 'integer', default: 5 } },
      },
    },
  ];
}

function findStartNodes(graph, question) {
  const terms = String(question)
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);
  const scored = scoreNodes(graph, terms);
  return scored.slice(0, 5).map(([, nodeId]) => nodeId);
}

function textResult(text, isError = false) {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

function callTool(graph, name, args = {}) {
  try {
    if (name === 'query_graph') {
      const starts = findStartNodes(graph, args.question);
      if (starts.length === 0) return textResult('No matching nodes found.');
      const depth = Number.isFinite(args.depth) ? Math.min(Number(args.depth), 6) : 3;
      const mode = args.mode === 'dfs' ? 'dfs' : 'bfs';
      const budget = Number.isFinite(args.token_budget) ? Number(args.token_budget) : 2000;
      const traversal = mode === 'dfs' ? dfs(graph, starts, depth) : bfs(graph, starts, depth);
      const header = `Traversal: ${mode.toUpperCase()} depth=${depth} | Start: ${starts.map((id) => graph.nodes.get(id)?.label || id).join(', ')} | ${traversal.nodes.size} nodes found\n\n`;
      return textResult(header + subgraphToText(graph, traversal.nodes, traversal.edges, budget));
    }

    if (name === 'get_node') {
      const node = getNode(graph, args.label);
      if (!node) return textResult(`No node matching '${args.label}' found.`);
      const lines = [
        `Node: ${node.label}`,
        `  ID: ${node.id}`,
        `  Source: ${node.source_file} ${node.source_location}`.trimEnd(),
        `  Type: ${node.file_type || ''}`.trimEnd(),
        `  Community: ${node.community ?? ''}`.trimEnd(),
        `  Degree: ${node.degree}`,
      ];
      return textResult(lines.join('\n'));
    }

    if (name === 'get_neighbors') {
      const items = getNeighbors(graph, args.label, args.relation_filter || null);
      return textResult(items.length > 0
        ? items.map((item) => `- ${item.label} (${item.relation}${item.confidence ? `, ${item.confidence}` : ''})`).join('\n')
        : `No neighbors found for '${args.label}'.`);
    }

    if (name === 'get_community') {
      const items = getCommunity(graph, Number(args.community_id));
      return textResult(items.length > 0
        ? items.map((item) => `- ${item.label} (${item.id})`).join('\n')
        : `No nodes found in community ${args.community_id}.`);
    }

    if (name === 'god_nodes') {
      const items = godNodes(graph, Number(args.top_n) || 10);
      return textResult(items.map((item) => `- ${item.label} (${item.edges} connections)`).join('\n'));
    }

    if (name === 'graph_stats') {
      return textResult(JSON.stringify(graphStats(graph), null, 2));
    }

    if (name === 'shortest_path') {
      const source = getNode(graph, args.source);
      const target = getNode(graph, args.target);
      if (!source || !target) return textResult('No path found.');
      const route = shortestPath(graph, source.id, target.id, Number(args.max_hops) || 8);
      if (!route) return textResult('No path found.');
      return textResult(route.map((id) => graph.nodes.get(id)?.label || id).join(' -> '));
    }

    if (name === 'surprising_connections') {
      const items = surprisingConnections(graph, null, Number(args.top_n) || 5);
      return textResult(items.map((item) => `- ${item.source_label} -> ${item.target_label} (${item.relation}, ${item.confidence})`).join('\n'));
    }

    if (name === 'suggest_questions') {
      return textResult(suggestQuestions(graph, null, Number(args.top_n) || 5).map((item) => `- ${item}`).join('\n'));
    }

    return textResult(`Unknown tool: ${name}`, true);
  } catch (error) {
    return textResult(`Tool failed: ${error.message}`, true);
  }
}

function createServer(graph) {
  const server = new Server({ name: 'graph-spec', version: '0.1.0' });

  server.setRequestHandler(types.ListToolsRequestSchema, async () => ({
    tools: toolDefinitions(graph),
  }));

  server.setRequestHandler(types.CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    return callTool(graph, name, toolArgs || {});
  });

  return server;
}

async function serveMcp(graphPath = path.resolve('graphify-out/graph.json')) {
  const graph = loadGraph(graphPath);
  const server = createServer(graph);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return { graphPath, graph, server };
}

module.exports = {
  callTool,
  createServer,
  serveMcp,
  textResult,
  toolDefinitions,
};
