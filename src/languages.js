const path = require('node:path');

const EXTENSION_LANGUAGE = {
  '.py': 'python',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.cs': 'csharp',
  '.scala': 'scala',
  '.php': 'php',
  '.lua': 'lua',
  '.zig': 'zig',
  '.ps1': 'powershell',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.m': 'objc',
  '.mm': 'objc',
  '.jl': 'julia',
};

function makePatterns(items) {
  return items.map((item) => (item instanceof RegExp ? item : new RegExp(item)));
}

const LANGUAGE_CONFIGS = {
  generic: {
    kind: 'code',
    functionPatterns: makePatterns([
      '^\\s*(?:export\\s+default\\s+)?(?:async\\s+)?function\\s+([A-Za-z_][\\w]*)\\s*\\(',
      '^\\s*(?:export\\s+)?(?:async\\s+)?(?:const|let|var)\\s+([A-Za-z_][\\w]*)\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_][\\w]*)\\s*=>',
      '^\\s*(?:public\\s+|private\\s+|protected\\s+)?(?:static\\s+)?(?:async\\s+)?(?:function|func|fn|def|sub|proc)\\s+([A-Za-z_][\\w]*)\\s*\\(',
    ]),
    classPatterns: makePatterns([
      '^\\s*(?:export\\s+)?class\\s+([A-Za-z_][\\w]*)\\b',
      '^\\s*interface\\s+([A-Za-z_][\\w]*)\\b',
      '^\\s*enum\\s+([A-Za-z_][\\w]*)\\b',
      '^\\s*struct\\s+([A-Za-z_][\\w]*)\\b',
      '^\\s*trait\\s+([A-Za-z_][\\w]*)\\b',
    ]),
    importPatterns: makePatterns([
      '^\\s*import\\s+.*?from\\s+[\'"]([^\'"]+)[\'"]',
      '^\\s*import\\s+[\'"]([^\'"]+)[\'"]',
      '^\\s*from\\s+([A-Za-z0-9_./-]+)\\s+import\\s+',
      '^\\s*require\\([\'"]([^\'"]+)[\'"]\\)',
      '^\\s*use\\s+([A-Za-z0-9_:./-]+)',
      '^\\s*include\\s+[\'"]([^\'"]+)[\'"]',
    ]),
    inheritPatterns: makePatterns([
      '^\\s*class\\s+[A-Za-z_][\\w]*\\(([^)]+)\\)',
      '^\\s*(?:class|interface|struct)\\s+[A-Za-z_][\\w]*\\s+extends\\s+([A-Za-z0-9_:.<>]+)',
      '^\\s*(?:class|interface|struct)\\s+[A-Za-z_][\\w]*\\s+implements\\s+([A-Za-z0-9_,\\s:.<>]+)',
    ]),
  },
  python: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*(?:async\\s+)?def\\s+([A-Za-z_][\\w]*)\\s*\\(']),
    classPatterns: makePatterns(['^\\s*class\\s+([A-Za-z_][\\w]*)\\s*(?:\\(|:)']),
    importPatterns: makePatterns(['^\\s*import\\s+([A-Za-z0-9_.,\\s]+)', '^\\s*from\\s+([A-Za-z0-9_./-]+)\\s+import\\s+']),
    inheritPatterns: makePatterns(['^\\s*class\\s+[A-Za-z_][\\w]*\\(([^)]+)\\)']),
  },
  javascript: {},
  typescript: {},
  go: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*func\\s+(?:\\([^)]+\\)\\s*)?([A-Za-z_][\\w]*)\\s*\\(']),
    classPatterns: makePatterns(['^\\s*type\\s+([A-Za-z_][\\w]*)\\s+(?:struct|interface)\\b']),
    importPatterns: makePatterns(['^\\s*import\\s+\\(([^)]+)\\)', '^\\s*import\\s+"([^"]+)"']),
    inheritPatterns: makePatterns([]),
  },
  rust: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*(?:pub\\s+)?(?:async\\s+)?fn\\s+([A-Za-z_][\\w]*)\\s*\\(']),
    classPatterns: makePatterns(['^\\s*(?:pub\\s+)?(?:struct|enum|trait)\\s+([A-Za-z_][\\w]*)\\b', '^\\s*impl\\s+([A-Za-z_][\\w]*)\\b']),
    importPatterns: makePatterns(['^\\s*use\\s+([A-Za-z0-9_:./{}*,\\s-]+)']),
    inheritPatterns: makePatterns([]),
  },
  java: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*(?:public|private|protected)?\\s*(?:static\\s+)?[A-Za-z0-9_<>,\\[\\]]+\\s+([A-Za-z_][\\w]*)\\s*\\(']),
    classPatterns: makePatterns(['^\\s*(?:public\\s+)?class\\s+([A-Za-z_][\\w]*)\\b', '^\\s*(?:public\\s+)?interface\\s+([A-Za-z_][\\w]*)\\b', '^\\s*enum\\s+([A-Za-z_][\\w]*)\\b']),
    importPatterns: makePatterns(['^\\s*import\\s+([A-Za-z0-9_.*]+);']),
    inheritPatterns: makePatterns(['^\\s*class\\s+[A-Za-z_][\\w]*\\s+extends\\s+([A-Za-z0-9_$.<>]+)', '^\\s*class\\s+[A-Za-z_][\\w]*\\s+implements\\s+([A-Za-z0-9_,\\s$.<>]+)']),
  },
  c: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*[A-Za-z_][\\w\\s\\*]+\\s+([A-Za-z_][\\w]*)\\s*\\([^;]*\\)\\s*\\{']),
    classPatterns: makePatterns(['^\\s*typedef\\s+struct\\s+([A-Za-z_][\\w]*)', '^\\s*struct\\s+([A-Za-z_][\\w]*)\\b']),
    importPatterns: makePatterns(['^\\s*#include\\s+[<"]([^>"]+)[>"]']),
    inheritPatterns: makePatterns([]),
  },
  cpp: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*[A-Za-z_][\\w\\s:<>&\\*]+\\s+([A-Za-z_][\\w]*)\\s*\\([^;]*\\)\\s*(?:const\\s*)?(?:\\{|\\;)', '^\\s*template\\s*<.*>\\s*[A-Za-z_][\\w\\s:<>&\\*]+\\s+([A-Za-z_][\\w]*)\\s*\\([^;]*\\)\\s*\\{']),
    classPatterns: makePatterns(['^\\s*(?:class|struct)\\s+([A-Za-z_][\\w]*)\\b', '^\\s*enum\\s+([A-Za-z_][\\w]*)\\b']),
    importPatterns: makePatterns(['^\\s*#include\\s+[<"]([^>"]+)[>"]']),
    inheritPatterns: makePatterns(['^\\s*(?:class|struct)\\s+[A-Za-z_][\\w]*\\s*:\\s*(?:public\\s+|private\\s+|protected\\s+)?([A-Za-z0-9_,:\\s<>]+)']),
  },
  ruby: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*def\\s+([A-Za-z_][\\w!?=]*)\\b']),
    classPatterns: makePatterns(['^\\s*class\\s+([A-Za-z_][\\w:]*)\\b', '^\\s*module\\s+([A-Za-z_][\\w:]*)\\b']),
    importPatterns: makePatterns(['^\\s*require\\s+[\'"]([^\'"]+)[\'"]', '^\\s*require_relative\\s+[\'"]([^\'"]+)[\'"]']),
    inheritPatterns: makePatterns(['^\\s*class\\s+[A-Za-z_][\\w:]*\\s*<\\s*([A-Za-z_][\\w:]*)']),
  },
  swift: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*(?:public\\s+|internal\\s+|private\\s+)?(?:func|init)\\s+([A-Za-z_][\\w]*)?\\s*\\(']),
    classPatterns: makePatterns(['^\\s*(?:public\\s+|internal\\s+|private\\s+)?(?:class|struct|enum|protocol)\\s+([A-Za-z_][\\w]*)\\b']),
    importPatterns: makePatterns(['^\\s*import\\s+([A-Za-z0-9_.,\\s]+)']),
    inheritPatterns: makePatterns(['^\\s*(?:class|struct|enum|protocol)\\s+[A-Za-z_][\\w]*\\s*:\\s*([A-Za-z0-9_,\\s]+)']),
  },
  kotlin: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*(?:fun|constructor)\\s+([A-Za-z_][\\w]*)?\\s*\\(']),
    classPatterns: makePatterns(['^\\s*(?:data\\s+)?class\\s+([A-Za-z_][\\w]*)\\b', '^\\s*object\\s+([A-Za-z_][\\w]*)\\b', '^\\s*interface\\s+([A-Za-z_][\\w]*)\\b']),
    importPatterns: makePatterns(['^\\s*import\\s+([A-Za-z0-9_.*]+)']),
    inheritPatterns: makePatterns(['^\\s*class\\s+[A-Za-z_][\\w]*\\s*:\\s*([A-Za-z0-9_,\\s<>]+)']),
  },
  csharp: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*(?:public|private|protected|internal)?\\s*(?:static\\s+)?[A-Za-z0-9_<>,\\[\\]\\?]+\\s+([A-Za-z_][\\w]*)\\s*\\(']),
    classPatterns: makePatterns(['^\\s*(?:public\\s+)?(?:class|interface|struct|enum|record)\\s+([A-Za-z_][\\w]*)\\b']),
    importPatterns: makePatterns(['^\\s*using\\s+([A-Za-z0-9_.,\\s]+);']),
    inheritPatterns: makePatterns(['^\\s*(?:class|interface|struct|record)\\s+[A-Za-z_][\\w]*\\s*:\\s*([A-Za-z0-9_,\\s<>]+)']),
  },
  scala: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*(?:def|val)\\s+([A-Za-z_][\\w]*)\\b']),
    classPatterns: makePatterns(['^\\s*(?:class|trait|object|enum)\\s+([A-Za-z_][\\w]*)\\b']),
    importPatterns: makePatterns(['^\\s*import\\s+([A-Za-z0-9_.,{}\\s]+)']),
    inheritPatterns: makePatterns(['^\\s*class\\s+[A-Za-z_][\\w]*\\s+extends\\s+([A-Za-z0-9_.]+)', '^\\s*trait\\s+[A-Za-z_][\\w]*\\s+extends\\s+([A-Za-z0-9_.]+)']),
  },
  php: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*function\\s+([A-Za-z_][\\w]*)\\s*\\(']),
    classPatterns: makePatterns(['^\\s*(?:abstract\\s+|final\\s+)?class\\s+([A-Za-z_][\\w]*)\\b', '^\\s*interface\\s+([A-Za-z_][\\w]*)\\b', '^\\s*trait\\s+([A-Za-z_][\\w]*)\\b']),
    importPatterns: makePatterns(['^\\s*use\\s+([A-Za-z0-9_\\\\]+);', '^\\s*require_once?\\s*[\'"]([^\'"]+)[\'"]']),
    inheritPatterns: makePatterns(['^\\s*class\\s+[A-Za-z_][\\w]*\\s+extends\\s+([A-Za-z0-9_\\\\]+)', '^\\s*class\\s+[A-Za-z_][\\w]*\\s+implements\\s+([A-Za-z0-9_,\\s_\\\\]+)']),
  },
  julia: {
    kind: 'code',
    functionPatterns: makePatterns([
      '^\\s*function\\s+([A-Za-z_][\\w!]*)\\s*\\(',
      '^\\s*([A-Za-z_][\\w!]*)\\s*\\([^)]*\\)\\s*(?:where\\s+[A-Za-z0-9_,\\s]+\\s*)?=',
    ]),
    classPatterns: makePatterns([
      '^\\s*(?:mutable\\s+)?struct\\s+([A-Za-z_][\\w!]*)\\b',
      '^\\s*abstract\\s+type\\s+([A-Za-z_][\\w!]*)\\b',
      '^\\s*module\\s+([A-Za-z_][\\w!]*)\\b',
    ]),
    importPatterns: makePatterns(['^\\s*(?:using|import)\\s+([A-Za-z0-9_.]+)']),
    inheritPatterns: makePatterns(['^\\s*(?:mutable\\s+)?struct\\s+[A-Za-z_][\\w!]*\\s*<:\\s*([A-Za-z0-9_.]+)']),
  },
  lua: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*function\\s+([A-Za-z_][\\w\\.]*)\\s*\\(']),
    classPatterns: makePatterns([]),
    importPatterns: makePatterns(['^\\s*require\\s*\\(?\\s*[\'"]([^\'"]+)[\'"]']),
    inheritPatterns: makePatterns([]),
  },
  zig: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*pub\\s+fn\\s+([A-Za-z_][\\w]*)\\s*\\(']),
    classPatterns: makePatterns(['^\\s*(?:pub\\s+)?(?:const|var)\\s+([A-Za-z_][\\w]*)\\s*=\\s*struct\\b']),
    importPatterns: makePatterns(['^\\s*const\\s+[A-Za-z_][\\w]*\\s*=\\s*@import\\("([^"]+)"\\)']),
    inheritPatterns: makePatterns([]),
  },
  powershell: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*function\\s+([A-Za-z_][\\w-]*)\\b']),
    classPatterns: makePatterns(['^\\s*class\\s+([A-Za-z_][\\w-]*)\\b']),
    importPatterns: makePatterns(['^\\s*Import-Module\\s+([A-Za-z0-9_.-]+)']),
    inheritPatterns: makePatterns(['^\\s*class\\s+[A-Za-z_][\\w-]*\\s*:\\s*([A-Za-z_][\\w-]*)']),
  },
  elixir: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*defp?\\s+([A-Za-z_][\\w!?]*)\\s*\\(']),
    classPatterns: makePatterns(['^\\s*defmodule\\s+([A-Za-z0-9_.]+)\\s+do']),
    importPatterns: makePatterns(['^\\s*import\\s+([A-Za-z0-9_.]+)', '^\\s*alias\\s+([A-Za-z0-9_.]+)']),
    inheritPatterns: makePatterns([]),
  },
  objc: {
    kind: 'code',
    functionPatterns: makePatterns(['^\\s*-\\s*\\([^\\)]+\\)\\s*([A-Za-z_][\\w]*)\\s*\\:', '^\\s*\\+\\s*\\([^\\)]+\\)\\s*([A-Za-z_][\\w]*)\\s*\\:']),
    classPatterns: makePatterns(['^\\s*@interface\\s+([A-Za-z_][\\w]*)\\b', '^\\s*@implementation\\s+([A-Za-z_][\\w]*)\\b', '^\\s*@protocol\\s+([A-Za-z_][\\w]*)\\b']),
    importPatterns: makePatterns(['^\\s*#import\\s+[<"]([^>"]+)[>"]', '^\\s*#include\\s+[<"]([^>"]+)[>"]']),
    inheritPatterns: makePatterns(['^\\s*@interface\\s+[A-Za-z_][\\w]*\\s*:\\s*([A-Za-z_][\\w]*)']),
  },
};

for (const language of ['javascript', 'typescript']) {
  LANGUAGE_CONFIGS[language] = {
    kind: 'code',
    functionPatterns: makePatterns([
      '^\\s*(?:export\\s+default\\s+)?(?:async\\s+)?function\\s+([A-Za-z_][\\w]*)\\s*\\(',
      '^\\s*(?:export\\s+)?(?:const|let|var)\\s+([A-Za-z_][\\w]*)\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_][\\w]*)\\s*=>',
      '^\\s*(?:export\\s+)?class\\s+([A-Za-z_][\\w]*)\\b',
      '^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+([A-Za-z_][\\w]*)\\s*\\(',
    ]),
    classPatterns: makePatterns([
      '^\\s*(?:export\\s+)?class\\s+([A-Za-z_][\\w]*)\\b',
      '^\\s*interface\\s+([A-Za-z_][\\w]*)\\b',
      '^\\s*type\\s+([A-Za-z_][\\w]*)\\b',
      '^\\s*enum\\s+([A-Za-z_][\\w]*)\\b',
    ]),
    importPatterns: makePatterns([
      '^\\s*import\\s+.*?from\\s+[\'"]([^\'"]+)[\'"]',
      '^\\s*import\\s+[\'"]([^\'"]+)[\'"]',
      '^\\s*const\\s+.*?=\\s*require\\([\'"]([^\'"]+)[\'"]\\)',
      '^\\s*import\\s+type\\s+.*?from\\s+[\'"]([^\'"]+)[\'"]',
    ]),
    inheritPatterns: makePatterns([
      '^\\s*class\\s+[A-Za-z_][\\w]*\\s+extends\\s+([A-Za-z0-9_$.<>]+)',
      '^\\s*(?:class|interface|type)\\s+[A-Za-z_][\\w]*\\s+implements\\s+([A-Za-z0-9_,\\s$.<>]+)',
    ]),
  };
}

function languageFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_LANGUAGE[ext] || null;
}

function getLanguageConfig(language) {
  return LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS.generic;
}

function listSupportedLanguages() {
  return Object.keys(LANGUAGE_CONFIGS).filter((name) => name !== 'generic').sort();
}

module.exports = {
  EXTENSION_LANGUAGE,
  LANGUAGE_CONFIGS,
  getLanguageConfig,
  languageFromPath,
  listSupportedLanguages,
};
