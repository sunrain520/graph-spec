const path = require('node:path');

const STATE_DIR_NAME = '.graph-spec';
const RUNTIME_DIR_NAME = 'runtime';

function getProjectStateDir(root) {
  return path.join(path.resolve(root || '.'), STATE_DIR_NAME);
}

function getProjectConfigPath(root) {
  return path.join(path.resolve(root || '.'), '.graphify_config.json');
}

function getRuntimeDir(root) {
  return path.join(getProjectStateDir(root), RUNTIME_DIR_NAME);
}

function getRuntimePath(root, name) {
  return path.join(getRuntimeDir(root), name);
}

module.exports = {
  STATE_DIR_NAME,
  RUNTIME_DIR_NAME,
  getProjectStateDir,
  getProjectConfigPath,
  getRuntimeDir,
  getRuntimePath,
};
