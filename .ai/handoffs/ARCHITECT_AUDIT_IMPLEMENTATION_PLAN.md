# Architect Implementation Plan — Source Audit Fixes
Date: 2026-05-10
Status: COMPLETE (all waves verified, tsc clean)
Source: MOONBAGS_SOURCE_AUDIT.md
Role: Architect (orchestrating Coder + Verifier passes)

---

## Scope

Fix all bugs and add all logging identified in the source audit.
No new features. No live-trading changes. DRY_RUN safety boundaries untouched.

## Execution Order

### Wave 1 — P0 Calculation Bugs (highest risk, fix first)
- P0-1: BigInt precision loss (positionManager.ts ×3)
- P0-3: floorPnlPct formula (positionManager.ts ×1)
- P0-4: getTokenDecimals cache on failure (jupClient.ts ×1)
- P0-2: maybeRatioPct (gmgnSignalSource.ts) — log-first approach

### Wave 2 — P1 Silent Catches (12 locations, batch)
- C1–C12: replace empty catch blocks with ENOENT-aware logging

### Wave 3 — P1 Unlogged State Transitions (12 locations, batch)
- I1–I12: add logger.debug/warn at key state transitions

### Wave 4 — P2 Operational Bugs
- P2-1: Remove Math.max(0) clamp on watchlist price changes
- P2-2: LLM_HEARTBEAT_MINS persistence (config.ts)
- P2-3: Sell retries (jupClient.ts)

### Wave 5 — P3 Nice-to-Have Logging (batch)
- All P3 items

### Wave 6 — Wallet Harvester Port (requires manual file copy from lab repo)

---

## Verifier Checklist (per wave)
1. TypeScript compiles cleanly (tsc --noEmit)
2. No new imports introduced beyond logger
3. DRY_RUN paths untouched
4. safetyImmutables.ts untouched
5. No state/, logs/, .env touched
6. Logic change matches audit spec exactly

---

## Files in scope
- src/positionManager.ts
- src/jupClient.ts
- src/gmgnSignalSource.ts
- src/config.ts
- src/sourceDedupe.ts
- src/llmMemory.ts
- src/priceFeed.ts
- src/llmExitAdvisor.ts
- src/gmgnClient.ts
