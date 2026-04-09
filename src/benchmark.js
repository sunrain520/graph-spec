const fs = require('node:fs');
const path = require('node:path');
const { loadGraph, queryGraph } = require('./serve');

function estimateTokens(text) {
  return Math.ceil(String(text).length / 4);
}

function runBenchmark(graphPath, options = {}) {
  const graph = loadGraph(graphPath);
  const question = options.question || 'what connects the main concepts?';
  const depth = options.depth || 3;
  const queryText = queryGraph(graph, question, { depth, mode: options.mode || 'bfs' });
  const manifestPath = path.join(path.dirname(graphPath), 'manifest.json');
  let corpusWords = 0;
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      corpusWords = (manifest.files || []).reduce((sum, entry) => sum + (entry.words || 0), 0);
    } catch {
      corpusWords = 0;
    }
  }
  return {
    corpus_words: corpusWords,
    corpus_tokens: estimateTokens(' '.repeat(corpusWords)),
    query_tokens: estimateTokens(queryText),
    reduction: corpusWords > 0 ? Number((corpusWords / Math.max(1, estimateTokens(queryText))).toFixed(2)) : 0,
    query_text: queryText,
  };
}

function printBenchmark(result) {
  const lines = [
    'Benchmark',
    `- corpus words: ${result.corpus_words}`,
    `- corpus tokens: ${result.corpus_tokens}`,
    `- query tokens: ${result.query_tokens}`,
    `- reduction: ${result.reduction}x`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

module.exports = {
  estimateTokens,
  printBenchmark,
  runBenchmark,
};

