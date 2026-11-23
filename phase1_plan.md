# Phase 1 – Minimal Pi‑Style Loop & Core Tools (TypeScript)

## Goal
Create a runnable TypeScript skeleton that implements:
1. **EventStream** – asynchronous push‑pull queue for agent events.
2. **Core loop** – `agentLoop`, `runLoop`, `streamAssistantResponse` wiring.
3. **Four primitive tools** – `read`, `write`, `edit`, `bash`.
4. **Smoke‑test harness** using a few local fixture tasks.

---

## Repository Layout (initial)
```
pi-memo/
├─ src/
│  ├─ core/
│  │   ├─ types.ts                # AgentMessage, AgentEvent, LoopConfig, Hook signatures
│  │   ├─ event-stream.ts         # Simple async queue implementation
│  │   ├─ agent-loop.ts           # agentLoop, agentLoopContinue, runLoop
│  │   ├─ llm-boundary.ts         # Stub for streaming LLM responses (future plug‑in)
│  │   └─ tool-runner.ts          # Dispatcher for the 4 core tools
│  ├─ tools/
│  │   ├─ read.ts                # File‑read primitive (range‑aware, line‑limited)
│  │   ├─ write.ts               # Create/overwrite files
│  │   ├─ edit.ts                # Exact‑match replace with diff logging
│  │   └─ bash.ts                # Sandboxed exec, stdout/err truncation, timeout
│  └─ adapters/
│      └─ harbor-agent.ts        # Placeholder CLI entry point for future Harbor integration
├─ eval/
│  ├─ fixtures/                  # Example multi‑turn bug‑fix scenarios (will be added)
│  └─ run-ablations.ts           # Stub for later ablation scripts
├─ .pi-memo/                     # Memory artifacts (episodes.jsonl, rules.md) – empty now
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## Step‑by‑Step Action Plan
| Day | Activity | Expected Outcome |
|-----|----------|------------------|
| **Day 1** | `npm init -y` → add TypeScript dev dependencies (`typescript`, `ts-node`, `@types/node`). Create `tsconfig.json` with `es2022` target, `moduleResolution: node`, `strict: true`. | Ready to compile TS files. |
| **Day 2** | Add **core** files: `src/core/types.ts`, `src/core/event‑stream.ts`, `src/core/agent-loop.ts`. | Core scaffolding ready. |
| **Day 3** | Implement **tool runner** and **primitives**: `src/tools/read.ts`, `src/tools/write.ts`, `src/tools/edit.ts`, `src/tools/bash.ts`; wire them in `src/core/tool-runner.ts`. |
| **Day 4** | Add **stub LLM boundary** (`src/core/llm‑boundary.ts`) and a tiny **fixture** under `eval/fixtures/simple‑fix/`. |
| **Day 5** | Write a **driver script** (`src/index.ts`) that boots `agentLoop` with the fixture task description, runs up to 10 turns, and prints summaries. |
| **Day 6** | **Documentation**: populate `README.md`, commit repository. |

---

## Deliverables After Phase 1
1. Complete folder hierarchy committed.
2. Working TypeScript compilation (`npm run build`).
3. Minimal end‑to‑end execution on a toy fixture.
4. This `phase1_plan.md` file stored in the project root.

---

## Next Steps
When you’re ready, let me know if you’d like me to generate the actual TypeScript source files listed above, or if you prefer a walkthrough of the `npm`/`ts-node` bootstrap commands.
