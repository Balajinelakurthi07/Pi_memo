# Project Plan – Pi‑Memo Harness

## Overview
The project is split into **four milestones** aligning with the architecture described earlier.  Each milestone builds on the previous one and is deliberately independent so you can verify correctness before moving on.

| Milestone | Core Goal | Key Deliverables | Approx. Days |
|----------|-----------|------------------|--------------|
| **1** | Minimal Pi‑style loop & four primitive tools (TypeScript) | `src/core/*`, `src/tools/*`, basic `EventStream`, stub LLM, toy fixture, working `npm run start` demo | 5‑6 |
| **2** | Deterministic guards & two‑stage compaction | Loop detector, verification gate, compaction stages, updated `prepareNextTurn` logic | 4 |
| **3** | Dual‑layer experience memory (`E_t`, `G_t`) | Episode logger, pattern distiller, rule retriever, `.pi-memo/episodes.jsonl`, `rules.md` | 4 |
| **4** | Harbor integration & evaluation suite | `src/adapters/harbor-agent.ts`, ablation scripts, benchmark runs, README with results | 4 |

---

## Milestone 1 Detailed Steps (Phase 1)
1. **Initialize repo & tooling** – `npm init -y`, add TypeScript, ts-node, @types/node.
2. **Create folder skeleton** – as outlined in `file-setup.md`.
3. **Add core TypeScript files** – `types.ts`, `event‑stream.ts`, `agent-loop.ts`, `llm‑boundary.ts`, `tool‑runner.ts`.
4. **Implement the four primitives** – `read.ts`, `write.ts`, `edit.ts`, `bash.ts`.
5. **Write a tiny driver** (`src/index.ts`) that starts the loop with a simple task description and limits turns.
6. **Add a fixture** (`eval/fixtures/simple-fix/`) containing a broken file and a test script.
7. **Verify** – `npx ts-node src/index.ts` should execute a read → edit → bash sequence and finish with an `end` event.
8. **Commit** – ensure all source files are tracked; add a `.gitignore` that excludes `node_modules/`, `dist/`, and `.pi-memo/`.

---

## Phase 1 Completion Checklist
- [ ] `npm run build` succeeds (no TypeScript errors).
- [ ] `src/index.ts` runs and prints turn summaries.
- [ ] Fixture task is resolved (e.g., a failing test is fixed and passes).
- [ ] `README.md` contains **Build & Run** instructions.
- [ ] `architecture.md`, `file-setup.md`, `plan.md` and `milestones.md` are present in the artifact directory.

Once these items are checked, you can move on to Milestone 2.
