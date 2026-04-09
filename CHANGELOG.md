# Changelog

## 0.1.0 2026-04-09

- Init: create the Node.js `graph-spec` rewrite plan, repository scaffolding, and compatibility strategy for the `graphify` feature set.
- Add: dynamic output directory resolution via `.graphify_config.json` and explicit `outDir` overrides.
- Add: file discovery and classification for code, docs, papers, images, and Office files with ignore-file support.
- Add: custom graph container, extraction validation, and graph assembly helpers with hyperedge preservation.
- Add: heuristic multi-language extractor for code, docs, papers, and images with rationale and call edges.
- Add: clustering, graph analysis, markdown report rendering, and export helpers for JSON/HTML/SVG/GraphML/Cypher.
- Add: SHA256 file cache, manifest persistence, and an end-to-end pipeline for detect -> extract -> build -> cluster -> export.
- Add: watch, git hook, benchmark, and assistant-install helpers with dynamic output-directory awareness.
- Add: CLI orchestration for build, query, path, explain, config, benchmark, wiki, hooks, and assistant installers.
- Add: npm publish metadata, fixed test runner globbing, and wiki export support wired through the build pipeline.
- Docs: add a full user manual and expand the project README for installation, configuration, commands, and troubleshooting.
- Add: URL ingest, Obsidian vault export, Neo4j Cypher/direct push, and MCP stdio server support with CLI integration.
- Docs: update README and user manual to cover the new add/obsidian/neo4j/mcp workflows.
- Add: Julia `.jl` language support and expand the code extension coverage in extraction tests.
- Docs: add a `graph.json` + LLM workflow section to the README and sync the supported code extension list in the user manual.
