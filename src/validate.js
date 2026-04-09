const REQUIRED_NODE_FIELDS = ['id', 'label'];
const REQUIRED_EDGE_FIELDS = ['source', 'target'];
const VALID_FILE_TYPES = new Set(['code', 'document', 'paper', 'image', 'concept', 'rationale', 'file']);
const VALID_CONFIDENCES = new Set(['EXTRACTED', 'INFERRED', 'AMBIGUOUS']);

function validateExtraction(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Extraction must be a JSON object'];
  }

  const errors = [];
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const nodeIds = new Set();

  if (!Array.isArray(data.nodes)) {
    errors.push("'nodes' must be a list");
  }

  nodes.forEach((node, index) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      errors.push(`Node ${index} must be an object`);
      return;
    }
    for (const field of REQUIRED_NODE_FIELDS) {
      if (!(field in node)) {
        errors.push(`Node ${index} (id=${node.id ? JSON.stringify(node.id) : '?'}) missing required field '${field}'`);
      }
    }
    if (node.file_type && !VALID_FILE_TYPES.has(node.file_type)) {
      errors.push(`Node ${index} (id=${JSON.stringify(node.id || '?')}) has invalid file_type '${node.file_type}'`);
    }
    if (node.id) {
      nodeIds.add(node.id);
    }
  });

  if (!Array.isArray(data.edges)) {
    errors.push("'edges' must be a list");
  } else {
    data.edges.forEach((edge, index) => {
      if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
        errors.push(`Edge ${index} must be an object`);
        return;
      }
      for (const field of REQUIRED_EDGE_FIELDS) {
        if (!(field in edge)) {
          errors.push(`Edge ${index} missing required field '${field}'`);
        }
      }
      if (edge.confidence && !VALID_CONFIDENCES.has(edge.confidence)) {
        errors.push(`Edge ${index} has invalid confidence '${edge.confidence}'`);
      }
      if (edge.source && !nodeIds.has(edge.source)) {
        errors.push(`Edge ${index} source '${edge.source}' does not match any node id`);
      }
      if (edge.target && !nodeIds.has(edge.target)) {
        errors.push(`Edge ${index} target '${edge.target}' does not match any node id`);
      }
    });
  }

  if (data.hyperedges && !Array.isArray(data.hyperedges)) {
    errors.push("'hyperedges' must be a list when present");
  }

  return errors;
}

function assertValid(data) {
  const errors = validateExtraction(data);
  if (errors.length > 0) {
    const message = `Extraction JSON has ${errors.length} error(s):\n${errors.map((error) => `  - ${error}`).join('\n')}`;
    throw new Error(message);
  }
}

module.exports = {
  REQUIRED_EDGE_FIELDS,
  REQUIRED_NODE_FIELDS,
  VALID_CONFIDENCES,
  VALID_FILE_TYPES,
  assertValid,
  validateExtraction,
};

