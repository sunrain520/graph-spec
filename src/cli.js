const path = require('node:path');
const { runPipeline } = require('./pipeline');
const { loadGraph, queryGraph, shortestPath, getNode, getNeighbors } = require('./serve');
const { runBenchmark, printBenchmark } = require('./benchmark');
const { scoreAll } = require('./cluster');
const { install: installHooks, uninstall: uninstallHooks, status: hooksStatus } = require('./hooks');
const { writeClaude, writeAgents, uninstallClaude, uninstallAgents } = require('./install');
const { resolveOutputDir } = require('./config');
const { toWiki } = require('./wiki');
const { ingestUrl } = require('./ingest');
const { toObsidian } = require('./obsidian');
const { toNeo4jCypher, pushToNeo4j } = require('./neo4j');
const { serveMcp } = require('./mcp');

const COMMANDS = new Set([
  'build',
  'query',
  'path',
  'explain',
  'benchmark',
  'wiki',
  'add',
  'obsidian',
  'neo4j',
  'mcp',
  'hook',
  'install',
  'config',
  'watch',
  'claude',
  'codex',
  'opencode',
  'claw',
  'droid',
]);

function parseFlags(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--dfs') {
      flags.dfs = true;
      continue;
    }
    if (item === '--mode' && argv[i + 1]) {
      flags.mode = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--mode=')) {
      flags.mode = item.split('=', 2)[1];
      continue;
    }
    if (item === '--budget' && argv[i + 1]) {
      flags.budget = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (item.startsWith('--budget=')) {
      flags.budget = Number(item.split('=', 2)[1]);
      continue;
    }
    if (item === '--graph' && argv[i + 1]) {
      flags.graph = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--graph=')) {
      flags.graph = item.split('=', 2)[1];
      continue;
    }
    if (item === '--out-dir' && argv[i + 1]) {
      flags.outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--out-dir=')) {
      flags.outDir = item.split('=', 2)[1];
      continue;
    }
    if (item === '--platform' && argv[i + 1]) {
      flags.platform = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--platform=')) {
      flags.platform = item.split('=', 2)[1];
      continue;
    }
    if (item === '--author' && argv[i + 1]) {
      flags.author = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--author=')) {
      flags.author = item.split('=', 2)[1];
      continue;
    }
    if (item === '--contributor' && argv[i + 1]) {
      flags.contributor = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--contributor=')) {
      flags.contributor = item.split('=', 2)[1];
      continue;
    }
    if (item === '--target-dir' && argv[i + 1]) {
      flags.targetDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--target-dir=')) {
      flags.targetDir = item.split('=', 2)[1];
      continue;
    }
    if (item === '--depth' && argv[i + 1]) {
      flags.depth = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (item.startsWith('--depth=')) {
      flags.depth = Number(item.split('=', 2)[1]);
      continue;
    }
    if (item === '--debounce' && argv[i + 1]) {
      flags.debounce = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (item.startsWith('--debounce=')) {
      flags.debounce = Number(item.split('=', 2)[1]);
      continue;
    }
    if (item === '--wiki') {
      flags.wiki = true;
      continue;
    }
    if (item === '--wiki-dir' && argv[i + 1]) {
      flags.wikiDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--wiki-dir=')) {
      flags.wikiDir = item.split('=', 2)[1];
      continue;
    }
    if (item === '--obsidian') {
      flags.obsidian = true;
      continue;
    }
    if (item === '--obsidian-dir' && argv[i + 1]) {
      flags.obsidianDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--obsidian-dir=')) {
      flags.obsidianDir = item.split('=', 2)[1];
      continue;
    }
    if (item === '--neo4j') {
      flags.neo4j = true;
      continue;
    }
    if (item === '--neo4j-push' && argv[i + 1]) {
      flags.neo4jPush = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--neo4j-push=')) {
      flags.neo4jPush = item.split('=', 2)[1];
      continue;
    }
    if (item === '--neo4j-user' && argv[i + 1]) {
      flags.neo4jUser = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--neo4j-user=')) {
      flags.neo4jUser = item.split('=', 2)[1];
      continue;
    }
    if (item === '--neo4j-password' && argv[i + 1]) {
      flags.neo4jPassword = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--neo4j-password=')) {
      flags.neo4jPassword = item.split('=', 2)[1];
      continue;
    }
    if (item === '--neo4j-output' && argv[i + 1]) {
      flags.neo4jOutput = argv[i + 1];
      i += 1;
      continue;
    }
    if (item.startsWith('--neo4j-output=')) {
      flags.neo4jOutput = item.split('=', 2)[1];
      continue;
    }
    if (item === '--mcp') {
      flags.mcp = true;
      continue;
    }
    rest.push(item);
  }
  return { flags, rest };
}

function printHelp() {
  process.stdout.write([
    'Usage: graph-spec <command>',
    '',
    'Commands:',
    '  build [root]             build the graph for a folder',
    '  add <url>                fetch a URL into raw/ and rebuild the graph',
    '  query "<question>"       query an existing graph.json',
    '  path <source> <target>   print the shortest path between two nodes',
    '  explain <node>          print node details and neighbors',
    '  benchmark [graph.json]   measure token reduction',
    '  wiki [graph.json]        generate a markdown wiki from graph.json',
    '  obsidian [graph.json]    generate an Obsidian vault',
    '  neo4j [graph.json]      generate cypher or push to Neo4j with --neo4j-push',
    '  mcp [graph.json]        start an MCP stdio server',
    '  hook install|uninstall|status',
    '  install [--platform P]   install assistant guidance files',
    '  claude install|uninstall',
    '  codex install|uninstall',
    '  opencode install|uninstall',
    '  claw install|uninstall',
    '  droid install|uninstall',
    '  config [root]            print resolved output directory',
    '',
    'Configuration:',
    '  .graphify_config.json can override the output directory via out_dir',
    '  build also accepts --obsidian, --neo4j, --neo4j-push, and --mcp',
    '',
  ].join('\n'));
}

function communityLabelsFromGraph(graph, communities) {
  const labels = {};
  for (const [cid, members] of Object.entries(communities || {})) {
    const sample = members.map((nodeId) => graph.nodes.get(nodeId)).find(Boolean);
    labels[cid] = sample?.community_name || `Community ${Number(cid) + 1}`;
  }
  return labels;
}

function communityMembersFromGraph(graph) {
  const communities = {};
  for (const [nodeId, node] of graph.nodes.entries()) {
    if (node.community == null) continue;
    const cid = Number(node.community);
    if (!communities[cid]) communities[cid] = [];
    communities[cid].push(nodeId);
  }
  return communities;
}

function runBuild(root, flags) {
  const result = runPipeline(root, {
    outDir: flags.outDir,
    wiki: flags.wiki,
    wikiDir: flags.wikiDir,
  });
  const labels = communityLabelsFromGraph(result.graph, result.communities);
  const cohesion = scoreAll(result.graph, result.communities);

  if (flags.obsidian) {
    const obsidianDir = flags.obsidianDir || path.join(result.outDir, 'obsidian');
    result.outputs.obsidianDir = obsidianDir;
    result.outputs.obsidianCount = toObsidian(result.graph, result.communities, obsidianDir, {
      communityLabels: labels,
      cohesion,
    });
  }

  if (flags.neo4j) {
    const cypherPath = flags.neo4jOutput || path.join(result.outDir, 'cypher.txt');
    result.outputs.neo4jCypherPath = toNeo4jCypher(result.graph, cypherPath, result.communities);
  }

  if (flags.neo4jPush) {
    const user = flags.neo4jUser || process.env.NEO4J_USER || 'neo4j';
    const password = flags.neo4jPassword || process.env.NEO4J_PASSWORD;
    if (!password) {
      throw new Error('Neo4j push requires --neo4j-password or NEO4J_PASSWORD');
    }
    return pushToNeo4j(result.graph, {
      uri: flags.neo4jPush,
      user,
      password,
      communities: result.communities,
    }).then((pushResult) => {
      result.outputs.neo4jPush = pushResult;
      return result;
    });
  }

  return result;
}

function announceBuild(result) {
  process.stdout.write(`graph-spec: built ${result.detected.files.length} file(s) into ${result.outDir}\n`);
  return result;
}

function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    printHelp();
    return;
  }

  const first = argv[0];
  const isCommand = COMMANDS.has(first);
  const { flags, rest } = parseFlags(isCommand ? argv.slice(1) : argv);

  if (!isCommand) {
    const root = first;
    const outcome = runBuild(root, flags);
    if (outcome && typeof outcome.then === 'function') {
      return outcome.then((result) => {
        announceBuild(result);
        if (flags.mcp) {
          return serveMcp(path.join(result.outDir, 'graph.json'));
        }
        return result;
      });
    }
    announceBuild(outcome);
    if (flags.mcp) {
      return serveMcp(path.join(outcome.outDir, 'graph.json'));
    }
    return outcome;
  }

  switch (first) {
    case 'build': {
      const root = rest[0] || '.';
      const outcome = runBuild(root, flags);
      if (outcome && typeof outcome.then === 'function') {
        return outcome.then((result) => {
          announceBuild(result);
          if (flags.mcp) {
            return serveMcp(path.join(result.outDir, 'graph.json'));
          }
          return result;
        });
      }
      announceBuild(outcome);
      if (flags.mcp) {
        return serveMcp(path.join(outcome.outDir, 'graph.json'));
      }
      return outcome;
    }
    case 'add': {
      if (!rest[0]) {
        throw new Error('Usage: graph-spec add <url> [--target-dir DIR] [--author NAME] [--contributor NAME]');
      }
      const targetDir = flags.targetDir || path.join('.', 'raw');
      const saved = ingestUrl(rest[0], targetDir, {
        author: flags.author,
        contributor: flags.contributor,
      });
      return Promise.resolve(saved).then((ingested) => {
        const root = path.resolve('.');
        const outcome = runBuild(root, flags);
        if (outcome && typeof outcome.then === 'function') {
          return outcome.then((result) => {
            process.stdout.write(`graph-spec: ingested ${ingested.type} into ${ingested.outPath}\n`);
            announceBuild(result);
            return { ingested, result };
          });
        }
        process.stdout.write(`graph-spec: ingested ${ingested.type} into ${ingested.outPath}\n`);
        announceBuild(outcome);
        return { ingested, result: outcome };
      });
    }
    case 'wiki': {
      const graphPath = rest[0] || path.join(resolveOutputDir('.'), 'graph.json');
      const outDir = rest[1] || path.join(path.dirname(graphPath), 'wiki');
      const graph = loadGraph(graphPath);
      const wiki = toWiki(graph, null, outDir);
      process.stdout.write(`graph-spec: wrote wiki to ${wiki.outputDir}\n`);
      return wiki;
    }
    case 'obsidian': {
      const graphPath = rest[0] || path.join(resolveOutputDir('.'), 'graph.json');
      const outDir = rest[1] || path.join(path.dirname(graphPath), 'obsidian');
      const graph = loadGraph(graphPath);
      const communities = communityMembersFromGraph(graph);
      const labels = communityLabelsFromGraph(graph, communities);
      const cohesion = scoreAll(graph, communities);
      const notes = toObsidian(graph, communities, outDir, { communityLabels: labels, cohesion });
      process.stdout.write(`graph-spec: wrote ${notes} notes to ${outDir}\n`);
      return { notes, outDir };
    }
    case 'neo4j': {
      if (rest[0] === 'push') {
        const graphPath = rest[1] || path.join(resolveOutputDir('.'), 'graph.json');
        const graph = loadGraph(graphPath);
        const communities = communityMembersFromGraph(graph);
        const user = flags.neo4jUser || process.env.NEO4J_USER || 'neo4j';
        const password = flags.neo4jPassword || process.env.NEO4J_PASSWORD;
        if (!password) {
          throw new Error('Neo4j push requires --neo4j-password or NEO4J_PASSWORD');
        }
        return pushToNeo4j(graph, {
          uri: flags.neo4jPush || rest[2] || 'bolt://localhost:7687',
          user,
          password,
          communities,
        }).then((result) => {
          process.stdout.write(`graph-spec: pushed ${result.nodes} nodes and ${result.edges} edges to ${result.uri}\n`);
          return result;
        });
      }
      const graphPath = rest[0] || path.join(resolveOutputDir('.'), 'graph.json');
      const outputPath = flags.neo4jOutput
        || (rest[1] && path.extname(rest[1]) ? rest[1] : path.join(rest[1] || path.dirname(graphPath), 'cypher.txt'));
      const graph = loadGraph(graphPath);
      const communities = communityMembersFromGraph(graph);
      toNeo4jCypher(graph, outputPath, communities);
      process.stdout.write(`graph-spec: wrote Neo4j cypher to ${outputPath}\n`);
      return outputPath;
    }
    case 'mcp': {
      const graphPath = rest[0] || path.join(resolveOutputDir('.'), 'graph.json');
      return serveMcp(graphPath);
    }
    case 'query': {
      if (!rest[0]) {
        throw new Error('Usage: graph-spec query "<question>" [--dfs] [--depth N] [--budget N] [--graph path]');
      }
      const question = rest[0];
      const graphPath = flags.graph || path.join(resolveOutputDir('.'), 'graph.json');
      const graph = loadGraph(graphPath);
      const text = queryGraph(graph, question, {
        depth: Number.isFinite(flags.depth) ? flags.depth : 2,
        mode: flags.dfs ? 'dfs' : (flags.mode || 'bfs'),
        tokenBudget: Number.isFinite(flags.budget) ? flags.budget : 2000,
      });
      process.stdout.write(`${text}\n`);
      return text;
    }
    case 'path': {
      if (rest.length < 2) {
        throw new Error('Usage: graph-spec path <source> <target> [--graph path]');
      }
      const graphPath = flags.graph || path.join(resolveOutputDir('.'), 'graph.json');
      const graph = loadGraph(graphPath);
      const source = getNode(graph, rest[0]);
      const target = getNode(graph, rest[1]);
      if (!source || !target) {
        process.stdout.write('No path found.\n');
        return null;
      }
      const route = shortestPath(graph, source.id, target.id, Number.isFinite(flags.depth) ? flags.depth : 8);
      if (!route) {
        process.stdout.write('No path found.\n');
        return null;
      }
      const text = route.map((nodeId) => graph.nodes.get(nodeId)?.label || nodeId).join(' -> ');
      process.stdout.write(`${text}\n`);
      return route;
    }
    case 'explain': {
      if (!rest[0]) {
        throw new Error('Usage: graph-spec explain <node> [--graph path]');
      }
      const graphPath = flags.graph || path.join(resolveOutputDir('.'), 'graph.json');
      const graph = loadGraph(graphPath);
      const node = getNode(graph, rest[0]);
      if (!node) {
        process.stdout.write(`No node matching '${rest[0]}' found.\n`);
        return null;
      }
      const neighbors = getNeighbors(graph, rest[0]);
      const lines = [
        `Node: ${node.label}`,
        `  ID: ${node.id}`,
        `  Source: ${node.source_file} ${node.source_location}`.trimEnd(),
        `  Type: ${node.file_type || ''}`.trimEnd(),
        `  Community: ${node.community ?? ''}`.trimEnd(),
        `  Degree: ${node.degree}`,
      ];
      if (neighbors.length > 0) {
        lines.push('Neighbors:');
        for (const neighbor of neighbors) {
          lines.push(`  - ${neighbor.label} (${neighbor.relation}${neighbor.confidence ? `, ${neighbor.confidence}` : ''})`);
        }
      }
      const text = lines.join('\n');
      process.stdout.write(`${text}\n`);
      return text;
    }
    case 'benchmark': {
      const graphPath = rest[0] || path.join(resolveOutputDir('.'), 'graph.json');
      const result = runBenchmark(graphPath, {
        question: flags.question,
        depth: Number.isFinite(flags.depth) ? flags.depth : 3,
        mode: flags.dfs ? 'dfs' : 'bfs',
      });
      printBenchmark(result);
      return result;
    }
    case 'hook': {
      const subcmd = rest[0];
      if (subcmd === 'install') {
        process.stdout.write(`${installHooks(rest[1] || '.')}\n`);
        return;
      }
      if (subcmd === 'uninstall') {
        process.stdout.write(`${uninstallHooks(rest[1] || '.')}\n`);
        return;
      }
      if (subcmd === 'status') {
        process.stdout.write(`${hooksStatus(rest[1] || '.')}\n`);
        return;
      }
      throw new Error('Usage: graph-spec hook [install|uninstall|status]');
    }
    case 'install': {
      const platform = flags.platform || 'claude';
      const root = rest[0] || '.';
      if (platform === 'claude') {
        writeClaude(root, { outDir: flags.outDir });
      } else if (platform === 'codex' || platform === 'opencode' || platform === 'claw' || platform === 'droid') {
        writeAgents(root, platform, { outDir: flags.outDir });
      } else {
        throw new Error(`Unknown platform: ${platform}`);
      }
      process.stdout.write(`graph-spec: installed guidance for ${platform}\n`);
      return;
    }
    case 'config': {
      const root = rest[0] || '.';
      process.stdout.write(`${resolveOutputDir(root, flags.outDir)}\n`);
      return;
    }
    case 'watch': {
      const root = rest[0] || '.';
      const { watch } = require('./watch');
      watch(root, Number.isFinite(flags.debounce) ? flags.debounce : 3.0, { outDir: flags.outDir });
      process.stdout.write(`graph-spec: watching ${path.resolve(root)}\n`);
      return;
    }
    case 'claude':
    case 'codex':
    case 'opencode':
    case 'claw':
    case 'droid': {
      const subcmd = rest[0];
      const root = rest[1] || '.';
      if (subcmd === 'install') {
        if (first === 'claude') {
          writeClaude(root, { outDir: flags.outDir });
        } else {
          writeAgents(root, first, { outDir: flags.outDir });
        }
      } else if (subcmd === 'uninstall') {
        if (first === 'claude') {
          uninstallClaude(root);
        } else {
          uninstallAgents(root);
        }
      } else {
        throw new Error(`Usage: graph-spec ${first} [install|uninstall]`);
      }
      process.stdout.write(`graph-spec: ${first} ${subcmd} complete\n`);
      return;
    }
    default:
      throw new Error(`Unsupported command: ${first}`);
  }
}

module.exports = {
  main,
  parseFlags,
  printHelp,
  COMMANDS,
};
