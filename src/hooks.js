const fs = require('node:fs');
const path = require('node:path');

const HOOK_MARKER = '# graph-spec-hook-start';
const HOOK_MARKER_END = '# graph-spec-hook-end';
const CHECKOUT_MARKER = '# graph-spec-checkout-hook-start';
const CHECKOUT_MARKER_END = '# graph-spec-checkout-hook-end';

const HOOK_SCRIPT = `\
# graph-spec-hook-start
# Auto-rebuilds the knowledge graph after each commit (code files only, no LLM needed).
# Installed by: graph-spec hook install

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only HEAD 2>/dev/null)
if [ -z "$CHANGED" ]; then
    exit 0
fi

export GRAPHSPEC_CHANGED="$CHANGED"
node -e "
const { _rebuildCode } = require('graph-spec/src/watch');
const path = require('node:path');
_rebuildCode(process.cwd());
"
# graph-spec-hook-end
`;

const CHECKOUT_SCRIPT = `\
# graph-spec-checkout-hook-start
# Auto-rebuilds the knowledge graph (code only) when switching branches.
# Installed by: graph-spec hook install

PREV_HEAD=$1
NEW_HEAD=$2
BRANCH_SWITCH=$3

if [ "$BRANCH_SWITCH" != "1" ]; then
    exit 0
fi

if [ ! -d "graphify-out" ] && [ ! -d "graph-spec-out" ]; then
    exit 0
fi

echo "[graph-spec] Branch switched - rebuilding knowledge graph (code files)..."
node -e "
const { _rebuildCode } = require('graph-spec/src/watch');
_rebuildCode(process.cwd());
"
# graph-spec-checkout-hook-end
`;

function gitRoot(startPath) {
  let current = path.resolve(startPath || '.');
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function installHook(hooksDir, name, script, marker) {
  const hookPath = path.join(hooksDir, name);
  if (fs.existsSync(hookPath)) {
    const content = fs.readFileSync(hookPath, 'utf8');
    if (content.includes(marker)) {
      return `already installed at ${hookPath}`;
    }
    fs.writeFileSync(hookPath, `${content.trim()}\n\n${script}`);
    fs.chmodSync(hookPath, 0o755);
    return `appended to existing ${name} hook at ${hookPath}`;
  }
  fs.writeFileSync(hookPath, `#!/bin/bash\n${script}`);
  fs.chmodSync(hookPath, 0o755);
  return `installed at ${hookPath}`;
}

function uninstallHook(hooksDir, name, marker, markerEnd) {
  const hookPath = path.join(hooksDir, name);
  if (!fs.existsSync(hookPath)) {
    return `no ${name} hook found - nothing to remove.`;
  }
  const content = fs.readFileSync(hookPath, 'utf8');
  if (!content.includes(marker)) {
    return `graph-spec hook not found in ${name} - nothing to remove.`;
  }
  const cleaned = content.replace(new RegExp(`${escapeRegExp(marker)}[\\s\\S]*?${escapeRegExp(markerEnd)}\\n?`, 'g'), '').trim();
  if (!cleaned || cleaned === '#!/bin/bash') {
    fs.rmSync(hookPath, { force: true });
    return `removed ${name} hook at ${hookPath}`;
  }
  fs.writeFileSync(hookPath, `${cleaned}\n`, 'utf8');
  return `graph-spec removed from ${name} at ${hookPath} (other hook content preserved)`;
}

function install(pathArg = '.') {
  const root = gitRoot(pathArg);
  if (!root) {
    throw new Error(`No git repository found at or above ${path.resolve(pathArg)}`);
  }
  const hooksDir = path.join(root, '.git', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const commitMsg = installHook(hooksDir, 'post-commit', HOOK_SCRIPT, HOOK_MARKER);
  const checkoutMsg = installHook(hooksDir, 'post-checkout', CHECKOUT_SCRIPT, CHECKOUT_MARKER);
  return `post-commit: ${commitMsg}\npost-checkout: ${checkoutMsg}`;
}

function uninstall(pathArg = '.') {
  const root = gitRoot(pathArg);
  if (!root) {
    throw new Error(`No git repository found at or above ${path.resolve(pathArg)}`);
  }
  const hooksDir = path.join(root, '.git', 'hooks');
  const commitMsg = uninstallHook(hooksDir, 'post-commit', HOOK_MARKER, HOOK_MARKER_END);
  const checkoutMsg = uninstallHook(hooksDir, 'post-checkout', CHECKOUT_MARKER, CHECKOUT_MARKER_END);
  return `post-commit: ${commitMsg}\npost-checkout: ${checkoutMsg}`;
}

function status(pathArg = '.') {
  const root = gitRoot(pathArg);
  if (!root) return 'Not in a git repository.';
  const hooksDir = path.join(root, '.git', 'hooks');
  const check = (name, marker) => {
    const hookPath = path.join(hooksDir, name);
    if (!fs.existsSync(hookPath)) return 'not installed';
    return fs.readFileSync(hookPath, 'utf8').includes(marker) ? 'installed' : 'not installed (hook exists but graph-spec not found)';
  };
  return `post-commit: ${check('post-commit', HOOK_MARKER)}\npost-checkout: ${check('post-checkout', CHECKOUT_MARKER)}`;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  CHECKOUT_MARKER,
  CHECKOUT_MARKER_END,
  HOOK_MARKER,
  HOOK_MARKER_END,
  _escapeRegExp: escapeRegExp,
  install,
  installHook,
  status,
  uninstall,
  uninstallHook,
  gitRoot,
};
