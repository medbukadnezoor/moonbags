# MoonBags Lab Product Specification — Slim MVP Edition

Status: Draft v2 (slimmed from v1 after four converging reviews)
Date: 2026-05-03
Target repository: private GitHub fork of `medbukadnezoor/moonbags`
Working name: `moonbags-lab`
Source substrate: MoonBags Solana meme-token trading system

---

## 0. About This Document

This is the **active MVP spec**. It covers only what gets built first, in the
order it gets built, with the safety guarantees that must hold at every step.

Everything that v1 of this spec described and that has been deferred lives in
[`MOONBAGS_LAB_ARCHIVE.md`](./MOONBAGS_LAB_ARCHIVE.md), section by section,
with an explicit `Revisit when:` trigger above each entry. Nothing has been
deleted; postponed work is preserved verbatim where it matters and summarized
where it doesn't, so that bringing it back is a deliberate action triggered by
data, not a rediscovery exercise.

Provider/data policy lives in
[`MOONBAGS_LAB_DATA_TOOLING_ADDENDUM.md`](./MOONBAGS_LAB_DATA_TOOLING_ADDENDUM.md).

Reading order for a new contributor:

1. §1 — what this is
2. §2 — what is non-negotiable
3. §6 — what the MVP looks like architecturally
4. §20 — phased roadmap
5. §24 — initial tickets

If you find yourself wanting to add a module, schema field, report, agent tool,
provider, or species not in this document — first check the archive. If it's
there, the question is "has the trigger fired?" If it's not there, the question
is "what trigger would make me right?" Bring evidence, not enthusiasm.

---

## 1. Executive Summary

MoonBags Lab is a private experimental fork of MoonBags whose single MVP job is
to answer one question:

> Does an LLM-driven exit policy beat default trailing on the same lenient-entry
> universe, after realistic friction, on Solana meme-token markets — and does
> that edge survive sanity replay, A/A controls, and bankroll-survival math?

If the answer is yes after three dry-run cohorts, we expand. If the answer is
no, we cut and ask a different question. The lab exists to deliver that
yes/no quickly, safely, and legibly to the operator.

The hot trading engine remains MoonBags itself — signal ingestion, Jupiter Swap
V2 quotes/execution, position management, hard stops, dry-run mode, state
persistence, dashboard, Telegram controls. Existing LLM advisors
(`src/llmEntryAdvisor.ts`, `src/llmExitAdvisor.ts`, `src/llmMemory.ts`) are the
policy layer; they are not rewritten.

The lab adds a small harness around the existing engine:

- **Two frozen species** in parallel: a Control (default trailing, no LLM
  exits) and a Challenger (existing LLM exit advisor active). Same lenient
  entries. Same hard safety filters. Same friction model.
- **A shared candidate stream** so both species see the same universe.
- **An append-only event journal** with six event types.
- **A friction model (v1 only)** that converts dry-run quotes into more
  realistic predicted fills.
- **A deterministic token safety pre-screener** with five rules and an
  immutable `safetyFloor` that the mutation firewall cannot relax.
- **A minimal scorecard (15 fields)** with vector-dominance promotion gates,
  lower-confidence-bound, and bankroll-survival checks.
- **Manual mutation only** — patches written by the operator (or a human
  reviewer), validated, replayed, and human-approved. No LLM researcher in
  MVP.
- **One operator decision packet** per cohort — `operator_summary.md`, ≤1 page,
  with a "decision requested" section at the top.

The MVP runs entirely dry-run. Live calibration, micro-live probes, paid
provider upgrades beyond Birdeye, social automation, wallet intelligence,
re-entry modes, regime routing, agent researcher loops, and the full data
warehouse are all archived. They re-enter the active spec only when a specific
trigger fires.

The operating philosophy:

> Find out whether a robust edge exists. Do not force the system to hallucinate
> edge from variance. Keep the operator in the driver's seat.

---

## 2. Non-Negotiable Principles

### 2.1 Safety Immutables (with Named Enforcement Layers)

Every immutable below names the layer that enforces it. A "policy" without a
named enforcement layer is a documentation promise, not a guarantee. The MVP
must enforce each at every layer in the chain — not only the topmost.

| Immutable | Enforcement layers |
|---|---|
| `DRY_RUN=true` for all lab species | (a) config loader rejects `DRY_RUN=false` unless launched in the calibration profile; (b) patch validator denylist rejects any patch with `dryRun:false` in genome JSON; (c) runtime assert at species spawn refuses to start if `DRY_RUN!=true`; (d) dashboard refuses to start trader mode without a visible DRY_RUN banner. |
| Wallet keys, `.env`, provider credentials | (a) file ACL — agents and lab processes run as a user without read access to wallet/secret files; (b) config loader explicitly rejects requests for those paths from species code; (c) patch validator forbids any field referencing wallet/credential paths. |
| Hard stops cannot be disabled | (a) `safetyFloor` block in genome is immutable; (b) patch validator computes the *effective* config after patch application and rejects if hard-stop fields fall below floor; (c) position manager refuses to load a species whose effective hard-stop is below floor. |
| Live size cannot be increased | (a) `bankrollEnvelope.maxPositionSizeSol` is operator-set, immutable to LLM; (b) patch validator denylist; (c) execution-side check before quote submission. |
| Execution clients cannot be swapped | (a) `executionClient` field is operator-set in genome; (b) patch validator denylist. |
| Provider write/social-interaction endpoints are blocked | (a) provider client classes never expose write methods; (b) static analysis CI check rejects PRs that import write APIs. |
| LLM researcher cannot exist in MVP | (a) no researcher process exists in MVP; (b) once added, it runs as a separate process with read-only file ACL on configs and read-only access to scorecards. |

The patch validator's job is to compare the **effective post-patch config** to
the safety floor — not just to scan JSON paths against a denylist. A patch
that swaps a stricter `hardFiltersProfile` for a weaker one passes a path check
but violates the floor in effect. The validator must catch both.

### 2.2 Experiment Discipline

- Species are frozen during a cohort.
- Mutations occur only between cohorts.
- Every mutation must include hypothesis, expected effect, falsifier, simpler
  baseline, and unchanged-safety-boundaries list.
- Every cohort produces one scorecard.
- Promotion uses **vector dominance**, not raw PnL.
- Near-misses must be logged, not only trades taken.
- Every decision must be traceable to a config hash and prompt hash.

### 2.3 Quantitative Integrity

- Goal: detect a repeatable edge, not win one cohort.
- Friction model produces both raw quote PnL and friction-adjusted PnL for
  every closed trade. Promotion uses friction-adjusted only.
- A/A controls run before any species comparison is trusted.
- Lower-confidence-bound promotion gate prevents one-trade-miracle promotions.
- Bankroll-survival math runs on every cohort, even at zero capital.
- Outlier-removed and largest-winner-removed PnL are mandatory scorecard
  fields.

### 2.4 Operator Comprehension

- The operator is the final arbiter. The system never asks for blind approval.
- Every cohort produces **one** required-reading artifact: `operator_summary.md`,
  ≤1 page, with the "decision requested" section at the top.
- Every patch produces an operator summary alongside the JSON.
- The operator can stop the system without developer help (panic-stop CLI,
  tested before any live work).
- If the operator cannot explain in one sentence why a species won, it is not
  promotable.

### 2.5 Financial Survival

`Whatever it takes` for an edge means: ruthless measurement, harsh dry-run
cohorts, and only paid data when measurable edge improves. It does not mean
accepting bankruptcy risk, scaling size to rescue weak statistics, accepting
account-ending tail losses, martingale, or lottery payoffs.

Hard rules (enforced — see §15):

- A live edge is invalid if it requires the operator to survive unacceptable
  losing streaks.
- A 1% win-rate strategy needing a 1000x recovery winner is **not** live-eligible.
- A 99% win-rate strategy where one realistic loss can wipe the account is
  **not** live-eligible.
- Every live phase has an explicit bankroll envelope.
- Position size derives from bankroll envelope and loss limits, not from model
  confidence.
- Multiple-entry / scale-in / pyramid / round-trip modes are **forbidden** in
  MVP. Re-entry stays at `disabled` or `shadow_after_close` only.
- LLMs and mutation patches may never increase live size, daily/weekly loss
  limits, or bankroll exposure.

### 2.6 Override Authority Split

Two override categories. The system does not collapse them.

```text
statistical_override_allowed:
  Operator can override weak comparison, ambiguous lower-bound,
  regime-specific result, or insufficient confidence.
  Requires reason recorded in promotion_decision.md.

safety_override_forbidden:
  Operator (or LLM, or anyone) cannot override DRY_RUN, hard stops,
  bankroll envelope, max position size, daily loss cap,
  token-safety hard blocks, martingale detection, mutation immutables,
  or the live arming process.
```

Promotion rules, dashboard, and decision cards must reflect this split.
"Operator approved" is never a path around capital protection.

---

## 3. Goals

### 3.1 Primary Goal (MVP)

Validate or invalidate the single hypothesis above (does the LLM exit advisor
beat default trailing after friction?) within three dry-run cohorts.

### 3.2 Practical Definition Of Edge

A species has candidate edge only when it:

- outperforms control after friction adjustment,
- does not increase max drawdown beyond tolerance,
- does not worsen p95 tail loss beyond tolerance,
- has at least the configured minimum trade count,
- survives sanity replay against a prior cohort,
- does not depend on one anomalous trade (largest-winner-removed PnL ≥ 0),
- maintains acceptable LLM cost and latency,
- passes bankroll-envelope and risk-of-ruin checks even at zero live capital.

### 3.3 MVP Outcomes

The MVP produces:

- repeatable cohorts with frozen species,
- a parseable journal,
- friction-adjusted scorecards,
- a champion/challenger record,
- one decision packet per cohort,
- a clear yes/no on the primary hypothesis.

It does not produce: edge ledgers as separate subsystems, social signal
analytics, wallet intelligence dashboards, regime routers, micro-live
calibration, or LLM-driven config mutation. Those live in the archive.

### 3.4 Edge Channel Tagging (lightweight)

Every patch and every cohort scorecard carries one `edgeChannel` tag from this
fixed list:

```
discovery
entry_selection
entry_timing
exit_timing
no_trade_discipline
execution_advantage
```

This is one tag, not a subsystem. The full Edge Ledger with hypothesis IDs,
required evidence, and channel-specific scorecards is archived (see Archive
Part I). For MVP, the tag exists so the operator can ask "what kind of edge are
we testing?" without standing up new infrastructure.

---

## 4. Non-Goals (MVP)

- End-to-end LLM trading on every tick.
- Replacing MoonBags execution logic.
- LLM researcher / critic / mutation loop.
- DSPy / GEPA prompt optimization.
- Optuna numeric optimization.
- Multi-species (>2) cohorts.
- Re-entry beyond `disabled` / `shadow_after_close`.
- Regime routing.
- Social automation (Telegram bot ingestion, GetXAPI client). Manual CSV import
  only.
- Wallet intelligence dataset (copyability, KOL side-wallet hypothesis,
  cluster decorrelation, obfuscation discount).
- Bronze/Silver/Gold warehouse with ClickHouse migration triggers.
- Object storage migration.
- Capability cards / decision cards / Grill Gates / AI Coding Dictionary as a
  formal documentation system.
- Profile-based configuration with multiple profile groups.
- Live calibration probes.
- Paid providers beyond Birdeye OHLCV usage.

---

## 5. Current MoonBags Substrate

MoonBags already provides almost everything the lab needs for the hot path.
The MVP does not rewrite it.

Existing files the MVP depends on:

- `src/main.ts` — orchestrates scanners, buys, dashboard, Telegram, LLM ticks.
- `src/config.ts` — loads `DRY_RUN`, dashboard port, LLM provider config.
- `src/settingsStore.ts` — persists runtime settings in `state/settings.json`.
- `src/gmgnSignalSource.ts`, `src/okxDiscoverySource.ts`, `src/scgPoller.ts` —
  candidate discovery.
- `src/jupClient.ts` — Jupiter Swap V2 quotes/execute.
- `src/positionManager.ts` — open/close/partial exits, hard stops, LLM exit
  integration.
- `src/llmEntryAdvisor.ts` — structured LLM entry gate.
- `src/llmExitAdvisor.ts` — structured LLM exit advisor with deterministic
  evidence gating (54 KB; the most substantial advisor in the repo).
- `src/llmMemory.ts` — LLM decision/audit memory.
- `src/server.ts` — dashboard/API.
- `src/telegramBot.ts` — operator controls.

Known constraints to address in Phase A:

- Several modules hardcode `path.resolve("state")` — must route through a
  central `paths.ts` helper before two instances can run concurrently.
- Dry-run buy/sell paths in `jupClient.ts` quote Jupiter Swap V2 `/order` and
  treat `outAmount` as simulated fill. Useful but optimistic; friction v1 (§12)
  layers on top.

---

## 6. MVP Architecture

```text
moonbags-lab worktree
  |
  |-- MoonBags hot path (existing, unchanged)
  |     signal intake
  |     hard safety filters
  |     LLM entry / exit advisors (existing)
  |     Jupiter quote/execute
  |     position manager
  |     dashboard, Telegram
  |
  |-- Lab harness (new, ~12 modules)
  |     paths.ts            (state/log/port isolation)
  |     genome.ts           (load + validate genome JSON)
  |     cohort.ts           (start/collect/score/stop)
  |     journal.ts          (append-only writer, 6 event types)
  |     friction.ts         (v1 only)
  |     safety.ts           (token safety pre-screener + safetyFloor)
  |     scorecard.ts        (15 fields)
  |     patch.ts            (schema + validator + safetyFloor enforcement)
  |     replay.ts           (sanity-twin against prior cohort)
  |     bankroll.ts         (envelope math, lottery + blow-up rejection)
  |     report.ts           (operator_summary.md generator)
  |     cli.ts              (lab:* commands)
  |
  |-- Live arming process (separate, not active in MVP)
        Built as scaffolding only. Cannot run until §18 gate passes.
```

### 6.1 Hot Path Rules (unchanged from v1)

Allowed:
- deterministic hard filters,
- direct structured LLM calls through existing advisors,
- schema validation,
- deterministic evidence gates,
- Jupiter quote/execute,
- position accounting.

Forbidden:
- LLM tool execution,
- runtime prompt rewriting,
- automatic strategy mutation,
- multi-agent debate,
- agent file edits,
- any process that has not been explicitly listed.

### 6.2 Lab Controller

Owns: cohort lifecycle, species lifecycle, process launch and isolation,
journal collection, scorecard generation, manual patch validation, promotion
records.

Does not own: LLM mutation proposals (manual only in MVP), runtime settings on
the hot path (those live in MoonBags).

### 6.3 Shared Candidate Stream

Two species cannot meaningfully be compared if they see different candidate
universes. Phase A is allowed to run independent candidate streams for
isolation testing only; Phase D (the first real cohort) requires a shared
candidate recorder feeding both species. Candidate stream ID is part of every
journal event.

### 6.4 Token Safety Pre-Screener (placement)

Runs before every species or LLM advisor sees a candidate. Five deterministic
rules (§13). The pre-screener cannot be disabled, relaxed below the
`safetyFloor`, or overridden by an LLM. Blocked tokens are shadow-tracked but
never traded.

---

## 7. Repository Strategy

**Decision:** Worktree first, fork second.

```bash
# from existing moonbags repo
git worktree add ../moonbags-lab -b lab/main
```

Rationale:
- The trader, advisors, and persistence layers stay in MoonBags. The lab
  harness is a thin shell on top. Initial divergence is small.
- Worktrees share git history and let lab work pull bug fixes from MoonBags
  upstream without merge conflicts.
- Promote to a private fork (`moonbags-lab` repo on GitHub) when the lab
  diverges enough to warrant separate CI, separate issues, or its own
  release cadence — at minimum after Phase E.

State, logs, ports, PM2 names, dashboards, and `.env` files are physically
isolated from production MoonBags from day one (Phase A). The worktree shares
git history; it does not share runtime state.

---

## 8. Domain Concepts (MVP)

### 8.1 Species

A species is a frozen strategy organism for one cohort. It contains an ID,
parent ID, cohort ID, model config, entry policy, exit policy, prompt
manifests, numeric settings, hard-filter profile, mutation bounds, the
`safetyFloor`, hypothesis, and falsifier. It does not mutate during a cohort.

### 8.2 Genome

A genome is the versioned JSON representation of a species. The MVP genome:

```json
{
  "schemaVersion": 2,
  "speciesId": "exit-llm",
  "genomeId": "exit-llm:c001:g000",
  "parentGenomeId": null,
  "cohortId": "c001",
  "edgeChannel": "exit_timing",
  "hypothesis": "LLM exit advisor reduces round-trip losses vs default trailing",
  "falsifier": "Reject if friction-adjusted PnL <= control or p95 tail loss > control * 1.10",

  "model": {
    "exit": "MiniMax-M2.7",
    "temperature": 0.1
  },

  "entryPolicy": {
    "mode": "shared_universe_lenient",
    "promptManifest": null,
    "hardFiltersProfile": "baseline_safety_v1"
  },

  "exitPolicy": {
    "mode": "llm_managed",
    "promptManifest": "lab/prompts/exit/exit-llm.yaml",
    "trail": { "armPct": 0.5, "trailPct": 0.45 },
    "risk": { "stopPct": 0.35, "maxHoldSecs": 7200 }
  },

  "mutationBounds": {
    "numericPatchBudget": 3,
    "promptSectionPatchBudget": 1,
    "structuralPatchBudget": 0
  },

  "safetyFloor": {
    "dryRun": true,
    "hardStopRequired": true,
    "minHardStopPct": 0.40,
    "maxPositionSizeSolHumanOnly": true,
    "walletMutation": false,
    "executionClientMutation": false,
    "reentryMode": "disabled_or_shadow_only",
    "minLiquidityUsd": 5000,
    "minSellQuoteRequired": true,
    "maxTopHolderPct": 0.60,
    "maxBundledSupplyPct": 0.50,
    "mintAuthorityActiveBlocks": true,
    "freezeAuthorityActiveBlocks": true
  }
}
```

The `safetyFloor` block is **immutable by patch**. The patch validator computes
the effective post-patch genome and rejects if any safety-floor field would
be relaxed. See §16.

### 8.3 Cohort

A cohort is a fixed experiment window. Defined by:

- calendar duration (e.g. 10 days), AND
- minimum closed-trade count (configured per cohort, never < 30 for promotion
  consideration; the operator can lower for exploratory cohorts but cannot
  promote from them),
- minimum candidate count,
- regime tag,
- shared candidate stream ID.

Species do not promote from cohorts that fall below the data thresholds.

### 8.4 Champion And Challenger

- **Champion:** the current best genome for a species lineage.
- **Challenger:** a child genome tested in a cohort.
- **Promotion:** challenger replaces champion only if vector-dominance
  promotion criteria pass (§14).
- **Archive:** rejected challengers are kept with reason and scorecard.

### 8.5 Edge Channel

A single tag attached to each genome and cohort scorecard, drawn from the
short list in §3.4. It says what kind of edge this experiment is testing. It
is not a subsystem.

---

## 9. MVP Species

Two species. No more. Both run on the same shared candidate stream.

### 9.1 Control

Purpose: baseline. If the lab cannot beat current MoonBags after friction, no
strategy graduates.

Traits:
- Current deterministic exits.
- Default trailing.
- No LLM exit calls (LLM entry advisor still runs because it's the existing
  hot-path filter).
- Same hard filters and shared candidate universe.

### 9.2 Exit-LLM

Purpose: test whether the existing `llmExitAdvisor.ts` adds friction-adjusted
edge over default trailing.

Traits:
- Same lenient entry filters as Control.
- Same shared candidate stream.
- LLM exit advisor active with its existing structured-output schema and
  evidence gating.
- Conservative action enum: `hold`, `set_trail`, `partial_exit`, `exit_now`.

### 9.3 First Cohort Rule

Cohort 1 keeps entries constant and varies exits only. Reason: existing
MoonBags LLM infrastructure is strongest on exits, and exit behavior likely
dominates live PnL quality after friction. Varying both at once destroys
attribution.

### 9.4 Re-Entry (MVP)

Hardcoded to `disabled` for live behavior. `shadow_after_close` is allowed but
records only — no capital. Multi-leg / scale-in / pyramid / round-trip are
**forbidden in MVP** and live in the archive (Archive Part II).

A canonical `ExposureLedger` is built in Phase B that combines all entries by
`mint`. Even though re-entry is disabled, the ledger exists so that when re-entry
re-enters scope, the exposure accounting is already there and tested.

---

## 10. Directory Layout (slim)

```text
moonbags-lab/
  AGENTS.md                                 # ≤200 lines, points here and to ARCHIVE.md
  README.md                                 # ≤200 lines, operator-facing entry
  docs/
    OPERATOR_QUICKSTART.md                  # ≤2 pages, what/why/how
    SAFETY_IMMUTABLES.md                    # the §2.1 list with enforcement layers
    PANIC_STOP_RUNBOOK.md                   # one page, tested
    adr/
      0001-worktree-first.md
      0002-dry-run-immutable.md
      0003-no-llm-researcher-mvp.md
      0004-no-reentry-mvp.md
      0005-no-paid-providers-beyond-birdeye-mvp.md
      0006-manual-mutation-only-mvp.md
  src/
    paths.ts
    lab/
      genome.ts
      cohort.ts
      journal.ts
      friction.ts
      safety.ts
      scorecard.ts
      patch.ts
      replay.ts
      bankroll.ts
      exposureLedger.ts                     # canonical exposure accounting (re-entry-ready)
      report.ts
      cli.ts
  prompts/
    exit/
      control.yaml                          # placeholder for parity; deterministic
      exit-llm.yaml                         # versioned sections (see §16)
  genomes/
    control.json
    exit-llm.json
  cohorts/
    c001/
      cohort.json
      species/
      journal/
      scorecards/
      reports/
        operator_summary.md                 # the one required read
  state/                                    # private, not in git
  logs/                                     # private, not in git
```

That's ~12 source files, ~6 docs, ~2 prompts, ~2 genomes. If a contributor
proposes adding a file, they must (a) name which thing in this layout it
should merge into, or (b) point to the archive entry whose trigger fired.
"It's a different concern" is not enough.

---

## 11. Event-Sourced Journal

### 11.1 Why The Journal Matters

Models, prompts, and settings are cheap. High-quality decision/outcome data is
expensive. The journal is the lab's primary asset.

### 11.2 Event Envelope

Every event shares this envelope:

```json
{
  "schemaVersion": 1,
  "eventId": "evt_2026_05_03_000001",
  "eventTime": "2026-05-03T14:00:00.000Z",
  "ingestTime": "2026-05-03T14:00:00.012Z",
  "cohortId": "c001",
  "speciesId": "exit-llm",
  "genomeId": "exit-llm:c001:g000",
  "instanceId": "exit-llm-01",
  "configHash": "sha256...",
  "promptHash": "sha256...",
  "candidateStreamId": "stream_2026_05_03_001",
  "eventType": "candidate"
}
```

Storage: append-only JSONL files, one per event type per day. No Bronze/Silver/
Gold layering at MVP. DuckDB queries the JSONL directly when needed. See §22.6.

### 11.3 Event Types (six only)

The full v1 event taxonomy is archived (Archive Part I). MVP has six events:

1. **`candidate`** — token surfaced by a discovery source.
2. **`token_safety_screen`** — pre-screener decision (tradable / quarantine /
   hard_block / unknown).
3. **`entry_decision`** — species' decision (entered / skipped / near-miss
   with reason).
4. **`execution_record`** — quote, friction-adjusted fill, latency, errors.
5. **`exit_decision`** — LLM (or deterministic) exit decision with action,
   confidence, cited facts, deterministic gate, schema validation result.
6. **`closed_outcome`** — entry/exit both adjusted for friction, peak PnL, MAE,
   hold time, exit reason, round-trip-loss flag, tail-loss flag.

Each event type's schema is in `src/lab/journal.ts` as a TypeScript discriminated
union with runtime validation. MVP schemas are intentionally narrower than the
v1 design. See `MOONBAGS_LAB_ARCHIVE.md` Part I for the expanded v1 event
inventory, schema sketches, and deferred field groups.

### 11.4 Near-Misses And Skipped Candidates

Near-misses are recorded as `entry_decision` events with `decision: "skip"` and
a `reason` enum (`filter_just_failed`, `llm_skip`, `provider_unavailable`,
`late_signal`, `safety_block`). Survivorship in the journal is the #1 way to
mislead a future researcher; logging the full candidate stream with reasons is
non-negotiable.

### 11.5 Journal Append-Only Invariant

The journal is append-only. The runtime never overwrites past events. A fuzz
test (§21) attempts to overwrite a sealed event and must fail.

---

## 12. Friction Model v1

### 12.1 Purpose

Convert dry-run Jupiter quotes into more realistic predicted fills. Without
this, dry-run optimizes fantasy execution and the live edge evaporates the
moment real fills, latency, slippage, and route changes show up.

### 12.2 What v1 Does (exact)

`friction_v1` applies the following deterministic adjustments:

```text
adjusted_out_amount = raw_out_amount
                    * (1 - slippage_bps / 10_000)
                    * (1 - quote_age_decay)
                    * (1 - decision_latency_decay)
```

Where:

- `slippage_bps` is a static lookup based on quote `priceImpactPct` and
  `liquidityUsd`, calibrated from the last 200 closed trades in MoonBags
  history. Tabular, not modelled. Documented per liquidity bucket.
- `quote_age_decay` is a linear penalty from `quoteAgeMs`. Above a configured
  threshold, the quote is rejected as stale (`outcome: stale_quote`).
- `decision_latency_decay` is the same shape, applied to `simulatedDecisionLatencyMs`
  (LLM round-trip time + signing simulation).

That is the entire model. Every parameter is in a single config block,
versioned, hashable.

### 12.3 What v1 Does NOT Do (explicit non-features)

To prevent friction-v1 from being overtrusted, the spec is explicit about what
v1 does **not** model:

- Failed transactions / partial fills / no-fill probability.
- Route changes between quote and execute.
- Priority fee modeling.
- Re-quote drift.
- Token account / rent side effects.
- Sell-quote unavailability windows.
- MEV / sandwich exposure.

These are **archived** (Archive Part I) as `friction_v2`/`friction_v3` features.
A species running on `friction_v1` displays as **realism-adjusted estimate, not
live-calibrated** in the dashboard, and cannot reach `promotionLevel` higher
than `dry_run_validated` (§14.5).

### 12.4 Calibration

Manual sanity check is mandatory before any cohort scorecard is trusted: pick
five recent closed positions from MoonBags history, compute
friction-adjusted PnL by hand using the v1 model, and confirm the lab's output
matches within 1%. This is the simplest test of the most important assumption.

---

## 13. Token Safety Pre-Screener

### 13.1 Purpose

Reject obviously toxic tokens **before** any species, LLM advisor, or mutation
logic treats them as tradable. No species, prompt, or LLM can override.

### 13.2 The Five MVP Rules

Deterministic, fast, no external dependencies beyond what's already integrated:

1. **`sell_quote_available`** — Jupiter sell quote returns within timeout for
   the configured ladder size. Failed → `hard_block`.
2. **`mint_authority_status`** — if the token still has an active mint
   authority (and is not a known fixed-supply token kind), → `hard_block`.
3. **`freeze_authority_status`** — if freeze authority is active, → `hard_block`.
4. **`liquidity_floor`** — `liquidityUsd >= safetyFloor.minLiquidityUsd`. Below →
   `hard_block`.
5. **`instant_round_trip`** — quote buy at configured size, immediately quote
   selling the received amount. If predicted round-trip loss exceeds threshold,
   → `quarantine` (logged, never traded).

Any rule that can't be evaluated (provider down, data missing) → `unknown_needs_more_data`,
which means `quarantine` for that candidate.

### 13.3 What's Not in the MVP Pre-Screener

Archived (Archive Part I, II): same-cluster holder concentration, bundled/sniper
allocation rate, prior-rugger cluster association, fake volume, CEX/ChangeNOW
wash patterns, dev/deployer retained supply, transfer-fee/tax detection,
provider disagreement as a hard signal. Archive Part I preserves these deferred
token-safety field groups; Part II preserves the exposure/re-entry risks they
interact with. Add a check only when a cohort post-mortem shows the missing
check would have changed an outcome.

### 13.4 Provider Safety Labels Are Evidence, Not Truth

GMGN/OKX/Birdeye risk scores are recorded but never sole reasons for a hard
block (in or out). The pre-screener uses the five rules above; provider scores
inform the post-mortem.

### 13.5 Shadow-Tracking Blocked Tokens

Hard-blocked tokens still receive a `token_safety_screen` event and are kept
in the journal with a 4-hour outcome window. This lets the lab measure
prevented losses, false blocks, and provider-disagreement cases.

### 13.6 Mutation Firewall Cannot Relax The Floor

The five rules' thresholds are values inside `safetyFloor`. The patch validator
computes the post-patch effective config and rejects any patch that would
relax any safety-floor field. Static analysis CI also fails any PR that
introduces a code path bypassing the pre-screener.

---

## 14. Cohort Scoring

### 14.1 Score Vector — 15 Fields

The expanded v1 score-vector inventory is archived in `MOONBAGS_LAB_ARCHIVE.md`
Part I. MVP scorecard:

```json
{
  "netPnlSolFrictionAdjusted": 0.0,
  "netPnlPctFrictionAdjusted": 0.0,
  "rawQuotePnlSol": 0.0,
  "maxDrawdownPct": 0.0,
  "p95TailLossPct": 0.0,
  "medianTradeReturnPct": 0.0,
  "winRate": 0.0,
  "tradeCount": 0,
  "candidateCount": 0,
  "roundTripLossRate": 0.0,
  "largestWinnerContributionPct": 0.0,
  "outlierRemovedPnlPct": 0.0,
  "largestWinnerRemovedPnlPct": 0.0,
  "providerErrorRate": 0.0,
  "llmCostUsd": 0.0
}
```

Plus a derived block:

```json
{
  "aaTrustStatus": "pass|fail|insufficient_data",
  "bankrollEnvelopePass": false,
  "riskOfRuinPct": 0.0,
  "lotteryEdgeFlag": false,
  "blowUpRiskFlag": false,
  "promotionEligible": false,
  "promotionRejectionReasons": []
}
```

That's 22 numbers + 6 booleans/enums. Operator can hold this in their head.
Adding a field requires (a) naming the decision it informs, (b) an ADR.

### 14.2 Vector Promotion

Challenger promotes only if **all** hold:

```text
netPnlSolFrictionAdjusted(challenger) > netPnlSolFrictionAdjusted(champion)
maxDrawdownPct(challenger)            <= maxDrawdownPct(champion) * 1.10
p95TailLossPct(challenger)            <= p95TailLossPct(champion) * 1.10
tradeCount(challenger)                >= minTradeCount  (operator-set, never <30)
roundTripLossRate(challenger)         <= roundTripLossRate(champion) + tolerance
largestWinnerContributionPct          <= 50
outlierRemovedPnlPct(challenger)      > 0
largestWinnerRemovedPnlPct(challenger) > 0
aaTrustStatus(cohort)                 == "pass"
bankrollEnvelopePass(challenger)      == true
lotteryEdgeFlag(challenger)           == false
blowUpRiskFlag(challenger)            == false
sanity_replay_does_not_collapse       == true
```

Statistical override (§2.6) can allow promotion despite a single weak
comparison, but cannot override `bankrollEnvelopePass`, `lotteryEdgeFlag`,
`blowUpRiskFlag`, or `sanity_replay_does_not_collapse`. Reasons are recorded.

### 14.3 Lower-Confidence-Bound Promotion

The full bootstrap-percentile machinery is archived. For MVP: at minimum,
challenger must have `largestWinnerRemovedPnlPct > 0` AND
`outlierRemovedPnlPct > 0`. If both fail, no promotion regardless of mean PnL.
This is the cheapest version of "the result doesn't depend on one runner."

### 14.4 Synthetic Safety Tests (must pass before any promotion logic ships)

These are unit/integration tests on the scorecard math itself, run in CI, not
on real cohorts:

- **Lottery rejection:** synthetic cohort of 100 trades with 1% win rate and
  one 1000x winner. `lotteryEdgeFlag` must be true. Promotion blocked.
- **High-win-rate blow-up:** 99 winners of +2% and 1 loser of -90%.
  `blowUpRiskFlag` must be true. Promotion blocked.
- **Martingale shape:** synthetic species with size escalation after losses.
  Detection must fire (in MVP this is structural — re-entry forbidden — so
  the test verifies the structural rejection works).

### 14.5 Promotion Level Enum

The MVP introduces a `promotionLevel` enum on every species/scorecard. This
prevents a friction-v1-only species from ever being labeled "live candidate":

```
research_only
dry_run_validated         # passed cohort gates under friction_v1
shadow_quote_candidate    # archived; requires friction_v2
micro_live_candidate      # archived
small_live_candidate      # archived
not_live_eligible
```

In MVP, species cannot exceed `dry_run_validated`. The dashboard always shows
the current level and the gate that must pass to move higher.

---

## 15. Bankroll Envelope (incl. dry-run)

### 15.1 Compute Bankroll Survival Even at Zero Capital

Even though the MVP runs entirely dry-run, the bankroll-survival math runs on
every cohort. The point is to refuse promotion of strategies whose live
behavior would be ruinous, even if dry-run looks profitable.

The envelope is **per-species**, not portfolio-level. A flawed species cannot
be allowed to "share" the bankroll with a working one and bankrupt the
combined account; isolation is the point.

### 15.2 Envelope Schema

```json
{
  "bankrollEnvelopeId": "bankroll_dry_run_v1",
  "totalRiskCapitalSol": 1.0,
  "maxCapitalAllocatedToLabPct": 10.0,
  "maxPositionSizeSol": 0.01,
  "maxOpenRiskSol": 0.01,
  "maxDailyLossSol": 0.03,
  "maxWeeklyLossSol": 0.08,
  "maxTotalDrawdownSol": 0.15,
  "maxConsecutiveLossesBeforePause": 5,
  "cooldownAfterMaxLossHours": 24,
  "requiresHumanReloadApproval": true
}
```

For MVP cohorts, the envelope values are notional (no real capital) but the
math runs. The output is the "how many normal losing streaks would this
strategy survive" question that gates promotion.

### 15.3 Tiered Hard Stop

Every species has two thresholds:

- **Soft cap** — pauses new entries, alerts the operator, requires manual
  re-arm. Triggered at `maxDailyLossSol * 0.7`.
- **Hard cap** — liquidates open positions and halts the species. Triggered at
  `maxDailyLossSol`, `maxOpenRiskSol`, or `maxConsecutiveLossesBeforePause`.

Hard cap is enforced by a canonical `RiskGuard` that lives outside species
logic. The species cannot disable, defer, or override it. Tested before any
real cohort runs (§21).

### 15.4 Lottery / Blow-Up Rejection (rules)

The full taxonomy is archived. MVP rules, derived from the existing scorecard
fields:

- `lotteryEdgeFlag = true` if `winRate < 0.05` AND
  `largestWinnerContributionPct > 0.5` AND `largestWinnerRemovedPnlPct < 0`.
- `blowUpRiskFlag = true` if any single closed trade's friction-adjusted loss
  exceeds `maxDailyLossSol`, OR if `winRate > 0.85` AND any single loss
  exceeds 6 × `medianTradeReturnPct` (in absolute SOL).

These flags block promotion. They do not block dry-run experimentation —
dry-run is *how* we discover that a strategy has these properties safely.

### 15.5 Live Capital Ladder (archived stages)

```text
dry_run_only                              # MVP
shadow_live_quote                         # archived
micro_live_probe                          # archived
micro_live_repeatability                  # archived
small_live_canary                         # archived
small_live_scaled                         # archived
```

Each non-MVP stage's gate is in Archive Part XI. The MVP cannot reach beyond
`dry_run_only`.

---

## 16. Mutation Firewall (manual only at MVP)

### 16.1 Why Manual Only

Three converging reviews concluded that LLM-driven config mutation requires
≥3 cohorts of human-labeled "why this decision was correct/wrong" data before
it can avoid drift. We don't have that data. Until we do, every patch is
written by the operator (or a trusted human reviewer), validated, replayed,
and explicitly approved.

The full LLM-researcher / critic / autonomous-loop design is preserved in
Archive Part VI. Trigger to bring it back: `≥3 cohorts complete with full
labeled journal AND deterministic baseline already beats control on
friction-adjusted PnL`.

### 16.2 Patch Schema

```json
{
  "schemaVersion": 1,
  "patchId": "patch_20260520_001",
  "targetGenomeId": "exit-llm:c001:g000",
  "proposedBy": "operator",
  "edgeChannel": "exit_timing",
  "hypothesis": "Tightening trail at 35% peak reduces round-trip loss",
  "expectedEffect": "Lower roundTripLossRate by 5-10pp; small medianTradeReturn drop",
  "falsifier": "Reject if friction-adjusted PnL <= parent or p95 tail loss > parent * 1.10",
  "simplerBaseline": "Deterministic 35% peak trail rule (no LLM)",
  "risk": "May exit runners early in low-volatility regime",

  "promptChanges": {
    "sectionEdits": [
      { "path": "exit/exit-llm.yaml", "section": "decision_criteria", "fromVersion": "v01", "toVersion": "v02" }
    ],
    "fewShotAdd": ["fs-2026-05-12-007"],
    "fewShotRemove": []
  },

  "configChanges": [
    { "op": "replace", "path": "/exitPolicy/trail/armPct", "from": 0.50, "to": 0.35 }
  ],

  "structuralChanges": [],

  "safetyAssertions": {
    "dryRunUnchanged": true,
    "hardStopUnchanged": true,
    "walletUnchanged": true,
    "executionClientUnchanged": true,
    "safetyFloorUnchanged": true,
    "reentryModeUnchanged": true
  },

  "promptComplexityDelta": {
    "sectionsAdded": 0,
    "sectionsRemoved": 0,
    "tokensAdded": 12,
    "tokensRemoved": 18
  }
}
```

### 16.3 Validator Rules (compute effective config, not just paths)

The validator rejects if:

- schema invalid, or required fields missing (hypothesis, falsifier,
  simplerBaseline, edgeChannel),
- patch touches any field in `safetyFloor`,
- patch references wallet, secrets, provider keys, or execution clients,
- numeric change exceeds `mutationBounds.numericPatchBudget`,
- prompt-section change exceeds `mutationBounds.promptSectionPatchBudget`,
- structural change present (MVP `structuralPatchBudget` is 0),
- **effective post-patch config** would have:
  - `dryRun: false`,
  - any safety-floor field weakened (e.g. `minLiquidityUsd` lowered, `reentryMode` widened),
  - a `hardFiltersProfile` swap to a profile not on the approved-profiles list,
  - a prompt section that adds a new allowed action to the LLM exit advisor's
    output schema,
  - an LLM cost estimate that exceeds the daily cap (§17),
- patch cannot be hashed or replayed (sanity-twin loader fails to load it).

Indirect safety weakening is the most important class — it's why the validator
must compute the effective config and not just match JSON paths.

### 16.4 Sanity-Twin Replay

Every accepted patch runs through `replay.ts` against the prior cohort's
candidate stream. Output: predicted friction-adjusted PnL on the prior cohort
under the new genome. If that number collapses (worse than parent by more than
configured tolerance), the patch is rejected before the new cohort runs.

This is the single most effective overfit-detection step the MVP has. A
challenger that wins live data but would have lost on yesterday's data is
overfit; we want to know that before promoting.

### 16.5 Operator Approval

Every accepted patch generates a `patch_<id>_operator_summary.md` (≤1 page)
with:

- Plain-English hypothesis.
- What changes / what does not change.
- Why it might help / why it might hurt.
- Falsifier.
- Simpler baseline.
- Replay outcome.
- Unchanged safety boundaries (explicit checklist).
- Operator decision: approve / reject / hold.

The operator runs `lab:approve-patch --id patch_<id>` only after reading the
summary. Without the explicit approval, the patch does not run.

### 16.6 Hypothesis-Family Registry (lightweight)

Equivalent patches count against the same family. The patch JSON includes a
`hypothesisFamily` tag. A simple flat file `lab/hypothesis_families.jsonl`
tracks `maxTrials`, `trialsUsed`, and `result`. After 5 failed variants in
one family, the family is paused and the operator must explicitly retire or
restart it. Prevents endless re-rolls of the same overfit idea.

---

## 17. LLM Cost Cap (fail-closed)

### 17.1 Why Fail-Closed

Four parallel species running continuously can burn LLM budget fast,
especially if a malformed candidate stream triggers retries. A daily USD cap
that *only* warns is a metric, not a circuit breaker.

### 17.2 The Cap

Two budgets per process:

```json
{
  "llmDailyCapUsd": 10.0,
  "llmHourlyBurstCapUsd": 2.0,
  "fallbackOnBreach": "deterministic_only"
}
```

When breached, the process stops calling the LLM and the species falls back to
its deterministic exit logic (default trailing for Exit-LLM, identical to
Control). The breach is logged as a `cohort_red_flag`. The cohort is allowed
to continue but cannot promote until a human reviews.

### 17.3 No Auto-Increase

Like every other safety value, the cap is operator-set and `safetyFloor`-protected.
No LLM, patch, or runtime setting can increase it.

---

## 18. Live Arming Process Profile

### 18.1 Why Process Isolation, Not Env Var

`DRY_RUN=false` as a single env var is a single typo away from disaster. Live
calibration, when it eventually runs (post-MVP), is a separate process profile
with its own configuration, wallet, and arming sequence. The MVP builds the
scaffolding for this so the boundary is in code from day one, even though no
live trading happens.

### 18.2 The Arming Sequence (built but disabled in MVP)

```text
1. Operator runs `lab:arm-calibration --confirm-phrase <one-time>`
2. CLI prompts for the confirmation phrase (read from a file the LLM cannot
   access).
3. CLI verifies wallet whitelist checksum matches the dedicated calibration
   wallet.
4. CLI launches a separate process with `MICRO_LIVE_ENABLED=true` and
   `DRY_RUN=false` set in *that process only*, never in the parent shell.
5. Calibration process refuses to start unless: wallet matches, env matches,
   max-loss config present, kill switch tested.
6. Each session arms exactly once. Crash → re-arming required.
```

In MVP, step 1 returns "live calibration is not enabled in this build." The
infrastructure exists; the gate is closed.

Kill-switch rehearsal is part of the arming boundary, not a later live-only
nice-to-have. Before this command can ever progress past the MVP closed-gate
response, `lab:panic-stop` must be implemented, tested, and documented against a
dry-run instance so the operator has already practiced the stop path.

### 18.3 What Cannot Enable Live

- LLM output (any).
- Telegram command.
- Dashboard setting.
- `state/settings.json` mutation.
- Patch.
- Genome change.
- Any agent, in any mode.

Each of these has a CI test that asserts the path is closed (§21).

---

## 19. Operator Decision Packet

### 19.1 The One Required Read

After every cohort, exactly one document must be inspected and signed:

```text
lab/cohorts/c001/reports/operator_summary.md   (≤1 page)
```

It has six sections, in this fixed order:

```markdown
# Cohort c001 — Operator Decision Packet

## Decision Requested
[promote / reject / hold-for-more-data / investigate-red-flags]

## Cohort Trust
- AA divergence: pass / fail
- Trade count: N (min: M)
- Provider error rate: X%
- Friction-v1 sanity check: pass / fail (manual hand-check date)

## Why The Challenger (Did Not) Win
- Plain-English summary, ≤4 sentences.
- Friction-adjusted PnL delta vs control: +X%.
- Round-trip loss rate delta: -Y%.
- Largest-winner contribution: Z%.

## Boring Alternative Explanations Considered
- Did one runner cause the result? [yes/no, with number]
- Did regime explain it? [yes/no]
- Did provider failure explain it? [yes/no]
- Could a deterministic rule achieve the same? [yes/no]

## Bankroll Survival
- Risk-of-ruin: X%.
- Largest-loss-to-median-win ratio: Y.
- Lottery flag: yes / no.
- Blow-up flag: yes / no.

## Red Flags
- [bulleted list, empty if none]

## Operator Sign-off
- Read by: [name]
- Date: [date]
- Decision: [...]
- Reason (if statistical override): [...]
```

### 19.2 Optional Drill-Downs (≤4)

If the operator wants more depth:

- `scorecard.json` (raw 22 numbers).
- `friction_v1_sanity.md` (the manual-checked five-trade comparison).
- `journal_summary.md` (top 10 wins, top 10 losses, near-miss summary).
- `replay_report.md` (sanity-twin output for this cohort's challenger).

That's it. Five files per cohort total. No 30-report bundle. The full v1
report list is archived (Archive Part VIII); items move out of the archive
when the operator says "I read this every cohort and use it."

### 19.3 Patch Decision Packet

When a patch is proposed:

```text
lab/cohorts/c00X/reports/patch_<id>_operator_summary.md   (≤1 page)
```

Format described in §16.5.

### 19.4 No Mystery JSON

The operator never approves a decision based on raw JSON alone. JSON exists
for audit and for future tooling; the operator-facing surface is Markdown.

---

## 20. Phased Roadmap (MVP — five phases)

The full 12-phase v1 roadmap is archived (Archive Part XII). MVP covers
Phases A–E; everything beyond E is deferred.

### Phase A — Isolation & Safety Shell

Deliverables:
- Worktree created from MoonBags.
- `paths.ts` central path helper.
- `MOONBAGS_INSTANCE_ID`, `MOONBAGS_STATE_DIR`, `MOONBAGS_LOG_DIR` env vars.
- Distinct dashboard ports per instance.
- Distinct PM2 names.
- Distinct Telegram chat (or Telegram disabled per instance).
- LLM budget namespace per instance.
- `lab:doctor` command.
- `DRY_RUN=true` default with multi-layer enforcement (§2.1).
- Live arming scaffold (§18, gate closed).
- Initial docs: `OPERATOR_QUICKSTART.md`, `SAFETY_IMMUTABLES.md`,
  `PANIC_STOP_RUNBOOK.md`, ADRs 0001–0006.

Acceptance:
- Two dry-run instances run in parallel for 24 hours without state collision.
- No instance writes to production MoonBags state directory.
- All §2.1 enforcement layers pass their tests.
- Operator can explain in their own words: what is running, how to stop it,
  what cannot be changed.

### Phase B — Journal & Token Safety Pre-Screener

Deliverables:
- `journal.ts` with append-only writer and 6 event types.
- Six event schemas with TypeScript discriminated union and runtime validation.
- Append-only invariant enforcement + fuzz test.
- `safety.ts` with the five MVP rules.
- `safetyFloor` block in genome with patch-validator enforcement.
- Shadow-tracking of blocked tokens.
- `exposureLedger.ts` (built in advance, used trivially for now since no re-entry).

Acceptance:
- Every position can be traced from candidate to outcome via journal events.
- Skipped candidates appear with reason.
- Hard-blocked tokens never reach an LLM advisor (verified by integration test).
- Token-safety false-block manual audit on 50 known-clean tokens shows <5% false blocks.
- Token-safety false-negative audit on 50 known-rug tokens shows <5% misses.

### Phase C — Friction v1 & Minimal Scorecard

Deliverables:
- `friction.ts` implementing the v1 model (§12.2) and only the v1 model.
- `bankroll.ts` with envelope math, lottery flag, blow-up flag, tiered hard
  stop, `RiskGuard` enforcement.
- `scorecard.ts` computing the 22-number scorecard (§14.1).
- `report.ts` rendering `operator_summary.md`.
- A/A control runner (two identical Control instances).
- Friction-v1 manual sanity check on 5 historical trades.
- Synthetic safety tests in CI (lottery, blow-up).

Acceptance:
- Friction sanity check matches hand-computed values within 1%.
- A/A divergence between two identical Controls is below threshold (set
  empirically from the first run).
- Lottery and blow-up synthetic cohorts produce the right flags.
- `operator_summary.md` renders with all six sections populated.

### Phase D — Two-Species Cohort

Deliverables:
- Shared candidate recorder feeding both species.
- `genomes/control.json` and `genomes/exit-llm.json`.
- `cohort.ts` lifecycle (start / collect / score / stop).
- Cohort 1 runs for 10 days with both species.
- Replay/sanity-twin against the just-completed cohort (used by Phase E).

Acceptance:
- Both species see the same candidate stream (verified by stream IDs in
  every event).
- A/A divergence on cohort 1 stays below threshold throughout.
- Scorecard renders for both species.
- Operator can read `operator_summary.md` and answer "did Exit-LLM beat
  Control?" without opening JSON.

### Phase E — Manual Mutation Loop

Deliverables:
- `patch.ts` with schema + validator (effective-config diffing) +
  hypothesis-family registry.
- `replay.ts` running sanity-twin against the prior cohort.
- `lab:propose-patch`, `lab:validate-patch`, `lab:approve-patch`,
  `lab:reject-patch` CLI commands.
- Patch operator-summary renderer.
- Tests in §21 all green.

Acceptance:
- A manually written patch can be validated, replayed, and either approved or
  rejected without unsafe side effects.
- Malicious patches (size increase, hard-stop disable, safety-floor relax,
  execution-client swap, profile downgrade, action-enum expansion) are all
  rejected at the validator layer with clear error messages.
- The hypothesis-family registry prevents 6th retries of the same idea.

### What Comes After Phase E

Only with operator sign-off and clear evidence. Each subsequent move is one of:

- **Run cohort 2 with the same setup** if cohort 1 was inconclusive.
- **Add a third species** (only after the two-species harness is proven).
- **Promote a deferred capability from the archive** (e.g. a single deferred
  scorecard field, social L1 manual import) if the cohort post-mortem points
  at it.
- **Cut the experiment** if Exit-LLM cannot beat Control after 3 cohorts.
  Don't sink-cost into a hypothesis the data has rejected.

The default after Phase E is **stop, look at the data, decide**. Not "build
the next phase."

---

## 21. Tests Required Before Any Live Work

Even though MVP has no live trading, the live-arming scaffold (§18) means
these tests exist from day one and gate the arming command. In test order;
later tests depend on earlier ones passing.

### Hard Safety Tests

1. **Process isolation.** Two MoonBags-lab instances run dry-run in parallel
   for 24h with no state directory or port collision.
2. **Journal append-only.** Fuzz test attempts to overwrite a sealed event;
   write rejected.
3. **DRY_RUN immutability — multi-layer.** Attempts to set `DRY_RUN=false` via
   (a) env at species spawn, (b) genome JSON, (c) settings.json mutation,
   (d) patch, (e) Telegram command, (f) dashboard. All paths blocked.
4. **Wallet/secret immutability.** Same multi-layer test for wallet keys, API
   keys, execution-client field, hard-stop config.
5. **Patch validator effective-config diff.** Submit patches that touch
   safety-floor fields directly, indirectly via profile swap, indirectly via
   prompt action-enum expansion, or by exceeding mutation budget. All rejected.
6. **Patch validator integration.** Submit a legal patch; cohort runs.
7. **LLM schema-failure fallback.** Inject malformed LLM output; species falls
   back to deterministic action; no exception reaches the trader.
8. **LLM daily cost cap fail-closed.** Set cap to $1; run cohort that would
   cost more; species stops calling LLM and falls back to deterministic; no
   overrun.
9. **Tiered hard stop.** Soft cap pauses entries with operator alert; hard cap
   liquidates and halts.
10. **Hard-stop integrity under quote degradation.** Simulated liquidity decay
    between entry and stop trigger; stop still executes within bounded loss.
11. **Live arming gate closed in MVP.** Running `lab:arm-calibration` returns
    "live calibration is not enabled in this build."
12. **Kill-switch rehearsal before arming.** `lab:panic-stop` works against a
    dry-run instance and is documented before any future live calibration gate
    can be opened.

### Quant / Replay Tests

13. **A/A divergence.** Two identical Control species on the same candidate
    stream; cohort scorecard variance below threshold.
14. **Replay determinism.** Same genome + same candidate stream + fixed seed =
    byte-identical journal.
15. **Friction sanity.** Hand-computed friction-adjusted PnL on 5 historical
    trades matches lab output within 1%.
16. **Lottery rejection synthetic.** 1% win rate + one 1000x recovery winner
    → `lotteryEdgeFlag=true`, promotion blocked.
17. **High-win-rate blow-up synthetic.** 99% wins + 1 fatal loss →
    `blowUpRiskFlag=true`, promotion blocked.
18. **Sanity-twin overfit detection.** Synthetic patch that wins on cohort N
    but would have lost on cohort N-1 → replay collapses, patch rejected.

### Token Safety Tests

19. **Five-rule false-block audit.** 50 manually-labeled clean tokens; <5%
    false blocks.
20. **Five-rule false-negative audit.** 50 manually-labeled rug tokens; <5%
    misses.
21. **Pre-screener cannot be relaxed.** Patch attempts to lower
    `safetyFloor.minLiquidityUsd`; rejected.
22. **Pre-screener cannot be bypassed.** Static analysis CI fails any PR that
    introduces a code path reaching `llmEntryAdvisor.ts` without going through
    `safety.ts`.

### Provider Tests (Birdeye is the only live integration)

23. **Birdeye package acceptance check.** Endpoint coverage, rate limits,
    compute-unit cost confirmed before high-volume jobs.
24. **Birdeye contract test.** Schema shape, required fields, timestamp
    semantics, rate-limit behavior, cost logging — all checked daily, fails
    cohort trust if any check fails.
25. **Birdeye cost cap.** Daily compute-unit cap enforced; on breach, species
    falls back to GMGN/OKX free-tier data and logs a red flag.

### Operator Sign-Off Tests

26. **`operator_summary.md` schema.** Generator produces all six sections;
    section ordering enforced by integration test.
27. **Promotion requires sign-off.** Promotion CLI without recorded operator
    sign-off → rejected.
28. **Panic stop tested.** `lab:panic-stop` halts all instances and any open
    positions within 30s.

### Bankroll Math

29. **Bankroll envelope simulator.** Coin-flip sequences with known win-rate
    and payoff produce expected ruin probability within 5%.
30. **Per-species envelope isolation.** A species hitting its hard cap does
    not affect another species' envelope.

All 30 tests must pass before any live arming is conceivable. In MVP, only
1–18 and 23–30 run on every cohort; 19–22 run on schedule (weekly) or after
any safety-related code change.

---

## 22. Failure Modes & Mitigations (MVP)

### 22.1 Overfitting To One Runner
Mitigations: vector promotion, minimum trade count, replay, largest-winner
contribution metric, `largestWinnerRemovedPnl > 0` gate.

### 22.2 Dry-Run Fantasy Fill
Mitigations: friction v1, manual sanity check, explicit non-features list,
`promotionLevel` cap of `dry_run_validated` until friction v2.

### 22.3 Species See Different Universes
Mitigation: shared candidate recorder + stream ID in every event, A/A
controls.

### 22.4 LLM Mutates Safety Away
Mitigations: no LLM researcher in MVP; manual patches only; effective-config
diff in validator; safetyFloor immutable; multi-layer DRY_RUN enforcement.

### 22.5 Provider API Drift
Mitigations: daily Birdeye contract test; provider state machine (`disabled`,
`manual_only`, `batch_only`, `shadow_only`, `hot_path_allowed`) enforced in
code; raw payload schema versioning.

### 22.6 Data Volume Concerns (deferred)
For MVP: append-only JSONL files per event type per day, gzipped daily, 30-day
local retention. DuckDB queries JSONL directly.

ClickHouse migration trigger (archived): "DuckDB cohort-scoring p95 > 30s on
a real cohort." Until that fires, no warehouse machinery.

### 22.7 Provider Disagreement (canonical resolution)

When providers disagree, deterministic resolution:

```
sellability disagreement   -> hard_block or quarantine
liquidity disagreement     -> use most conservative value
holder concentration       -> use worst safe value
price disagreement         -> block promotion scoring if unresolved
wallet classification      -> research-only, never gates trading
social timestamp           -> excluded from entry features (deferred anyway)
```

The resolution table is canonical. No agent or species picks winners ad-hoc.

### 22.8 Bankroll Ruin / Lottery Edge / Blow-Up Risk
Mitigations: bankroll-survival math on every cohort; lottery flag; blow-up
flag; per-species envelope; tiered hard stop; re-entry forbidden in MVP;
size-escalation structurally prevented; no auto-reload.

---

## 23. Success Metrics (MVP)

### 23.1 Engineering Success
- Two species run without state collision.
- Journal captures full decision lifecycle (every position traceable).
- Scorecard reproducible from journal.
- Friction model produces raw vs adjusted PnL.
- Manual patches can be validated and replayed.
- Unsafe patches blocked at the validator layer.
- A/A controls stable enough for comparison.

### 23.2 Quant Success
- Control baseline established with known A/A variance.
- Either: Exit-LLM beats Control on friction-adjusted PnL, lower-bound
  metrics, and bankroll-survival across at least one cohort, OR: cohort 1
  delivers a clean negative result (Exit-LLM does not beat Control) so we can
  cut and ask the next question.
- Sanity replay does not collapse for any promoted challenger.
- Bankroll survival metrics prevent lottery and blow-up promotion.

### 23.3 Operator Comprehension Success
- Operator can read `operator_summary.md` for every cohort and explain the
  decision in one sentence.
- Operator can run the panic-stop without developer help.
- Operator can read a patch's operator summary and answer the falsifier
  question.
- Operator never approves from raw JSON.

### 23.4 What Counts As "Done" For MVP

The MVP is done when the operator can tell a colleague, in one paragraph,
whether the LLM exit advisor adds friction-adjusted edge over default trailing
on this market — and back the answer with three cohorts of data, replay,
A/A controls, and bankroll-survival math.

That's it. No regime router, no social alpha, no wallet copyability, no
self-improving researcher. Those exist only if the data calls for them.

---

## 24. Initial Tickets

10 tickets. Each has engineering outcome, operator acceptance, safety
acceptance, related docs updated.

### Ticket 1 — Worktree & Path Isolation
- Engineering: worktree created, `paths.ts` helper, `MOONBAGS_*_DIR` env
  support, distinct ports/PM2 names. Existing hardcoded `state/` paths
  migrated through the helper.
- Operator: two instances run independently for 24h; operator confirms by
  inspecting state directories.
- Safety: no instance writes to production MoonBags state.
- Docs: ADR 0001 + `OPERATOR_QUICKSTART.md`.

### Ticket 2 — Safety Immutables With Named Enforcement Layers
- Engineering: §2.1 enforcement layers built and tested. Patch validator
  scaffolding (no patches accepted yet). Live-arming scaffold with closed
  gate.
- Operator: operator runs each blocked path and confirms the rejection
  message is clear.
- Safety: tests 1–4, 11 from §21 pass.
- Docs: `SAFETY_IMMUTABLES.md`, ADR 0002, `PANIC_STOP_RUNBOOK.md`.

### Ticket 3 — Append-Only Journal + Six Event Schemas
- Engineering: `journal.ts` with discriminated union, runtime validation,
  per-event-per-day JSONL files, gzip-on-rollover, append-only invariant,
  fuzz test.
- Operator: operator can grep journal files and explain what each event type
  means.
- Safety: test 2 from §21.
- Docs: section §11 of this spec.

### Ticket 4 — Token Safety Pre-Screener (5 rules + safetyFloor)
- Engineering: `safety.ts` with the five rules, `safetyFloor` enforcement,
  shadow-tracking of blocked tokens. Static-analysis CI check.
- Operator: 50/50 manual audit signed off.
- Safety: tests 18–21.
- Docs: §13.

### Ticket 5 — Friction v1 + Bankroll Math + Tiered Hard Stop
- Engineering: `friction.ts` (only v1, no v2/v3 stubs), `bankroll.ts` with
  envelope, lottery flag, blow-up flag, `RiskGuard` for tiered hard stop.
- Operator: hand-checked friction sanity on 5 trades.
- Safety: tests 9, 10, 14, 15, 16, 28, 29.
- Docs: §12, §15.

### Ticket 6 — Scorecard + operator_summary.md
- Engineering: `scorecard.ts` (15 fields + derived block), `report.ts`
  rendering all six sections of `operator_summary.md`.
- Operator: operator reads sample summary and confirms the format is usable.
- Safety: test 25.
- Docs: §14, §19.

### Ticket 7 — Shared Candidate Recorder + A/A Controls
- Engineering: shared candidate stream with stream IDs in every event; two
  identical Control instances; A/A divergence report.
- Operator: A/A passes on a 24-hour dry run before cohort 1 begins.
- Safety: test 12.
- Docs: §6.3, §22.3.

### Ticket 8 — Two-Species Cohort Runner
- Engineering: `cohort.ts` lifecycle, `genomes/control.json`,
  `genomes/exit-llm.json`. Cohort 1 runs for 10 days dry-run.
- Operator: reads `operator_summary.md` for cohort 1 and signs off the
  decision packet.
- Safety: tests 5, 6, 7, 8, 13, 17.
- Docs: §9, §20 (Phase D).

### Ticket 9 — Manual Mutation Loop
- Engineering: `patch.ts` with effective-config diff, hypothesis-family
  registry, sanity-twin replay, `lab:propose-patch` /
  `lab:validate-patch` / `lab:approve-patch` / `lab:reject-patch` CLI
  commands.
- Operator: writes a manual patch end-to-end and either approves or rejects
  it.
- Safety: tests 5, 17, 26.
- Docs: §16, ADR 0006.

### Ticket 10 — Birdeye Provider Plumbing (read-only, OHLCV only)
- Engineering: minimal Birdeye client for OHLCV + holders + transactions,
  daily contract test, daily compute-unit cap.
- Operator: monthly cost report shown in `operator_summary.md`.
- Safety: tests 22, 23, 24.
- Docs: addendum §3.

That's the entire MVP backlog. The full v1 ticket list (45 tickets) is in
Archive Part XIII. Any ticket that wants to leave the archive must point to
which finding in the four reviews moved it back.

---

## 25. References

- [`MOONBAGS_LAB_DATA_TOOLING_ADDENDUM.md`](./MOONBAGS_LAB_DATA_TOOLING_ADDENDUM.md)
  — Birdeye-first provider policy, provider state machine, ROI rules.
- [`MOONBAGS_LAB_ARCHIVE.md`](./MOONBAGS_LAB_ARCHIVE.md) — every postponed
  capability with its `Revisit when:` trigger, organized into 13 parts. The
  full v1 spec sections live there verbatim where the schema/intent is
  load-bearing.

---

## 26. Final Product Thesis

MoonBags Lab is a **measurement engine, not a discovery cathedral**. The MVP
exists to answer one well-defined question safely. If the answer is yes, we
expand from that signal — bringing capabilities back from the archive in the
order the data demands, not in the order the original spec imagined them. If
the answer is no, we cut and ask a different question.

The strongest version of the project is:

> A two-species, dry-run, friction-aware laboratory where the operator can
> read one report after every cohort, decide whether to promote, reject, or
> hold, and stop the system without help. The machine can be sophisticated
> later. The first thing the machine has to be is honest.

The target is live edge. The method is measurement. The unit of discovery is
the edge channel. The first version of the system is the smallest version
that can produce a trustworthy yes or no.
