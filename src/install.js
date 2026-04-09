const fs = require('node:fs');
const path = require('node:path');
const { resolveOutputDir, loadConfig } = require('./config');

function renderSection(outDir = 'graphify-out') {
  return `\
## graph-spec

This project has a graph-spec knowledge graph at ${outDir}/.

Rules:
- Before answering architecture or codebase questions, read ${outDir}/GRAPH_REPORT.md for god nodes and community structure
- If ${outDir}/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run \`node -e "require('graph-spec/src/watch')._rebuildCode(process.cwd())"\` to keep the graph current
`;
}

function writeSectionFile(targetPath, marker, section) {
  if (fs.existsSync(targetPath)) {
    const content = fs.readFileSync(targetPath, 'utf8');
    if (content.includes(marker)) {
      return false;
    }
    fs.writeFileSync(targetPath, `${content.trim()}\n\n${section}`);
  } else {
    fs.writeFileSync(targetPath, section);
  }
  return true;
}

function writeClaude(projectDir = '.', options = {}) {
  const root = path.resolve(projectDir);
  const outDir = resolveOutputDir(root, options.outDir);
  const target = path.join(root, 'CLAUDE.md');
  writeSectionFile(target, '## graph-spec', renderSection(outDir));

  const settingsPath = path.join(root, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const command = `node -e "const fs=require('node:fs');const path=require('node:path');const {resolveOutputDir}=require('graph-spec');const out=resolveOutputDir(process.cwd());const graph=path.join(out,'graph.json');if(fs.existsSync(graph)){console.log('graph-spec: Knowledge graph exists. Read '+path.join(out,'GRAPH_REPORT.md')+' before searching raw files.');}"`;
  const payload = fs.existsSync(settingsPath)
    ? safeJsonParse(fs.readFileSync(settingsPath, 'utf8'))
    : {};
  const hooks = payload.hooks || (payload.hooks = {});
  const preToolUse = hooks.PreToolUse || (hooks.PreToolUse = []);
  if (!preToolUse.some((item) => item.matcher === 'Glob|Grep' && JSON.stringify(item).includes('graph-spec'))) {
    preToolUse.push({
      matcher: 'Glob|Grep',
      hooks: [{ type: 'command', command }],
    });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2), 'utf8');
  return { target, settingsPath, outDir };
}

function writeAgents(projectDir = '.', platform = 'codex', options = {}) {
  const root = path.resolve(projectDir);
  const outDir = resolveOutputDir(root, options.outDir);
  const target = path.join(root, 'AGENTS.md');
  writeSectionFile(target, '## graph-spec', renderSection(outDir));
  return { target, outDir, platform };
}

function uninstallClaude(projectDir = '.') {
  const root = path.resolve(projectDir);
  const target = path.join(root, 'CLAUDE.md');
  if (!fs.existsSync(target)) return false;
  const content = fs.readFileSync(target, 'utf8');
  const cleaned = content.replace(/\n*## graph-spec\n[\s\S]*?(?=\n## |\n*$)/, '').trim();
  if (cleaned) fs.writeFileSync(target, `${cleaned}\n`, 'utf8');
  else fs.rmSync(target, { force: true });
  const settingsPath = path.join(root, '.claude', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const payload = safeJsonParse(fs.readFileSync(settingsPath, 'utf8'));
    const preToolUse = payload?.hooks?.PreToolUse || [];
    const filtered = preToolUse.filter((item) => !(item.matcher === 'Glob|Grep' && JSON.stringify(item).includes('graph-spec')));
    if (payload.hooks) payload.hooks.PreToolUse = filtered;
    fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2), 'utf8');
  }
  return true;
}

function uninstallAgents(projectDir = '.') {
  const root = path.resolve(projectDir);
  const target = path.join(root, 'AGENTS.md');
  if (!fs.existsSync(target)) return false;
  const content = fs.readFileSync(target, 'utf8');
  const cleaned = content.replace(/\n*## graph-spec\n[\s\S]*?(?=\n## |\n*$)/, '').trim();
  if (cleaned) fs.writeFileSync(target, `${cleaned}\n`, 'utf8');
  else fs.rmSync(target, { force: true });
  return true;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

module.exports = {
  renderSection,
  uninstallAgents,
  uninstallClaude,
  writeAgents,
  writeClaude,
};
