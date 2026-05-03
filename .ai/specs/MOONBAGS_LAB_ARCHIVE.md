# MoonBags Lab Archive — Post-MVP Development Parking Lot

Status: Archived plans, not active MVP scope
Date: 2026-05-03
Active spec: [`MOONBAGS_LAB_PRODUCT_SPEC.md`](./MOONBAGS_LAB_PRODUCT_SPEC.md)
Data addendum: [`MOONBAGS_LAB_DATA_TOOLING_ADDENDUM.md`](./MOONBAGS_LAB_DATA_TOOLING_ADDENDUM.md)

---

## 0. Archive Contract

This file preserves the larger MoonBags Lab v1 plans without letting them drive
MVP code growth.

### Provenance note

The original long-form v1 spec was slimmed before it was committed to git. This
archive reconstructs the load-bearing v1 ideas from the current chat context:
schemas, score-vector inventory, social/wallet definitions, mutation contracts,
roadmap families, and provider plans. It is intentionally not a verbatim copy of
v1; it is the preserved design memory that should be enough to restart a future
design pass without re-deriving the core concepts from scratch.

Nothing in this archive is approved for implementation by default.

A postponed capability may leave the archive only when:

1. Its `Revisit when:` trigger has fired from real cohort data or operator need.
2. The operator approves a small design pass.
3. The design names the edge channel, metric, falsifier, and smallest useful
   implementation.
4. The active product spec is patched with the narrowed scope.
5. Tests and operator acceptance are defined before code is written.

Archive rule:

> The archive is memory, not backlog. Do not build from it because it is
> interesting. Build from it only when the MVP data demands it.

---

## Part I — Full Measurement, Event, Edge, And Friction Expansion

### Revisit when

- The six MVP journal events are stable for at least three cohorts.
- `operator_summary.md` repeatedly needs missing evidence from an archived event.
- Friction v1 blocks a real promotion decision because execution error cannot be
  estimated from quote age, latency, and static slippage.
- The operator can name one decision that cannot be answered from the MVP
  journal and scorecard.

### Archived capabilities

Full v1 event taxonomy:

- `candidate`
- `token_safety_screen`
- `near_miss`
- `entry_decision`
- `buy_attempt`
- `buy_quote`
- `simulated_fill`
- `exit_decision`
- `sell_quote`
- `simulated_exit`
- `closed_outcome`
- `opportunity_lifecycle`
- `quote_ladder`
- `instant_roundtrip_probe`
- `counterfactual_entry`
- `counterfactual_exit`
- `provider_disagreement`
- `negative_control_result`
- `alpha_decay_probe`
- `portfolio_shadow_allocation`
- `token_pathology_label`
- `edge_hypothesis_update`
- `wallet_intelligence`
- `social_signal`
- `social_cluster`
- `social_outcome_update`
- `social_author_snapshot`

### V1 event schema sketches and deferred field groups

These sketches preserve the v1 memory. They are not active schemas. If any event
is revived, copy only the fields needed for the triggering decision and define
tests before implementation.

Shared envelope, inherited by every event:

```json
{
  "schemaVersion": 1,
  "eventId": "evt_...",
  "eventTime": "2026-05-02T14:00:00.000Z",
  "ingestTime": "2026-05-02T14:00:00.000Z",
  "cohortId": "c001",
  "speciesId": "risk-surgeon",
  "genomeId": "risk-surgeon:c001:g000",
  "instanceId": "risk-surgeon-01",
  "configHash": "sha256...",
  "promptHash": "sha256...",
  "candidateStreamId": "stream_...",
  "eventType": "..."
}
```

`candidate` deferred fields:

- source event id and raw payload ref,
- holders, liquidity, market cap,
- top-holder concentration,
- top-10 concentration,
- same-cluster concentration,
- bundled/sniper allocation rate,
- rug ratio,
- buy/sell ratio,
- holder growth,
- token age,
- social first-seen refs,
- wallet-flow refs,
- provider health.

`token_safety_screen` deferred fields:

- buy/sell quote availability,
- instant round-trip loss,
- mint authority active,
- freeze authority active,
- transfer-fee/tax suspected,
- pause/blacklist controls suspected,
- suspicious token-program/account-control features,
- liquidity floor,
- LP/pool fragility,
- top-holder concentration,
- same-cluster holder concentration,
- bundled supply rate,
- sniper allocation rate,
- dev/deployer retained supply,
- fake-volume score,
- CEX/ChangeNOW wash ambiguity,
- known rugger/deployer cluster,
- provider security warnings,
- triggered rules,
- classification: `tradable_candidate`, `quarantine_research_only`,
  `hard_block_obvious_toxicity`, `unknown_needs_more_data`,
- shadow outcome horizon.

`near_miss` deferred fields:

- near-miss type,
- failed rule name,
- threshold,
- observed value,
- distance from threshold,
- reason group,
- shadow outcome window,
- later max return,
- later max adverse excursion,
- whether the skip/block was correct.

`entry_decision` / `exit_decision` deferred fields:

- advisor type: deterministic / LLM / hybrid,
- action enum,
- confidence,
- reasoning tags,
- short rationale,
- cited facts,
- schema validation result,
- deterministic vetoes,
- LLM provider/model/latency/tokens/cost,
- recent similar cases,
- gate result,
- fallback action if LLM malformed.

`execution_record` deferred fields:

- quote side,
- raw quote,
- adjusted fill,
- slippage model,
- quote age,
- route metadata,
- route hash,
- price impact,
- decision latency,
- signing delay simulation,
- priority-fee estimate,
- route-change flag,
- failed/no-fill/partial-fill estimate,
- execution error class.

`closed_outcome` deferred fields:

- raw quote PnL,
- friction-adjusted PnL,
- peak PnL,
- max adverse excursion,
- hold time,
- close reason,
- exit quality,
- round-trip loss flag,
- tail-loss flag,
- largest-winner contribution,
- mistake type,
- avoidable-by tags,
- pathology label.

Special research-only event sketches:

- `opportunity_lifecycle`: first seen, first tradable, sources seen, opportunity
  curve, sellability windows, liquidity decay.
- `quote_ladder`: side, size ladder, out amounts, price impact by size,
  route-plan hashes, failures.
- `instant_roundtrip_probe`: buy quote, immediate sell quote, loss percent,
  route fragility, tradability risk.
- `provider_disagreement`: field, provider values, resolution rule, decision
  impact, outcome.
- `alpha_decay_probe`: base signal timestamp plus delayed clones at 5s, 15s,
  30s, 60s, 180s.
- `portfolio_shadow_allocation`: same mint/species/narrative/wallet-cluster
  overlap and finite-capital allocation.
- `token_pathology_label`: fixed label, confidence, evidence refs, horizon.

Full Opportunity Book:

- token lifecycle objects for every candidate, traded or not,
- first seen source and timestamp,
- first tradable timestamp,
- OHLCV opportunity curves,
- max return windows at 1m/5m/15m/1h/4h,
- max adverse excursion,
- time to peak,
- sellability windows,
- liquidity decay events,
- skipped-candidate shadow outcomes,
- regret metrics: entry regret, exit regret, skip regret, avoidance value.

Full Edge Ledger:

- edge hypotheses as first-class records,
- edge channels,
- status: active / rejected / regime-specific / promoted,
- required evidence,
- provider dependencies,
- species using each edge,
- last result summary,
- edge decay reports.

MVP simplification:

- Edge channel is a tag on patch and scorecard.
- Opportunity Book v0 is a compact journal-derived summary.
- No separate `edgeLedger/` subsystem.

Full friction expansion:

- `friction_v2`: empirical live calibration from paired dry/live trades.
- `friction_v3`: regime-aware, route-aware, provider-aware fill model.
- failed transaction probability,
- partial/no-fill probability,
- route change modeling,
- priority fee modeling,
- re-quote drift,
- token account/rent side costs,
- sell-quote unavailability windows,
- MEV/sandwich proxy,
- liquidity decay windows.

MVP simplification:

- Only `friction_v1` exists.
- `friction_v1` can support dry-run validation, never live eligibility.

### Full v1 score-vector inventory

The v1 score vector was intentionally broad. It is archived as an inventory, not
as an MVP contract.

Core PnL and distribution:

- `netPnlSolFrictionAdjusted`
- `netPnlPctFrictionAdjusted`
- `rawQuotePnlSol`
- `bootstrapP05Pnl`
- `bootstrapP50Pnl`
- `bootstrapP95Pnl`
- `maxDrawdownPct`
- `p95TailLossPct`
- `p99TailLossPct`
- `cvar95LossPct`
- `medianTradeReturnPct`
- `winRate`
- `tradeCount`
- `candidateCount`
- `entryRate`
- `roundTripLossRate`
- `missedRunnerRate`

Concentration and lottery-edge:

- `largestWinnerContributionPct`
- `largestLoserContributionPct`
- `pnlConcentrationGini`
- `outlierRemovedPnlPct`
- `largestWinnerRemovedPnlPct`
- `medianCohortPnlPct`
- `p05CohortPnlPct`
- `payoffRatioMedianWinToMedianLoss`
- `tailPayoffDependencyScore`

Blow-up and martingale risk:

- `negativeSkewScore`
- `lossConvexityScore`
- `largestLossToMedianWinRatio`
- `singleLossBankrollPct`
- `accountEndingLossProbabilityPct`
- `martingaleExposureFlag`
- `maxPositionSizeEscalationFactor`
- `maxAddsToLosingPosition`
- `stopLossIntegrityPass`

Bankroll survival:

- `expectedMaxLosingStreak`
- `observedMaxLosingStreak`
- `riskOfRuinPct`
- `requiredBankrollSol`
- `bankrollEnvelopePass`
- `ruinAdjustedExpectedValueSol`
- `lossLimitHitProbabilityPct`
- `expectedRecoveryTrades`

Opportunity and regret:

- `opportunityCaptureRatio`
- `entryRegretPct`
- `exitRegretPct`
- `skipRegretPct`
- `noTradeValuePct`
- `alphaHalfLifeSecs`

Execution and provider:

- `instantRoundTripLossMedianPct`
- `executionRobustnessIndex`
- `llmIncrementalValuePct`
- `providerDisagreementRate`
- `providerErrorRate`
- `liveCalibrationErrorPct`
- `p95DecisionLatencyMs`
- `llmCostUsd`
- `providerCostPerProfitableSignalUsd`

Token safety:

- `tokenSafetyScreenedCount`
- `tokenSafetyHardBlockCount`
- `obviousToxicityRate`
- `rugAvoidanceValuePct`
- `safetyFalseBlockRate`
- `providerSafetyMissRate`
- `sellabilityFailureRate`
- `bundledSupplyHardBlockRate`
- `mintAuthorityHardBlockRate`

Wallet/social/capital efficiency:

- `copyabilityAdjustedWalletSignalEV`
- social signal count, hit-rate, false-positive, lead-time, alpha half-life,
  copyability, crowding, provider cost, cost per useful social signal,
- average capital lockup,
- PnL per SOL-hour,
- PnL per minute in position,
- drawdown per SOL-hour.

### Do not build yet

- Counterfactual events.
- Alpha-decay probes beyond delayed clone.
- Full Opportunity Book tables.
- Separate Edge Ledger subsystem.
- Friction v2/v3.
- Quote ladder as a production event.
- Instant round-trip probe as mandatory entry input.

---

## Part II — Re-Entry, Multiple Entry, And Exposure Expansion

### Revisit when

- Single-entry species beat control across at least three dry-run cohorts.
- Re-entry shadow tracking shows positive outlier-removed value.
- Blow-up tail-risk checks show re-entry would not increase required bankroll.
- A canonical `ExposureLedger` exists and passes tests.

### Archived modes

- `disabled`: MVP default.
- `shadow_after_close`: observe only, no capital.
- `after_close`: allow a new full position after the prior one is closed.
- `scale_in`: add to an existing position.
- `pyramid`: add only when position is winning.
- `roundtrip`: multiple in/out cycles on the same mint.

### Archived setup archetypes

- `first_impulse`
- `post_blowoff_reclaim`
- `liquidity_rebuild`
- `smart_wallet_second_wave`
- `kol_delayed_push`
- `dead_cat_bounce`
- `rug_recovery_trap`

### Required future safety if revived

- Re-entry must be explicitly enabled per species.
- Maximum combined exposure is declared before the first entry.
- Adds after adverse movement are forbidden unless a new setup is independently
  proven and still fits bankroll envelope.
- All same-mint legs are scored as one combined risk unit.
- Hard stop applies to the combined position.
- Species cannot add when sellability, liquidity, holder quality, or token
  safety deteriorates.
- Martingale and unbounded averaging-down remain forbidden.

### Do not build yet

- Live re-entry.
- Scale-in or pyramid.
- Roundtrip species.
- Entry-leg accounting beyond shadow fields.
- Setup archetype taxonomy as a hard schema.

---

## Part III — Social Alpha Layer

### Revisit when

- Three core dry-run cohorts are complete.
- Manual social CSV timestamps show lead/lag value after friction.
- Timestamp-shuffle and delayed-clone controls fail to reproduce the social
  effect.
- The operator explicitly wants one source promoted from manual notes to
  log-only ingestion.

### Archived sources

- Two operator-approved Telegram groups.
- X/Twitter public data through GetXAPI or another approved read-only provider.
- X watchlists, user timelines, searches, lists.
- Manual KOL/social timestamp imports.

### Archived event types

- `social_signal`
- `social_cluster`
- `social_outcome_update`
- `social_author_snapshot`

### Archived social event schemas

`social_signal`:

```json
{
  "eventType": "social_signal",
  "eventId": "evt_social_...",
  "eventTime": "2026-05-02T14:00:00.000Z",
  "ingestTime": "2026-05-02T14:00:01.200Z",
  "source": {
    "type": "telegram_group|x_user|x_search_query|x_list|manual_import",
    "sourceId": "tg_group_alpha_01",
    "privacyLevel": "private_operator_approved|public",
    "permissionStatus": "approved",
    "collectionMode": "bot|manual_export|forwarder|api|csv"
  },
  "author": {
    "authorHash": "sha256...",
    "displayNameRedacted": true,
    "knownPublicKol": false
  },
  "rawPayloadRef": "lab/journals/raw/social/...",
  "textHash": "sha256...",
  "sanitizedText": "CA mentioned with early-entry claim and warning about low liquidity.",
  "extractedEntities": {
    "mints": ["..."],
    "tickers": ["ABC"],
    "urls": [],
    "wallets": [],
    "narratives": ["cat_meta", "pumpfun_launch"]
  },
  "signalClass": "early_call|risk_warning|exit_warning|narrative|kol_pump|rug_warning|liquidity_warning|unknown",
  "confidence": 0.62,
  "promptInjectionRisk": {
    "containsInstructionalText": true,
    "llmInstructionIgnored": true
  },
  "linkedTokenLifecycleIds": ["tl_..."],
  "providerHealth": {
    "latencyMs": 1200,
    "rateLimited": false
  }
}
```

`social_cluster`:

```json
{
  "eventType": "social_cluster",
  "clusterId": "soc_cluster_...",
  "mint": "...",
  "windowSecs": 900,
  "sourceCounts": { "telegram_group": 2, "x_user": 4, "x_search": 21 },
  "independentSourceCount": 3,
  "echoAdjustedMentionCount": 5,
  "firstSeenAt": "2026-05-02T14:00:00.000Z",
  "peakVelocityMentionsPerMin": 4.2,
  "clusterClass": "early_discovery|crowded_pump|exit_liquidity|risk_alert|unknown",
  "confidence": 0.7
}
```

`social_outcome_update`:

```json
{
  "eventType": "social_outcome_update",
  "socialSignalEventId": "evt_social_...",
  "mint": "...",
  "outcomeWindows": {
    "return1mPct": 0.0,
    "return5mPct": 0.0,
    "return15mPct": 0.0,
    "return1hPct": 0.0,
    "return4hPct": 0.0,
    "maxReturn1hPct": 0.0,
    "maxAdverseExcursion1hPct": 0.0
  },
  "leadLag": {
    "secsBeforeFirstGmgnSignal": 420,
    "secsBeforeFirstOkxSignal": null,
    "secsBeforeFirstSmartWalletBuy": 180,
    "secsBeforeMoonbagsCandidate": 510,
    "secsBeforePriceExpansion": 240
  },
  "copyability": {
    "quoteAvailableAtSignal": true,
    "instantRoundTripLossPct": -6.8,
    "alphaRemainingAfter30sPct": 0.52,
    "alphaRemainingAfter120sPct": 0.08,
    "maxCopySizeSol": 0.02
  }
}
```

`social_author_snapshot`:

```json
{
  "eventType": "social_author_snapshot",
  "sourceType": "telegram_group|x_user",
  "authorHash": "sha256...",
  "period": "30d",
  "metrics": {
    "mentions": 48,
    "uniqueMints": 37,
    "hitRate15m": 0.31,
    "hitRate1h": 0.44,
    "medianLeadTimeBeforeExpansionSecs": 210,
    "falsePositiveRate": 0.49,
    "rugMentionRate": 0.11,
    "copyabilityScore": 0.38,
    "originalityScore": 0.62,
    "exitWarningPrecision": 0.27
  },
  "confidence": 0.51
}
```

Lead/lag framework:

```text
lead_to_provider_secs = provider_first_seen_at - social_first_seen_at
lead_to_price_expansion_secs = first_price_expansion_at - social_first_seen_at
social_after_move_secs = social_first_seen_at - first_price_expansion_at
alpha_remaining_after_delay_pct =
  delayed_shadow_return(delay) / immediate_shadow_return
```

Archived placebo tests:

- delayed social clone: +30s, +2m, +5m, +15m,
- timestamp shuffle within same day/regime,
- author shuffle,
- source shuffle,
- echo collapse,
- inverse social species,
- post-move detector.

### Archived capabilities

- token/entity extraction,
- author/source scoring,
- social echo collapse,
- independent source counts,
- lead/lag against GMGN, OKX, Birdeye, smart-wallet flow, MoonBags candidate
  time, Jupiter tradability, and price expansion,
- social placebo tests,
- delayed social clones,
- source/author shuffle,
- social cluster classification,
- social-to-token opportunity links,
- social feature caps in entry/exit prompts,
- social-primary shadow species.

### Archived social usage ladder

MVP collapses this to `off` / `manual_csv` only.

Full ladder:

- L0: manual notes only.
- L1: log only.
- L2: shadow research.
- L3: researcher context.
- L4: entry/exit feature capped.
- L5: social-primary shadow species.
- L6: live-eligible social feature after repeated proof.

### Non-negotiables if revived

- Social is evidence, not instruction.
- No social-only live buys.
- No posting, liking, retweeting, replying, DMing, inviting users, or social
  side effects.
- Raw private group text must not be sent to external LLMs.
- Private author identities are hashed.
- Prompt-injection text inside messages is ignored.
- Telegram bot coverage must be verified before any lead/lag conclusion.

### Do not build yet

- Telegram bot ingestion.
- GetXAPI client.
- Social author profiles.
- Echo-collapse graph.
- Social clusters.
- Social placebos beyond manual analysis.
- Social features visible to species.

---

## Part IV — Wallet Intelligence

### Revisit when

- The MVP scorecard shows simple GMGN/OKX wallet flags have measurable
  predictive value.
- Wallet signal quality appears in the top reasons a species wins or loses.
- Manual inspection shows wallet truth, lead time, or copyability is blocking a
  concrete promotion decision.

### Archived capabilities

- wallet profile,
- wallet scoring,
- wallet copyability,
- wallet cluster decorrelation,
- common funding detection,
- side-wallet probability,
- KOL side-wallet hypothesis,
- obfuscation signals,
- CEX/ChangeNOW/instant-exchange wash risk,
- funding traces,
- dormancy/reuse analysis,
- allocation vs buy classification,
- wallet exit discipline,
- crowding risk,
- edge remaining after 30s/2m/5m delays,
- maximum copy size before impact,
- regime-specific wallet usefulness.

### Archived wallet profile fields

- raw profitability score,
- copyability score,
- average lead time before expansion,
- median liquidity at signal,
- crowding risk,
- edge remaining after delay,
- max copy size SOL,
- exits before retail,
- receives allocation vs buys,
- common funding risk,
- common exit risk,
- cluster signal weight.

### Archived wallet scoring definitions

These formulas are archived starting points, not active metrics.

Raw profitability score:

```text
rawProfitabilityScore =
  weighted_average(
    realized_pnl_pct,
    win_rate,
    median_trade_return,
    drawdown_penalty_inverse,
    tail_loss_penalty_inverse
  )
```

Copyability score:

```text
copyabilityScore =
  clamp01(
    lead_time_score
  * liquidity_at_signal_score
  * edge_remaining_after_latency_score
  * max_copy_size_score
  * crowding_inverse_score
  * exit_discipline_score
  * allocation_vs_buy_truth_score
  )
```

Edge remaining after delay:

```text
edgeRemainingAfterDelayPct(delay) =
  friction_adjusted_return_if_entered_at(wallet_signal_time + delay)
  / friction_adjusted_return_if_entered_at(wallet_signal_time)
```

Cluster signal weight:

```text
clusterSignalWeight =
  raw_wallet_count
  * independent_cluster_discount
  * common_funding_inverse
  * common_exit_inverse
  * copyabilityScore
```

Obfuscation confidence discount:

```text
obfuscationDiscount =
  max(
    cex_boundary_uncertainty,
    changenow_or_instant_exchange_uncertainty,
    bridge_boundary_uncertainty,
    reused_old_wallet_uncertainty,
    common_funding_uncertainty
  )
```

Allocation vs buy truth:

```text
allocation_vs_buy_truth_score = 1.0
  when wallet acquired via market buy
  0.5 when ambiguous
  0.0 when allocation/transfer masquerades as buy
```

Minimum future profile object:

```json
{
  "wallet": "...",
  "rawProfitabilityScore": 0.82,
  "copyabilityScore": 0.21,
  "avgLeadTimeBeforeExpansionSecs": 18,
  "medianLiquidityAtSignalUsd": 9000,
  "crowdingRisk": 0.74,
  "edgeRemainingAfter30sDelayPct": 0.12,
  "edgeRemainingAfter120sDelayPct": -0.08,
  "maxCopySizeSolBeforeImpact": 0.015,
  "exitsBeforeRetail": true,
  "oftenReceivesAllocationNotBuys": false,
  "walletClusterId": "cluster_...",
  "clusterConfidence": 0.68,
  "independentWalletCount": 2,
  "rawWalletCount": 11,
  "commonFundingRisk": 0.77,
  "commonExitRisk": 0.42,
  "obfuscationDiscount": 0.31
}
```

Future use rule:

> A wallet may affect entries only if it is profitable, early enough, liquid
> enough, not too crowded, not merely receiving allocations, and still positive
> after the lab's realistic latency.

### MVP simplification

- Use existing GMGN/OKX smart-wallet or signal flags only as candidate features.
- No wallet database.
- No wallet copyability score.
- No side-wallet inference.
- No wallet graph tooling.

---

## Part V — Data Warehouse Expansion

### Revisit when

- DuckDB cohort scoring over MVP JSONL has p95 latency above 30 seconds on a real
  cohort.
- Local disk exceeds the operator-approved monthly storage budget.
- Scorecard/replay queries become the bottleneck in two consecutive cohorts.
- Data retention cannot be handled by daily gzip and 30-day local retention.

### Archived architecture

- Bronze/Silver/Gold warehouse,
- JSONL.zst raw compression,
- daily Parquet conversion,
- DuckDB catalog over Silver and Gold,
- feature/scorecard Gold tables,
- partitioning by date/event/source/cohort/species/timeframe/horizon,
- schema registry,
- compaction lag reporting,
- hot/warm/cold retention,
- object storage archive trigger,
- ClickHouse migration trigger,
- data ops report,
- warehouse manifest.

### MVP simplification

- Append-only JSONL per event type per day.
- Gzip daily.
- 30-day local retention.
- DuckDB queries JSONL directly when needed.
- No Bronze/Silver/Gold naming in code.

---

## Part VI — LLM Researcher, Critic, Agent Drift, And Autonomous Mutation

### Revisit when

- At least three cohorts are complete.
- Human-labeled decision/outcome data exists.
- Manual patches have already worked end to end.
- Deterministic baseline already beats control or shows one promising edge
  channel.
- The operator can explain why prior patches won or failed.

### Archived roles

- Researcher LLM: reads summaries and proposes bounded patches.
- Critic LLM: challenges hypothesis, false positives, safety, overfit.
- Config mutator: emits patch JSON.
- Agent operator: produces cohort post-mortems and hypothesis notes.

### Archived mutation loop

```text
champion genome
+ last 3 scorecards
+ clustered winners/losers
+ near misses
+ discarded hypotheses
+ regime tags
=> researcher proposal
=> critic
=> schema/bounds validator
=> replay/sanity twin
=> challenger cohort
=> vector promotion
```

### Archived autonomous patch contract

If the LLM researcher is ever revived, it may propose only the same patch shape
used by the MVP manual patch flow, plus researcher metadata:

```json
{
  "schemaVersion": 1,
  "patchId": "patch_...",
  "targetGenomeId": "exit-llm:c004:g000",
  "proposedBy": "researcher_llm",
  "agentRunId": "agentrun_...",
  "edgeChannel": "exit_timing",
  "hypothesis": "...",
  "expectedEffect": "...",
  "falsifier": "...",
  "simplerBaseline": "...",
  "risk": "...",
  "boringAlternativeExplanation": "...",
  "negativeControl": "...",
  "promptChanges": {
    "sectionEdits": [],
    "fewShotAdd": [],
    "fewShotRemove": []
  },
  "configChanges": [],
  "structuralChanges": [],
  "safetyAssertions": {
    "dryRunUnchanged": true,
    "hardStopUnchanged": true,
    "walletUnchanged": true,
    "executionClientUnchanged": true,
    "safetyFloorUnchanged": true,
    "reentryModeUnchanged": true,
    "positionSizeUnchanged": true
  },
  "promptComplexityDelta": {
    "sectionsAdded": 0,
    "sectionsRemoved": 0,
    "tokensAdded": 0,
    "tokensRemoved": 0
  }
}
```

Researcher prompt contract:

- name one edge channel,
- name one metric expected to move,
- name one falsifier,
- name one simpler deterministic baseline,
- name one boring alternative explanation,
- cite only cohort summaries and approved derived datasets,
- do not request raw secrets, private social logs, wallet keys, `.env`, live
  controls, or provider credentials,
- do not propose live mode, size increase, hard-filter removal, execution-client
  mutation, or safety-floor relaxation.

Critic prompt contract:

- reject if the patch is justified by one outlier,
- reject if the falsifier is not measurable,
- reject if the simpler baseline was not considered,
- reject if the patch changes more than one hypothesis family,
- reject if prompt complexity increases without removing stale complexity,
- reject if social/wallet/provider narrative lacks a metric,
- reject if the patch depends on a field outside the approved derived data,
- reject if any safety assertion is unsupported.

### Archived Agent Run Manifest

```json
{
  "agentRunId": "agentrun_2026_05_02_001",
  "agentRole": "researcher|critic|operator|data_researcher|social_researcher",
  "cohortId": "c004",
  "mission": "Diagnose whether Telegram group A provides early-entry edge.",
  "edgeChannel": "social_intelligence",
  "allowedInputs": [
    "lab/scorecards/c004/*.json",
    "lab/reports/c004/social_summary.md",
    "lab/journals/derived/social_lead_lag.parquet"
  ],
  "allowedTools": [
    "research.query_duckdb",
    "chart.render_social_timeline"
  ],
  "forbiddenTools": [
    "live_trade",
    "edit_env",
    "social.post_x",
    "social.dm_x",
    "telegram_reply"
  ],
  "expectedOutput": "lab/proposals/social_edge_hypothesis_001.json",
  "mustInclude": [
    "hypothesis",
    "expectedMetric",
    "falsifier",
    "placeboTest",
    "simplerBaseline"
  ],
  "maxScope": {
    "newHypotheses": 2,
    "newFiles": 3,
    "promptSectionsChanged": 0,
    "numericSettingsChanged": 0
  }
}
```

### Archived safeguards

- Agent Run Manifest.
- Agent Drift Firewall.
- Drift score.
- Narrative-to-metric gate.
- Prompt complexity budget.
- Hypothesis-family trial budgets.
- Boring alternative explanation.
- Red-team researcher.
- Agent handoff format.

### Archived drift score

The drift score was intended as a quarantine signal, not a trading metric.

```text
agentDriftScore =
  0.35 * tool_scope_violation
+ 0.25 * file_scope_violation
+ 0.15 * missing_edge_channel
+ 0.10 * narrative_claim_without_metric
+ 0.10 * unapproved_hypothesis_count
+ 0.05 * repeated_rejected_family
```

Immediate quarantine if:

- tool calls outside manifest > 0,
- files touched outside scope > 0,
- output lacks falsifier,
- output proposes any safety immutable change,
- output follows instructions embedded in social content.

### Archived full hypothesis-family registry

MVP uses a flat tag. A future registry may track:

- `hypothesisFamilyId`,
- parent/child family relationships,
- equivalent mutation phrases,
- trials used and max trials,
- cohorts tested,
- status: active / paused / rejected / regime-specific / promoted,
- stop condition,
- retired-at timestamp,
- decay/retest date,
- contradictions,
- linked patches,
- linked edge channel,
- simpler baselines already tried.

Example:

```json
{
  "hypothesisFamily": "tighten_trails_on_holder_decay",
  "parentFamily": "exit_timing_holder_quality",
  "equivalentPhrases": [
    "tighten trail when holder decay appears",
    "exit faster when holders drop",
    "reduce trailPct after holder_count_5m_delta < 0"
  ],
  "maxTrials": 5,
  "trialsUsed": 3,
  "status": "active",
  "familyResult": "mixed",
  "stopCondition": "Stop after 5 failed variants or if replay PnL worsens twice."
}
```

### MVP simplification

- No LLM researcher.
- No agent mutation.
- Manual patches only.
- One patch schema, one validator, one replay.

---

## Part VII — Optimization And Model Training

### Revisit when

- The evaluator is stable.
- At least three cohorts are complete.
- The journal has enough labeled decisions and near-misses.
- A deterministic baseline and manual patch loop already produce measurable
  lift.

### Archived tools

- Optuna for numeric thresholds.
- DSPy MIPROv2 for prompt/few-shot optimization.
- GEPA for reflective prompt/config evolution.
- Local low-latency models for hot-path gating.
- Supervised ML baselines: logistic regression, gradient-boosted trees, random
  forest, calibration models, survival/time-to-exit models.
- LLM incremental value tests.

### Archived optimization surfaces

- trail arm percent,
- trail percent,
- hard stop,
- max hold,
- min holders,
- min liquidity,
- buy/sell ratio,
- holder growth triggers,
- token safety thresholds above hard floors,
- prompt sections,
- few-shot exemplar selection.

### MVP simplification

- No Optuna.
- No DSPy/GEPA.
- No training.
- No local model serving.
- Manual prompt/config variants only.

---

## Part VIII — Reports, Docs, Dashboard, And Operator UX Expansion

### Revisit when

- The operator says the one-page `operator_summary.md` is insufficient for a
  recurring decision.
- A report is opened and used every cohort for three cohorts.
- A dashboard decision cannot be made from the current MVP fields.

### Archived reports

- `edge_scorecard.md/json`
- `opportunity_book_summary.md/json`
- `scorecard_reading_notes.md`
- `researcher_report.md`
- `critic_report.md`
- `promotion_decision.md/json`
- `live_friction_report.md`
- `negative_controls_report.md`
- `alpha_half_life_report.md`
- `portfolio_shadow_allocation.md/json`
- `bankroll_survival_report.md/json`
- `blow_up_tail_risk_report.md/json`
- `social_lead_lag_report.md`
- `social_placebo_report.md`
- `agent_drift_report.md/json`
- `data_ops_report.md/json`
- `warehouse_manifest.md/json`
- `agent_handoff.md`

### Archived docs

- capability cards,
- decision cards,
- full operator manual,
- context map,
- large glossary,
- AI coding dictionary for traders,
- Grill Gate docs,
- architecture zoom-out command,
- trader mode / engineer mode dashboard split,
- profile cards.

### MVP simplification

One required report per cohort:

- `operator_summary.md` (one page)

Optional drill-downs:

- `scorecard.json`
- `friction_v1_sanity.md`
- `journal_summary.md`
- `replay_report.md`

---

## Part IX — Provider Upgrade Ladder

### Revisit when

- Birdeye package and cost caps are verified.
- MVP cohorts show a specific missing provider feature blocks a specific metric.
- The free/manual alternative has been tried.
- The provider feature has a written ROI hypothesis and monthly cap.
- The strategy using the feature passes bankroll and blow-up gates.

### MVP provider stack

- Birdeye BDS: only paid provider.
- GMGN: existing/free seed signals.
- OKX OnchainOS: existing/free secondary source.
- Helius free: transaction truth where needed.
- Jupiter: quotes/execution substrate.
- Manual social CSV only.

### Archived paid upgrade candidates

- Helius higher tier or dedicated low-latency plan.
- Nansen API.
- Bitquery paid streaming/GraphQL.
- Arkham API.
- Solscan Pro.
- Dune paid tier.
- Specialized security/graph APIs: GoPlus paid, RugCheck/FluxRPC, DeFade,
  Bubblemaps-style holder graph tooling.
- GetXAPI for X/Twitter.

### Fast-track exception

Specialized security/graph APIs may move earlier only if token-safety misses are
causing measured drawdowns, unsafe live-calibration candidates, or excessive
LLM/research noise.

### Provider states

If revived, every provider/endpoint must have one state:

- `disabled`
- `manual_only`
- `batch_only`
- `shadow_only`
- `hot_path_allowed`

No provider starts as `hot_path_allowed`.

---

## Part X — Regime Router, Portfolio Allocator, Charts, And Token Pathology

### Revisit when

- At least two species show different strengths across clearly tagged market
  conditions.
- Same-token/same-narrative overlap creates inflated dry-run PnL.
- The operator repeatedly needs chart evidence for specific promotion decisions.
- Token safety/pathology labels explain repeated losses or missed winners.

### Archived capabilities

Regime router:

- high-volatility pump,
- dead chop low liquidity,
- insider distribution risk,
- social/crowded pump,
- smart-wallet accumulation,
- risk-off pause.

Portfolio allocator:

- finite capital allocation across species,
- same mint exposure cap,
- same wallet cluster exposure cap,
- same narrative exposure cap,
- duplicate dry-run PnL correction,
- PnL per SOL-hour.

Charting:

- entry chart,
- exit chart,
- missed-runner chart,
- liquidity chart,
- holder chart,
- wallet-flow overlay,
- quote ladder chart,
- species comparison chart,
- chart-to-text summaries.

Token pathology taxonomy:

- clean momentum,
- slow bleed,
- violent roundtrip,
- insider distribution,
- liquidity trap,
- fake volume,
- bundler exit,
- KOL exit liquidity,
- dead cat reentry,
- second-leg runner,
- untradeable pump,
- rug recovery trap.

### MVP simplification

- No regime router.
- No portfolio allocator.
- No chart artifact storage beyond optional manual screenshots.
- No hard pathology taxonomy.
- Use free-text operator notes if needed.

---

## Part XI — Live Capital Ladder

### Revisit when

- Three dry-run cohorts pass MVP gates.
- Shadow quote mode has been implemented and manually reviewed.
- Dedicated calibration wallet exists with tiny funds only.
- Kill switch is tested.
- Bankroll envelope is signed by operator.
- Friction v1 has proven insufficient and paired dry/live calibration is needed.

### Archived stages

```text
dry_run_only
shadow_live_quote
micro_live_probe
micro_live_repeatability
small_live_canary
small_live_scaled
```

### Archived requirements

Shadow live quote:

- get quote,
- wait signing-delay simulation,
- re-quote,
- record price drift,
- priority fee estimate,
- route changes,
- quote failures,
- sellability,
- instant round-trip loss.

Micro-live:

- dedicated calibration wallet,
- manual arming,
- session nonce or confirmation phrase,
- fixed tiny max position,
- max open position 1,
- max daily/weekly/total loss,
- no auto-reload,
- every live trade linked to dry-run prediction event,
- live calibration report after every trade,
- panic stop tested before first live probe.

Small live:

- not allowed until paired dry/live calibration shows dry-run predictions are
  directionally reliable and bankroll envelope survives.

### MVP simplification

- `dry_run_only` only.
- Live arming command exists only to return "not enabled in this build."

---

## Part XII — Full v1 Roadmap

### Revisit when

- MVP Phase E is complete.
- The operator has read three cohort summaries and can name the next constraint.
- The next phase is justified by a specific blocker from cohort data.

### Archived 12-phase roadmap

1. Worktree/fork and isolation.
2. Journal, friction v1, Opportunity Book.
3. A/A controls and delayed clones.
4. Frozen species and no-trade shadow.
5. Regret metrics and edge attribution.
6. Manual mutation.
7. LLM researcher with human approval.
8. Full mutation loop.
9. Shadow live quote mode.
10. Micro-live calibration.
11. Numeric optimization.
12. Prompt/few-shot optimization and live-eligible champion.

### Archived phase deliverables

Phase 1: Worktree/fork and isolation

- private fork or worktree,
- separate `.env`, state, logs, dashboard port, PM2 name,
- lab doctor,
- DRY_RUN default,
- initial operator docs and ADRs.

Phase 2: Journal, friction v1, Opportunity Book

- append-only event journal,
- stable event envelope,
- initial friction model,
- token lifecycle / opportunity records,
- raw payload references,
- skipped-candidate shadow tracking.

Phase 3: A/A controls and delayed clones

- identical control runners,
- same candidate universe,
- A/A variance report,
- delayed clones at configured latency buckets,
- alpha half-life estimates.

Phase 4: Frozen species and no-trade shadow

- Control,
- Exit-Savant,
- Momentum-Friendly,
- Risk-Surgeon,
- Regime-Abstainer / no-trade shadow,
- shared entry universe,
- frozen genomes for cohort duration.

Phase 5: Regret metrics and edge attribution

- entry regret,
- exit regret,
- skip regret,
- avoidance value,
- edge-channel attribution,
- opportunity capture ratio.

Phase 6: Manual mutation

- patch schema,
- patch validator,
- operator summary,
- replay/sanity twin,
- hypothesis-family registry v0.

Phase 7: LLM researcher with human approval

- researcher prompt,
- critic prompt,
- read-only derived data access,
- bounded patch proposals,
- human approval only.

Phase 8: Full mutation loop

- researcher -> critic -> validator -> replay -> challenger,
- vector promotion,
- discarded hypotheses,
- prompt complexity budget,
- agent drift report.

Phase 9: Shadow live quote mode

- quote/re-quote without trading,
- signing-delay simulation,
- priority-fee estimate,
- route changes,
- sellability,
- dry-vs-live friction report.

Phase 10: Micro-live calibration

- dedicated calibration wallet,
- manual arming,
- tiny size caps,
- paired dry/live records,
- friction v2 calibration.

Phase 11: Numeric optimization

- Optuna wrapper,
- bounded numeric spaces,
- replay-based objective,
- trial registry.

Phase 12: Prompt/few-shot optimization and live-eligible champion

- DSPy/GEPA harness,
- labeled dataset,
- prompt candidate registry,
- prompt promotion rules,
- live eligibility report,
- small-capital plan.

### MVP roadmap replacement

The active spec uses five phases:

- Phase A: Isolation & Safety Shell.
- Phase B: Journal & Token Safety Pre-Screener.
- Phase C: Friction v1 & Scorecard.
- Phase D: Two-Species Dry-Run Cohort.
- Phase E: Manual Mutation Loop.

---

## Part XIII — Full v1 Ticket Backlog

### Revisit when

- The active MVP backlog is complete.
- A postponed ticket has a triggering cohort finding.
- The operator approves moving exactly one archived ticket into active scope.

### Archived ticket families

Original v1 included roughly 45 tickets. They are grouped here by family rather
than kept as active backlog.

Safety and runtime:

- path isolation,
- DRY_RUN immutability,
- wallet and secrets isolation,
- live arming,
- panic stop,
- bankroll envelope,
- lottery-edge rejection,
- high-win-rate blow-up rejection,
- token safety pre-screener.

Measurement:

- event journal,
- Opportunity Book,
- Edge Ledger,
- scorecard,
- lower-confidence promotion,
- regret metrics,
- negative controls,
- alpha half-life,
- replay/sanity twin.

Data and providers:

- Birdeye,
- Helius,
- GMGN,
- OKX,
- security providers,
- provider contract tests,
- provider ROI ledger,
- warehouse spine,
- compaction/retention.

Social and wallet:

- manual social importer,
- Telegram ingestion,
- GetXAPI,
- social lead/lag,
- social placebos,
- wallet profiles,
- wallet clusters,
- copyability,
- obfuscation.

Agents and optimization:

- researcher,
- critic,
- agent drift firewall,
- agent handoff,
- Optuna,
- DSPy/GEPA,
- local model serving.

Operator experience:

- dashboard,
- report bundle,
- capability cards,
- decision cards,
- operator runbooks,
- ADR system,
- AI coding dictionary.

### Archived ticket sketches

Representative v1 tickets, preserved as sketches rather than active backlog:

1. Create private fork/worktree and lab branch.
2. Add runtime path isolation.
3. Add lab event journal.
4. Add friction v1.
5. Add A/A control runner.
6. Add species genome loader.
7. Add cohort scorecard.
8. Add patch validator.
9. Add sanity-twin replay.
10. Add operator summary.
11. Add Opportunity Book.
12. Add Edge Ledger.
13. Add quote ladder and instant round-trip probes.
14. Add delayed-clone alpha half-life tests.
15. Add portfolio shadow allocation.
16. Add bankroll envelope and risk-of-ruin gate.
17. Add lottery-edge rejection report.
18. Add high-win-rate blow-up rejection report.
19. Add token safety pre-screener.
20. Add token safety false-block/miss audit.
21. Add Birdeye BDS client and usage logger.
22. Add Helius free-tier truth cross-check.
23. Add provider contract test harness.
24. Add provider ROI ledger.
25. Add manual social timestamp importer.
26. Add Telegram group ingestion.
27. Add GetXAPI read-only provider.
28. Add social lead/lag report.
29. Add social placebo controls.
30. Add wallet profile table.
31. Add wallet copyability scoring.
32. Add wallet cluster decorrelation.
33. Add obfuscation and CEX/ChangeNOW ambiguity signals.
34. Add chart renderer.
35. Add chart-to-text summaries.
36. Add token pathology labels.
37. Add regime tags.
38. Add regime router.
39. Add LLM researcher.
40. Add critic and red-team reviewer.
41. Add Agent Drift Firewall.
42. Add Optuna numeric optimization.
43. Add DSPy/GEPA prompt optimization.
44. Add shadow live quote mode.
45. Add micro-live calibration.

### Active MVP tickets

The active spec replaces the 45-ticket backlog with 10 tickets only. An archived
ticket must not be implemented until promoted into the active spec.
