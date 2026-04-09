const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const { classifyFile } = require('./detect');
const { getLanguageConfig, languageFromPath } = require('./languages');

function makeId(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(':')
    .replace(/\\/g, '/')
    .replace(/\s+/g, '_')
    .replace(/[^\w:./-]/g, '_');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addNode(nodes, seen, node) {
  if (seen.has(node.id)) return;
  seen.add(node.id);
  nodes.push(node);
}

function addEdge(edges, seen, edge) {
  const key = `${edge.source}->${edge.target}:${edge.relation}`;
  if (seen.has(key)) return;
  seen.add(key);
  edges.push(edge);
}

function addFileNode(nodes, seen, filePath, fileType, label) {
  const node = {
    id: makeId('file', filePath),
    label,
    source_file: filePath,
    source_location: 'L1',
    file_type: fileType,
    kind: 'file',
  };
  addNode(nodes, seen, node);
  return node;
}

function captureMatches(line, patterns) {
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return match.slice(1).find((value) => value != null && value !== '') || match[1] || null;
    }
  }
  return null;
}

function extractCode(filePath, root) {
  const text = readText(filePath);
  const lines = text.split(/\r?\n/);
  const language = languageFromPath(filePath);
  const config = getLanguageConfig(language);
  const rel = root ? path.relative(root, filePath) : path.basename(filePath);
  const nodes = [];
  const edges = [];
  const nodeSeen = new Set();
  const edgeSeen = new Set();
  const fileNode = addFileNode(nodes, nodeSeen, filePath, 'code', path.basename(filePath));
  const defs = [];
  const symbolNames = new Set();
  const lineDefs = [];

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    const className = captureMatches(line, config.classPatterns || []);
    if (className) {
      const node = {
        id: makeId('class', rel, lineNo, className),
        label: className,
        source_file: filePath,
        source_location: `L${lineNo}`,
        file_type: 'code',
        kind: 'class',
      };
      addNode(nodes, nodeSeen, node);
      addEdge(edges, edgeSeen, {
        source: fileNode.id,
        target: node.id,
        relation: 'contains',
        confidence: 'EXTRACTED',
      });
      defs.push({ ...node, line: lineNo, name: className, bodyStart: lineNo });
      symbolNames.add(className);

      const inherit = captureMatches(line, config.inheritPatterns || []);
      if (inherit) {
        const targets = inherit.split(',').map((item) => item.trim()).filter(Boolean);
        for (const target of targets) {
          addEdge(edges, edgeSeen, {
            source: node.id,
            target: makeId('type', target),
            relation: 'inherits',
            confidence: 'EXTRACTED',
          });
        }
      }
    }

    const fnName = captureMatches(line, config.functionPatterns || []);
    if (fnName) {
      const node = {
        id: makeId('function', rel, lineNo, fnName),
        label: fnName,
        source_file: filePath,
        source_location: `L${lineNo}`,
        file_type: 'code',
        kind: 'function',
      };
      addNode(nodes, nodeSeen, node);
      addEdge(edges, edgeSeen, {
        source: fileNode.id,
        target: node.id,
        relation: 'contains',
        confidence: 'EXTRACTED',
      });
      defs.push({ ...node, line: lineNo, name: fnName, bodyStart: lineNo });
      symbolNames.add(fnName);
    }

    const importName = captureMatches(line, config.importPatterns || []);
    if (importName) {
      const node = {
        id: makeId('import', rel, lineNo, importName),
        label: importName,
        source_file: filePath,
        source_location: `L${lineNo}`,
        file_type: 'code',
        kind: 'import',
      };
      addNode(nodes, nodeSeen, node);
      addEdge(edges, edgeSeen, {
        source: fileNode.id,
        target: node.id,
        relation: 'imports',
        confidence: 'EXTRACTED',
      });
    }

    if (/^\s*(?:\/\/|#|--|;|\/\*|\*)/.test(line)) {
      const comment = line.replace(/^\s*(?:\/\/|#|--|;|\/\*|\*)\s?/, '').trim();
      if (comment && /(why|note|important|hack|todo|rationale)/i.test(comment)) {
        const node = {
          id: makeId('rationale', rel, lineNo, comment.slice(0, 30)),
          label: comment,
          source_file: filePath,
          source_location: `L${lineNo}`,
          file_type: 'rationale',
          kind: 'rationale',
        };
        addNode(nodes, nodeSeen, node);
        addEdge(edges, edgeSeen, {
          source: fileNode.id,
          target: node.id,
          relation: 'rationale_for',
          confidence: 'EXTRACTED',
        });
      }
    }
  });

  defs.sort((a, b) => a.source_location.localeCompare(b.source_location));
  for (let i = 0; i < defs.length; i += 1) {
    const current = defs[i];
    const next = defs[i + 1];
    const bodyEnd = next ? next.source_location : `L${lines.length + 1}`;
    const start = current.source_location;
    const startLine = Number(start.slice(1));
    const endLine = next ? Number(next.source_location.slice(1)) - 1 : lines.length;
    const body = lines.slice(Math.max(0, startLine - 1), Math.max(0, endLine)).join('\n');
    for (const targetName of symbolNames) {
      if (targetName === current.label) continue;
      const pattern = new RegExp(`\\b${escapeRegExp(targetName)}\\s*\\(`);
      if (pattern.test(body)) {
        const target = defs.find((item) => item.label === targetName);
        if (target) {
          addEdge(edges, edgeSeen, {
            source: current.id,
            target: target.id,
            relation: 'calls',
            confidence: 'INFERRED',
          });
        }
      }
    }
    if (/^class\b/i.test(current.kind) && /extends|implements|:\s*/i.test(body)) {
      // inheritance already captured on the definition line for most languages
    }
  }

  return { nodes, edges, hyperedges: [], meta: { language, file_type: 'code' } };
}

function extractStructuredText(filePath, root, fileType) {
  const text = readText(filePath);
  const parsed = matter(text);
  const body = parsed.content || text;
  const lines = body.split(/\r?\n/);
  const rel = root ? path.relative(root, filePath) : path.basename(filePath);
  const nodes = [];
  const edges = [];
  const nodeSeen = new Set();
  const edgeSeen = new Set();
  const fileNode = addFileNode(nodes, nodeSeen, filePath, fileType, path.basename(filePath));
  const headingStack = [];

  if (parsed.data && parsed.data.title) {
    fileNode.label = String(parsed.data.title);
  }

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const depth = heading[1].length;
      const label = heading[2].trim();
      const node = {
        id: makeId(fileType, rel, lineNo, label),
        label,
        source_file: filePath,
        source_location: `L${lineNo}`,
        file_type: fileType,
        kind: 'section',
      };
      addNode(nodes, nodeSeen, node);
      addEdge(edges, edgeSeen, {
        source: fileNode.id,
        target: node.id,
        relation: 'contains',
        confidence: 'EXTRACTED',
      });
      while (headingStack.length && headingStack[headingStack.length - 1].depth >= depth) {
        headingStack.pop();
      }
      if (headingStack.length) {
        addEdge(edges, edgeSeen, {
          source: headingStack[headingStack.length - 1].id,
          target: node.id,
          relation: 'contains',
          confidence: 'EXTRACTED',
        });
      }
      headingStack.push({ id: node.id, depth });
    }

    if (/(why|note|important|hack|rationale)/i.test(line)) {
      const label = line.trim().slice(0, 160);
      const node = {
        id: makeId('rationale', rel, lineNo, label),
        label,
        source_file: filePath,
        source_location: `L${lineNo}`,
        file_type: 'rationale',
        kind: 'rationale',
      };
      addNode(nodes, nodeSeen, node);
      addEdge(edges, edgeSeen, {
        source: fileNode.id,
        target: node.id,
        relation: 'rationale_for',
        confidence: 'EXTRACTED',
      });
    }
  });

  if (!nodes.some((node) => node.kind === 'section')) {
    const summary = body.trim().slice(0, 200);
    if (summary) {
      const node = {
        id: makeId(fileType, rel, 'summary'),
        label: summary.split(/\s+/).slice(0, 8).join(' '),
        source_file: filePath,
        source_location: 'L1',
        file_type: fileType,
        kind: 'concept',
      };
      addNode(nodes, nodeSeen, node);
      addEdge(edges, edgeSeen, {
        source: fileNode.id,
        target: node.id,
        relation: 'contains',
        confidence: 'INFERRED',
      });
    }
  }

  return { nodes, edges, hyperedges: [], meta: { file_type: fileType } };
}

function extractImage(filePath) {
  const nodes = [];
  const edges = [];
  const nodeSeen = new Set();
  const edgeSeen = new Set();
  const label = path.basename(filePath);
  const fileNode = addFileNode(nodes, nodeSeen, filePath, 'image', label);
  const stem = path.basename(filePath, path.extname(filePath));
  const concepts = stem.split(/[_\-\s]+/).filter(Boolean);
  for (const concept of concepts) {
    const node = {
      id: makeId('concept', filePath, concept),
      label: concept,
      source_file: filePath,
      source_location: 'L1',
      file_type: 'image',
      kind: 'concept',
    };
    addNode(nodes, nodeSeen, node);
    addEdge(edges, edgeSeen, {
      source: fileNode.id,
      target: node.id,
      relation: 'mentions',
      confidence: 'INFERRED',
    });
  }
  return { nodes, edges, hyperedges: [], meta: { file_type: 'image' } };
}

function extract(filePath, options = {}) {
  const root = options.root ? path.resolve(options.root) : path.dirname(path.resolve(filePath));
  const fileType = classifyFile(filePath);
  if (!fileType) {
    return { nodes: [], edges: [], hyperedges: [], meta: {} };
  }
  if (fileType === 'code') {
    return extractCode(filePath, root);
  }
  if (fileType === 'image') {
    return extractImage(filePath, root);
  }
  if (fileType === 'document' || fileType === 'paper') {
    return extractStructuredText(filePath, root, fileType);
  }
  return { nodes: [], edges: [], hyperedges: [], meta: {} };
}

function extractMany(paths, options = {}) {
  return paths.map((filePath) => extract(filePath, options));
}

module.exports = {
  addEdge,
  addNode,
  addFileNode,
  captureMatches,
  escapeRegExp,
  extract,
  extractCode,
  extractImage,
  extractMany,
  extractStructuredText,
  lineNumberForIndex,
  makeId,
  readText,
};

