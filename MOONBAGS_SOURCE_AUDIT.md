# MoonBags Source Audit — 2026-05-10

Three-agent audit of upstream MoonBags source code at
`/Users/marcelyuwono/Trading Project Files/moonbags/src/`.

Target: fix bugs and add logging before manual dry-run experimentation.

Safety: `safetyImmutables.ts` already ported and wired into upstream
`config.ts` (startup DRY_RUN assertion + runtime settings validation).

---

## P0: Calculation Bugs (fix first)

### P0-1. BigInt precision loss in partial sells

**Files:** `positionManager.ts` lines 833, 916, 1036
**Affects:** `partialSellForTakeProfit`, `partialSellAndMoonbag`,
`partialSellPosition`

**Bug:** `BigInt(Math.floor(Number(totalTokens) * target.sellPct))` converts
totalTokens to Number, losing precision beyond 2^53. Token balances with 9
decimals routinely exceed this (e.g. 10B tokens = 10^19 raw).

**Fix:** Use scaled BigInt arithmetic:
```typescript
const sellTokens = totalTokens * BigInt(Math.round(sellPct * 10000)) / 10000n;
```

### P0-2. `maybeRatioPct` ambiguous ratio-vs-percentage conversion

**File:** `gmgnSignalSource.ts` lines 506-509

**Bug:** Function guesses whether GMGN returns ratio (0-1) or percentage. Any
value in [0,1] is multiplied by 100. If API returns `0.5` meaning 0.5%, result
is 50% — 100x inflation. Affects `bundlerPct`, `top10Pct`, `ratTraderPct`,
`creatorBalancePct` throughout the file (lines 422-428, 993-1001, 1088-1094,
1111, 1349-1355). Also affects score calculation at line 521 (`top10Pct / 4`
penalty).

**Fix:** Determine GMGN API convention per field from cached docs or empirical
testing. Hardcode conversion per field instead of guessing. At minimum log a
warning when a value in (0,1] is converted.

### P0-3. `floorPnlPct` heartbeat calculation is mathematically wrong

**File:** `positionManager.ts` line 1320

**Bug:** Uses `peakPnlPct - trailPct * 100` (subtractive). Correct formula is
multiplicative drawdown from peak. At peak +234% with 55% trail:
- Current formula: floor = 234 - 55 = +179% (WRONG)
- Correct: peakMultiple = 3.34, floor = 3.34 * 0.45 = 1.503, floor = +50.3%

The operator sees +179% floor and thinks the trail is very comfortable when the
actual floor is +50.3%. This misleads exit decisions.

**Fix:**
```typescript
const peakMultiple = 1 + peakPnlPct / 100;
const floorMultiple = peakMultiple * (1 - trailPct);
const floorPnlPct = (floorMultiple - 1) * 100;
```

### P0-4. `getTokenDecimals` permanently caches wrong value on RPC failure

**File:** `jupClient.ts` lines 267-287

**Bug:** On RPC failure, defaults to 6 decimals and caches permanently. If token
has 9 decimals, all price/amount calculations off by 1000x for the rest of the
session. Cache key is the mint, so re-fetching never happens.

**Fix:** Do not cache the fallback value. Either skip the cache set on failure,
or use a TTL/sentinel that triggers re-fetch next access.

---

## P1: Silent Catch Blocks (add logging)

All follow the same pattern: replace `catch {}` or `catch { /* comment */ }`
with a catch that checks for ENOENT (expected) and logs a warning for anything
else.

### P1-C1. `positionManager.ts` line 73

`appendClosedTrade` inner read. Corrupt `closed.json` silently destroyed and
rewritten — all trade history lost.

### P1-C2. `positionManager.ts` lines 91-93

`getClosedTrades` returns empty on corruption. Dashboard shows zero trades.

### P1-C3. `positionManager.ts` line 347

`recordStranded` inner read. Same pattern for `stranded.json`.

### P1-C4. `llmMemory.ts` line 239

`appendLlmTradeRecord` inner read. Corrupt `llm_decisions.json` silently
overwritten.

### P1-C5. `llmMemory.ts` line 294

`appendLlmPromptAudit` inner read. Corrupt audit file silently overwritten.

### P1-C6. `llmMemory.ts` lines 261-263

`readLlmTradeRecords` returns empty on corruption. LLM track record injection
stops working.

### P1-C7. `sourceDedupe.ts` line 19

`loadFromDisk` swallows corrupt state. Dedupe tracking reset silently.

### P1-C8. `sourceDedupe.ts` line 29

`saveToDisk` swallows write failures. Disk full = no signal.

### P1-C9. `config.ts` lines 154, 337, 349

`loadRuntimeFlags` boot catch (line 154 and inner at 337). Corrupt
`runtimeFlags.json` silently ignored — Telegram toggles revert on restart.
`saveRuntimeFlags` (line 349) swallows write failures — toggle changes lost.

### P1-C10. `jupClient.ts` lines 121-123

`scanEmptyTokenAccounts` returns empty on RPC failure. Operator sees "0
reclaimable" when RPC is down.

### P1-C11. `jupClient.ts` lines 241-243

`getWalletAddress` returns null on corrupt `PRIV_B58`. Operator sees "wallet:
unknown" with no explanation.

### P1-C12. `gmgnClient.ts` lines 228-230

JSON parse failure. Invalid GMGN JSON silently treated as raw string.

---

## P1: Unlogged State Transitions (add log lines)

### P1-I1. `positionManager.ts` lines 459-461

Duplicate mint at position level silently returns existing position. Distinct
from source-level dedupe. Add debug log.

### P1-I2. `positionManager.ts` around line 598

Price source selection (batch vs sell-quote fallback) not logged. Operator can't
tell which price source is being used.

### P1-I3. `positionManager.ts` lines 644-647

`entryPricePerTokenSol <= 0` early return. Data integrity issue skipped every
tick with no log.

### P1-I4. `positionManager.ts` around line 497

Entry price source selection (sell-quote vs buy-amount) not logged. Entry
price = 0 when both fail — no warning.

### P1-I5. `positionManager.ts` lines 723-726

Sell retry cooldown suppression not logged. Exit trigger fired but sell is
within cooldown. Operator sees position alive, doesn't know why.

### P1-I6. `positionManager.ts` lines 629-631

Moonbag sell cooldown suppression. Same as I5 for moonbag branch.

### P1-I7. `positionManager.ts` line 1344

LLM advisor skips position when prices are zero/negative. No log explaining
why LLM never fires.

### P1-I8. `positionManager.ts` line 1406

LLM consult returns null (API error/parse failure). No log distinguishing
transient timeout from persistent config issue.

### P1-I9. `positionManager.ts` lines 825-830

Zero wallet balance silently closes position as "manual". Same at lines 909
and 1029. No log explaining what happened.

### P1-I10. `positionManager.ts` lines 919-922

Moonbag keepPct too high, nothing to sell. Silently returns.

### P1-I11. `priceFeed.ts` lines 74-76

Jupiter V3 batch non-OK response. Mints get null prices, no log distinguishing
"not listed" from "API down".

### P1-I12. `llmExitAdvisor.ts` line 1358

LLM decision `reason` field not included in log. The reason is the most
important context for dry-run iteration.

---

## P2: Operational Bugs (fix)

### P2-1. Watchlist negative price changes clamped to 0

**File:** `gmgnSignalSource.ts` lines 1256-1258

**Bug:** `Math.max(0, ...)` on change1m/5m/1h. Crashing tokens appear to have
0% change. Trend detection never sees "falling" for watchlist candidates.

**Fix:** Remove `Math.max(0, ...)`. Use `Number(meta.change1m ?? 0) || 0`.

### P2-2. `LLM_HEARTBEAT_MINS` persistence bug

**File:** `config.ts` lines 325, 327-339

**Bug:** `PERSISTED_FLAGS` includes `LLM_HEARTBEAT_MINS` (numeric), but
`loadRuntimeFlags` only restores `typeof === "boolean"`. Value silently dropped
on restart.

**Fix:** Check both `typeof === "boolean"` and `typeof === "number"` in the
restore loop, or use `SETTABLE_SPECS[key].type` to determine expected type.

### P2-3. No sell retries (asymmetric with buys)

**File:** `jupClient.ts` lines 455-499

**Bug:** `buyTokenWithSol` retries 20 times. `sellTokenForSol` tries once.
Failed sell = wait 60s for next tick. In fast meme markets, costly.

**Fix:** Add 2-3 fast retries inside `sellTokenForSol`.

---

## P2: Smart Wallet Harvester Porting

**Source:** `tools/wallet-harvester/` in the lab repo (self-contained, zero
imports from lab `src/`).

**Target:** Copy to upstream MoonBags at
`/Users/marcelyuwono/Trading Project Files/moonbags/tools/wallet-harvester/`.

**Steps:**
1. Copy `tools/wallet-harvester/` (minus `data/`, `node_modules/`, `.env`).
2. Add npm scripts to root `package.json`:
   ```
   "harvest:discover", "harvest:run:gmgn", "harvest:status",
   "harvest:export:wallets", "harvest:export:seed-list", "harvest:hypotheses"
   ```
3. Create `tools/wallet-harvester/.env` with GMGN API key + optional OKX creds.
4. Run `npm run harvest:run:gmgn` on cron to accumulate wallet data.

**Do NOT port:** `seedShadowTagger.ts`, `seedShadowCandidateBackfill.ts`,
lab-specific check files, `lab/smart-wallet-seeds/` output artifacts,
`docs/SMART_WALLET_SEED_SPECIES.md`.

---

## P3: Nice-to-Have Logging

### P3-1. `positionManager.ts` after line 581
Log `tickPositions` cycle completion with ticked count and price map size.

### P3-2. `positionManager.ts` line 572
Log `getBatchPricesParallel` failure with mint count before returning empty map.

### P3-3. `gmgnSignalSource.ts` after fetchSeeds
Log seed count per cycle.

### P3-4. `okxDiscoverySource.ts` after fetchSeeds
Same for OKX.

### P3-5. `llmExitAdvisor.ts` lines 1147-1187
Add `pnlPct` and `peakPnlPct` to evidence gate blocked decision logs.

### P3-6. `positionManager.ts` after line 581
`tickPositions` debug log with count.

### P3-7. `llmExitAdvisor.ts` lines 933-934
`buildSimilarCases` only matches bearish keys, ignores proactive. Consider
including both.

---

## Additional Warnings (lower priority)

- `positionManager.ts` lines 565-582 / 1278-1294: Race condition between
  `tickPositions` and `tickLlmAdvisor` on shared mutable position state. Both
  could read `status === "open"` before either writes `"closing"`. Risk:
  double sell attempt. Fix: per-position mutex or compare-and-swap.
- `positionManager.ts` line 853: Entry allocation uses `sellPct` instead of
  actual token fraction sold (BigInt rounding mismatch).
- `jupClient.ts` lines 347-349: `BigInt(raw)` on unvalidated server string.
  Could throw on malformed API response.
- `llmExitAdvisor.ts` lines 62-67: `entryPriceUsd`/`currentPriceUsd` type
  names are actually SOL-denominated. Misleading but functional.
- `llmExitAdvisor.ts` lines 367-369: `fmtNum` silently converts NaN/Infinity
  to 0. Hides upstream calculation bugs from the LLM prompt.
- `notifier.ts` lines 107 etc.: `escapeHtml` applied inside URL href.
  Harmless for base58 but incorrect pattern.
