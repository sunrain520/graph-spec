const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { extract } = require('../src/extract');

function tmpFile(name, content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-extract-'));
  const file = path.join(root, name);
  fs.writeFileSync(file, content, 'utf8');
  return { root, file };
}

const samples = [
  ['sample.py', `import os\n\n# WHY: keep this simple\ndef hello(x):\n    return x + 1\n\nclass Greeter:\n    def greet(self):\n        return hello(1)\n`],
  ['sample.js', `import fs from 'node:fs'\nexport function hello(x) { return x + 1 }\nexport class Greeter { greet() { return hello(1) } }\n`],
  ['sample.go', `package main\nimport \"fmt\"\nfunc Hello(x int) int { return x + 1 }\ntype Greeter struct{}\nfunc (g Greeter) Greet() int { return Hello(1) }\n`],
  ['sample.rs', `use std::fmt;\npub fn hello(x: i32) -> i32 { x + 1 }\npub struct Greeter;\nimpl Greeter { pub fn greet(&self) -> i32 { hello(1) } }\n`],
  ['sample.java', `import java.util.List;\npublic class Greeter { public static int hello(int x) { return x + 1; } }\n`],
  ['sample.c', `#include <stdio.h>\nint hello(int x) { return x + 1; }\nstruct Greeter { int x; };\n`],
  ['sample.cpp', `#include <vector>\nclass Greeter : public Base { public: int hello(int x) { return x + 1; } };\n`],
  ['sample.rb', `require 'json'\nclass Greeter\n  def hello(x)\n    x + 1\n  end\nend\n`],
  ['sample.swift', `import Foundation\nclass Greeter: Base { func hello(_ x: Int) -> Int { return x + 1 } }\n`],
  ['sample.kt', `import kotlin.io.*\nclass Greeter : Base() { fun hello(x: Int) = x + 1 }\n`],
  ['sample.cs', `using System;\npublic class Greeter : Base { public static int Hello(int x) => x + 1; }\n`],
  ['sample.scala', `import scala.util.*\nclass Greeter extends Base { def hello(x: Int) = x + 1 }\n`],
  ['sample.php', `<?php\nuse Foo\\\\Bar;\nclass Greeter extends Base { function hello($x) { return $x + 1; } }\n`],
  ['sample.jl', `using LinearAlgebra\n\nmodule Greeter\nexport hello\n\nstruct Widget\nend\n\nhello(x) = x + 1\nfunction greet(x)\n    hello(x)\nend\n\nend\n`],
  ['sample.lua', `local json = require('json')\nfunction hello(x) return x + 1 end\n`],
  ['sample.zig', `const std = @import(\"std\");\npub fn hello(x: i32) i32 { return x + 1; }\n`],
  ['sample.ps1', `Import-Module Pester\nfunction Hello { param($x) $x + 1 }\n`],
  ['sample.ex', `defmodule Greeter do\n  def hello(x), do: x + 1\nend\n`],
  ['sample.m', `#import <Foundation/Foundation.h>\n@interface Greeter : Base\n- (int)hello:(int)x;\n@end\n`],
];

test('extract supports all target code extensions', () => {
  for (const [name, content] of samples) {
    const { file } = tmpFile(name, content);
    const result = extract(file);
    assert.ok(result.nodes.length >= 1, name);
    assert.ok(result.nodes.some((node) => node.kind === 'file'), name);
    assert.ok(result.nodes.some((node) => node.kind !== 'file'), name);
  }
});

test('extract creates rationale nodes and call edges', () => {
  const { file } = tmpFile('sample.py', `# NOTE: keep for later\n\ndef hello(x):\n    return x + 1\n\ndef greet():\n    return hello(1)\n`);
  const result = extract(file);
  assert.ok(result.nodes.some((node) => node.kind === 'rationale'));
  assert.ok(result.edges.some((edge) => edge.relation === 'calls'));
});

test('extract produces section nodes for markdown', () => {
  const { file } = tmpFile('notes.md', `# Intro\nThis is a note.\n\n## Details\nWe should keep this.\n`);
  const result = extract(file);
  assert.ok(result.nodes.some((node) => node.kind === 'section'));
});
