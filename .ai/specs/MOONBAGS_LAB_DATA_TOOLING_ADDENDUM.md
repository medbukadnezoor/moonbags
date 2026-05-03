# MoonBags Lab Data Tooling Addendum — Slim Edition

Status: Draft v2 (slimmed)
Date: 2026-05-03
Parent spec: [`MOONBAGS_LAB_PRODUCT_SPEC.md`](./MOONBAGS_LAB_PRODUCT_SPEC.md)
Archive: [`MOONBAGS_LAB_ARCHIVE.md`](./MOONBAGS_LAB_ARCHIVE.md) — Parts III, IV, V, IX

## 1. Purpose

This addendum documents data-provider policy for MoonBags Lab MVP. It is
deliberately small. Most of the v1 addendum's content (paid-upgrade ladder,
wallet-intelligence dataset design, social ingestion, charting, Bronze/Silver/
Gold warehouse plans) lives in the archive with explicit revisit triggers.

The MVP question is "does the existing LLM exit advisor beat default trailing
after friction?" Almost no provider is needed to answer that. The MoonBags
substrate already integrates GMGN, OKX, Helius (free), and Jupiter. The MVP
adds Birdeye for OHLCV/holders only, and uses everything else from existing
free-tier integrations.

## 2. Provider Policy (MVP)

### 2.1 The MVP Provider Stack

| Provider | Role in MVP | Tier |
|---|---|---|
| Jupiter Swap V2 | Quote/execute (existing, hot path) | existing |
| GMGN | Candidate discovery + signals (existing, free seed) | existing free |
| OKX OnchainOS Web3 | Secondary candidate source (existing) | existing free |
| Helius | Wallet truth cross-check on a small sample, priority-fee context | free tier |
| Birdeye BDS | OHLCV, holders, token transactions, charting | **paid (only paid one)** |

That is the entire MVP provider list. All other providers from the v1 addendum
(Nansen, Bitquery, Arkham, Solscan Pro, Dune, GoPlus, RugCheck, DeFade,
Bubblemaps, GetXAPI, Telegram automation) are **archived** until ROI ledger
proof shows a specific edge channel improves with their data, *after* core
trading edge has been demonstrated.

### 2.2 Why Birdeye Is the Only Paid Provider in MVP

Birdeye covers the broadest set of immediate MVP needs in one subscription:
OHLCV, real-time price, token transactions, token holders, holder distribution.
That covers the data needs of friction modeling, scorecard reporting, and
post-trade research without integrating four separate providers.

Adding any paid provider beyond Birdeye in MVP risks subscription sprawl
without measured ROI. The provider state machine (§2.4) makes this explicit
in code, not just policy.

### 2.3 Budget Discipline (hard rule)

The lab must treat trading capital, API spend, storage, compute, and human
review time as finite budgets. Provider spending is not allowed to justify a
strategy that fails the parent spec's bankroll envelope, lottery-edge
rejection, or high-win-rate blow-up rejection gates.

Before adding *any* paid provider beyond Birdeye, the operator must be able
to read in `operator_summary.md`:

- which edge channel the provider is expected to improve,
- which scorecard metric should move,
- the monthly cost cap,
- the cost per useful signal,
- whether the strategy using the feature passes bankroll survival,
- and what free/manual alternative was tried first.

> Do not buy more data to chase an edge that the bankroll cannot survive.

### 2.4 Provider State Machine (enforced in code)

Every provider integration carries a state from this enum:

```
disabled         # provider not initialized, no client class loaded
manual_only      # CSV import only, no client calls
batch_only       # nightly batch jobs allowed; no hot-path access
shadow_only      # records data alongside trading but does not influence decisions
hot_path_allowed # provider data flows into entry/exit decisions
```

The state is in code, not just docs. A provider client class is only
instantiated for the state it's authorized for. Promoting a provider across
states requires an operator-approved patch and an entry in the provider ROI
ledger (§3).

Initial states for MVP:

| Provider | State | Notes |
|---|---|---|
| Jupiter | `hot_path_allowed` | existing, unchanged |
| GMGN | `hot_path_allowed` | existing, unchanged |
| OKX | `hot_path_allowed` | existing, unchanged |
| Helius | `batch_only` | wallet truth cross-check on closed positions; not on hot path |
| Birdeye | `batch_only` | OHLCV / holders / transactions for post-trade research |

Promotion of Birdeye to `hot_path_allowed` requires (a) confirmed package and
rate-limit acceptance check (§3.1), (b) measured ROI in scorecard delta, (c)
explicit operator approval.

## 3. Birdeye Integration

### 3.1 Acceptance Check (Phase Birdeye-1)

Before building any high-volume jobs:

- Which wallet, trader, holder, token transaction, OHLCV, WebSocket, and
  token security endpoints are included in the active BDS package?
- What are the compute-unit costs per endpoint?
- What are the per-minute and per-day rate limits?
- Are wallet APIs beta, low-limit, or shared across wallet products?
- Which endpoints are safe for hot enrichment vs batch research?

Endpoint classifications (the lab's local view):

```
hot_path_allowed       # safe to call per-candidate
batch_only             # nightly or per-cohort use only
manual_research_only   # operator initiates manually
disabled_until_upgrade # do not use without explicit upgrade
```

The lab does not assume any Birdeye endpoint can support hot-path use until
explicitly classified.

### 3.2 Daily Cost Cap (fail-closed)

Birdeye usage is capped at:

```json
{
  "birdeyeDailyComputeUnitCap": 100000,
  "birdeyeHourlyBurstCap": 10000,
  "fallbackOnBreach": "free_tier_only"
}
```

When breached, the lab stops calling Birdeye and falls back to GMGN/OKX
free-tier data. The breach is logged as a `cohort_red_flag`. Operator must
review and either raise the cap (operator-only patch) or accept reduced
data.

### 3.3 Daily Contract Test

Birdeye gets a daily contract test that checks:

- endpoint availability,
- response schema shape,
- required fields present,
- timestamp semantics,
- rate-limit handling,
- compute-unit cost logging,
- retry behavior.

Failure of any check → cohort `aaTrustStatus` flips to `fail`, no promotion
allowed until resolved.

### 3.4 Birdeye-Specific Risks

- Wallet APIs are sometimes beta or shared with other Birdeye products. The
  lab must not assume wallet endpoints can support volumes implied by future
  wallet-intelligence work (which is archived anyway).
- Compute-unit pricing can change. The cost cap protects against silent
  overruns.

## 4. Free / Already-Available Providers

### 4.1 GMGN

Existing MoonBags integration. Used in MVP as:

- primary smart-wallet and signal seed source,
- token/security enrichment,
- candidate signals.

Posture: GMGN scoring is a signal seed, not ground truth. Stored with
confidence and timestamp. Lab outcomes validate whether GMGN-derived signals
predict profitable follow-through. Archived: the full wallet-intelligence
dataset derived from GMGN seeds (Archive Part IV).

### 4.2 OKX OnchainOS Web3

Existing local dependency. Used in MVP as secondary candidate / market source.

Posture: query/market capabilities only. OKX agentic wallet or trading
capabilities are **not** used in the lab unless a separate human-approved
design is written.

### 4.3 Helius (free tier)

Used as `batch_only` in MVP for:

- wallet truth cross-check on a small sample of closed positions
  (verify whether a wallet actually bought/sold vs received tokens),
- priority-fee context for friction-v2 design (deferred).

Free tier is sufficient for MVP volumes. Helius higher tier is archived as a
post-MVP paid upgrade candidate (Archive Part IX).

### 4.4 Manual KOL CSV Importer

For social signals, the MVP supports **only** manual CSV import:

```csv
timestamp,source,kol_handle,mint,event_type,url,confidence
```

Allowed `event_type` values:

```
first_mention
repeated_push
ca_warning
sell_hint
thread_update
deleted_or_suspicious_post
```

Used for manual delayed-signal placebo tests and KOL side-wallet hypothesis
exploration *if the operator chooses*. No automated client. No Telegram bot.
No GetXAPI. The full social automation plan is in Archive Part III.

## 5. Provider ROI Ledger (lightweight)

Even in MVP the lab tracks provider/feature ROI, but as one flat file, not as
a subsystem.

```json
{
  "provider": "birdeye",
  "feature": "ohlcv_15m",
  "edgeChannel": "post_trade_research",
  "metricImproved": "scorecard rendered with full chart context",
  "before": "none",
  "after": "5 charts per cohort_summary",
  "costUsd": 50,
  "coverage": 0.9,
  "decision": "keep",
  "lastReviewed": "2026-05-15"
}
```

File: `lab/cohorts/c00X/reports/provider_roi.jsonl` (append-only).

Provider-feature decisions: `keep`, `batch_only`, `upgrade_candidate`,
`disable`, `manual_only`.

Any paid upgrade candidate moves out of the archive only after the ROI ledger
shows incremental improvement on a measured edge channel after cost.

## 6. Storage (MVP)

Append-only JSONL files per event type per day. Gzipped daily. Local 30-day
retention. DuckDB queries JSONL directly for scorecards.

Bronze/Silver/Gold warehouse, Parquet conversion, ClickHouse migration triggers,
object storage triggers — all archived (Archive Part V). Trigger to bring back:
"DuckDB cohort-scoring p95 > 30s on a real cohort" or "local disk usage exceeds
configured budget."

## 7. Storage Cost Tracking (lightweight)

In the MVP, tracking is two numbers per cohort:

- total raw JSONL bytes written,
- total Birdeye compute units consumed.

Both go into `operator_summary.md` under "Cohort Trust." If either grows
faster than expected, the operator decides whether to compact, archive,
or cap.

## 8. LLM Cost Tracking

LLM cost is part of the parent spec (§17), not a provider integration. It
gets the same fail-closed treatment as Birdeye compute units.

## 9. Open Questions (operator decisions)

These are operator decisions, not engineering decisions:

- What Birdeye BDS package is currently active? (Required before Phase D.)
- What is the operator's monthly budget cap for Birdeye in MVP?
- Should the MVP use Helius free tier wallet truth cross-check, or skip it
  until Phase E?
- For social: stay at L0 (no ingestion) for MVP, OR enable manual CSV
  importer for the operator's convenience? (CSV importer is small; safe to
  include in MVP if operator wants it.)

These do not block engineering work. The Birdeye package check (Ticket 10)
will surface the answer to Q1; operator answers Q2–Q4 before Phase D.

## 10. References

The full v1 addendum content (paid-upgrade ladder of 7 providers, wallet
intelligence dataset, KOL side-wallet hypothesis, CEX/ChangeNOW/bridge
obfuscation, full social ingestion plan, Bronze/Silver/Gold warehouse,
charting, agent tooling roadmap with 30+ tools, comprehensive provider
evaluation scorecard) is preserved verbatim in the archive:

- Archive Part III — Social Alpha Layer
- Archive Part IV — Wallet Intelligence
- Archive Part V — Data Warehouse Expansion
- Archive Part IX — Provider Upgrade Ladder

Each archive entry has its `Revisit when:` trigger.
