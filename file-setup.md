# File & Folder Setup

The repository follows a clean, layered layout that keeps the core loop, tools, and future extensions separate.

```
pi-memo/                     # Root of the project (git repo)
├─ src/                     # All TypeScript source code
│  ├─ core/                 # Core loop engine and infrastructure
│  │   ├─ types.ts           # Shared type definitions (AgentMessage, Event, etc.)
│  │   ├─ event-stream.ts    # Generic async push‑pull queue implementation
│  │   ├─ agent-loop.ts      # `agentLoop`, `agentLoopContinue`, `runLoop`
│  │   ├─ llm-boundary.ts    # Stub for streaming LLM responses (future plug‑in)
│  │   └─ tool-runner.ts     # Dispatcher for the four primitive tools
│  ├─ tools/                # Primitive tool implementations
│  │   ├─ read.ts            # Line‑range aware file reader (prevents token blow‑up)
│  │   ├─ write.ts           # Create/overwrite a file (with optional dirs)
│  │   ├─ edit.ts            # Exact‑match replace + diff log
│  │   └─ bash.ts            # Sandboxed shell runner, timeout & output caps
│  └─ adapters/              # Integration entry points (e.g., Harbor)
│      └─ harbor-agent.ts    # CLI wrapper for Harbor benchmark harness
├─ eval/                    # Evaluation scaffolding (fixtures, ablation scripts)
│  ├─ fixtures/            # Sample multi‑turn bug‑fix scenarios (added later)
│  └─ run-ablations.ts     # Stub for later ablation runs
├─ .pi-memo/                # Memory artifacts (episodes, distilled rules)
│  ├─ episodes.jsonl       # Append‑only episodic log (E_t)
│  └─ rules.md             # Procedural rules bank (G_t)
├─ .gitignore               # Standard ignores + node_modules, build output
├─ package.json              # npm manifest (scripts, dependencies)
├─ tsconfig.json            # TypeScript compiler configuration
└─ README.md                # Project overview & quick‑start guide
```

**Notes**
- All source lives under `src/`; compiled JavaScript will be emitted to `dist/` (configured in `tsconfig.json`).
- The `.pi-memo/` directory is deliberately excluded from version control (add to `.gitignore`) because it stores runtime‑generated memory artifacts.
- Future modules (e.g., `src/compaction/`, `src/memory/`, `src/guards/`) will be added as the harness grows.
