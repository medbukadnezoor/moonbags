/**
 * LLM exit advisor for open meme-token positions.
 *
 * Provider: MiniMax (OpenAI-compatible chat completions API).
 *   - Endpoint: https://api.minimax.io/v1/chat/completions
 *   - Model:    MiniMax-M2.7
 *   - Auth:     Bearer ${MINIMAX_API_KEY}
 *
 * Design choice: OPTION A (single-shot tool calling).
 *   We poll exit logic every ~30s and pre-fetch a full PositionSnapshot
 *   from okxClient.getPositionSnapshot() before calling the LLM. Freshness
 *   isn't an issue, so paying for extra round-trips just to let the model
 *   re-fetch the same data we already have wastes latency and tokens. We
 *   compress the snapshot into a compact text/JSON summary, force the model
 *   to call a single `submit_decision(action, reason, new_trail_pct?)` tool,
 *   and parse its arguments. The trailing stop remains the default exit —
 *   the LLM only overrides it when there's a clear cue.
 *
 * On any failure (missing key, network error, API error, malformed tool
 * call, schema mismatch) we return null and let the caller fall back to
 * the existing trail logic.
 */

import logger from "./logger.js";
import type {
  PositionSnapshot,
  PriceMomentum,
  TradeWindow,
  TopHoldersSnapshot,
  LiquidityPool,
  TokenRisk,
  SignalRecord,
  Candle,
} from "./okxClient.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export type LlmDecision = {
  action: "hold" | "exit_now" | "tighten_trail";
  reason: string;
  newTrailPct?: number;
};

export type LlmContext = {
  name: string;
  mint: string;
  entryPriceUsd: number;
  currentPriceUsd: number;
  pnlPct: number;
  peakPnlPct: number;
  drawdownFromPeakPct: number;
  currentTrailPct: number;
  holdSecs: number;
};

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------
const MINIMAX_ENDPOINT = "https://api.minimax.io/v1/chat/completions";
const MINIMAX_MODEL = "MiniMax-M2.7";
const HTTP_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_TOKENS = 2000;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an exit-decision advisor for a Solana meme-token auto-trading bot.

For each open position you are given:
  - the position context (entry, current price, PnL %, peak PnL %, drawdown
    from peak, the trailing-stop % currently in effect, hold duration)
  - an on-chain snapshot: price/volume momentum across 5m/1h/4h/24h, recent
    smart-money / bundler / dev / whale / insider trade windows, top-10
    holders' avg PnL and trend, liquidity pools, token risk profile, recent
    smart-money signals, and a compact 1m + 5m kline summary.

Position prices (entryPriceSol/currentPriceSol) are denominated in SOL per
token. The token's USD price lives in snapshot.momentum.priceUsd. Do not
compare these directly without converting.

Your job is to choose ONE of three actions:
  - "hold"          — leave the existing trailing stop alone
  - "tighten_trail" — lower the trail to lock in more profit (provide
                      new_trail_pct as a decimal in (0, currentTrailPctDecimal))
  - "exit_now"      — sell the entire position immediately

Exit philosophy (apply strictly):
  1. PAST DEV BEHAVIOR DOES NOT MATTER. devCreateTokenCount,
     devLaunchedTokenCount, and devRugPullTokenCount are history. Only
     CURRENT dev pressure matters.
  2. If risk.devHoldingPercent === 0, the dev is OUT — there is no future
     dev dump pressure. Do NOT use prior rugs as an exit reason.
  3. If risk.devHoldingPercent > 0 AND the dev trade window shows sells,
     that is a STRONG exit cue — call exit_now or tighten aggressively.
  4. Bundlers selling at the top (bundlers.netFlowSol << 0) is mildly
     bearish but not exit-worthy on its own; combine with other cues.
  5. Top-10 holders deeply underwater (topHolders.averagePnlUsd << 0) is
     capitulation risk if price rolls over — favor tightening when momentum
     also fades.
  6. Smart money flipping from net-buy to net-sell (smartMoney.netFlowSol
     << 0 with recent sell volume) is a STRONG exit cue.
  7. Volume cliff (e.g. volume5m collapsed vs. volume1h/12 implied rate)
     means momentum is dead — favor tighten_trail or exit_now if PnL is
     positive and drawdown is widening.
  8. If nothing alarming is happening and momentum is intact, prefer
     "hold". Do not overtrade. The trailing stop already protects profit.

Constraints on tighten_trail:
  - new_trail_pct is a DECIMAL (0.0 to 1.0), NOT whole percent.
    e.g. 0.20 means 20% trail. 20.0 would be invalid (>= currentTrailPctDecimal).
  - Must be in the OPEN interval (0, currentTrailPctDecimal).
  - Tighter (smaller) than current. Typical values: 0.10 to 0.30.
  - If you can't justify a number tighter than the current trail, use "hold".

Output: you MUST respond by calling the submit_decision tool. Do not write
prose. The "reason" field is shown to the user in Telegram — keep it to
1-2 sentences and reference the specific on-chain cue you used.`;

// ---------------------------------------------------------------------------
// Tool schema (OpenAI / MiniMax compatible)
// ---------------------------------------------------------------------------
const SUBMIT_DECISION_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_decision",
    description:
      "Submit the exit decision for the current position. Must be called exactly once.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["hold", "exit_now", "tighten_trail"],
          description:
            "hold = keep existing trail; exit_now = sell entire position immediately; tighten_trail = lower the trail %.",
        },
        reason: {
          type: "string",
          description:
            "1-2 sentences explaining the decision, referencing the specific on-chain cue. Shown to the user in Telegram.",
        },
        new_trail_pct: {
          type: "number",
          description:
            "REQUIRED only when action = tighten_trail. Decimal in (0, currentTrailPctDecimal), e.g. 0.20 for a 20% trail.",
        },
      },
      required: ["action", "reason"],
    },
  },
};

// ---------------------------------------------------------------------------
// Snapshot summarization — keep prompt compact (avoid 50KB blobs)
// ---------------------------------------------------------------------------
function fmtNum(n: number, digits = 2): number {
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(digits));
}

function summarizeMomentum(m: PriceMomentum | null): unknown {
  if (!m) return null;
  return {
    priceUsd: fmtNum(m.priceUsd, 8),
    marketCapUsd: fmtNum(m.marketCapUsd, 0),
    liquidityUsd: fmtNum(m.liquidityUsd, 0),
    holders: m.holders,
    pctFromAth: fmtNum(m.pctFromAth, 2),
    priceChange: {
      "5m": fmtNum(m.priceChange5m, 2),
      "1h": fmtNum(m.priceChange1h, 2),
      "4h": fmtNum(m.priceChange4h, 2),
      "24h": fmtNum(m.priceChange24h, 2),
    },
    volumeUsd: {
      "5m": fmtNum(m.volume5m, 0),
      "1h": fmtNum(m.volume1h, 0),
      "4h": fmtNum(m.volume4h, 0),
      "24h": fmtNum(m.volume24h, 0),
    },
    txs: { "5m": m.txs5m, "1h": m.txs1h, "4h": m.txs4h, "24h": m.txs24h },
  };
}

function summarizeWindow(w: TradeWindow): unknown {
  return {
    windowMins: w.windowMins,
    buys: w.buys,
    sells: w.sells,
    buyVolumeSol: fmtNum(w.buyVolumeSol, 4),
    sellVolumeSol: fmtNum(w.sellVolumeSol, 4),
    netFlowSol: fmtNum(w.netFlowSol, 4),
    uniqueWallets: w.uniqueWallets,
  };
}

function summarizeHolders(h: TopHoldersSnapshot | null): unknown {
  if (!h) return null;
  return {
    rangeFilter: h.rangeFilter,
    holdingPercent: fmtNum(h.holdingPercent, 2),
    averagePnlUsd: fmtNum(h.averagePnlUsd, 2),
    averageBuyPricePercent: fmtNum(h.averageBuyPricePercent, 2),
    averageSellPricePercent: fmtNum(h.averageSellPricePercent, 2),
    trendType: h.trendType,
    averageHoldingPeriodSecs: h.averageHoldingPeriodSecs,
  };
}

function summarizeLiquidity(pools: LiquidityPool[]): unknown {
  // top 3 pools by liquidity is enough context
  const top = [...pools].sort((a, b) => b.liquidityUsd - a.liquidityUsd).slice(0, 3);
  const totalUsd = pools.reduce((s, p) => s + p.liquidityUsd, 0);
  return {
    totalLiquidityUsd: fmtNum(totalUsd, 0),
    poolCount: pools.length,
    topPools: top.map(p => ({
      protocol: p.protocolName,
      liquidityUsd: fmtNum(p.liquidityUsd, 0),
    })),
  };
}

function summarizeRisk(r: TokenRisk | null): unknown {
  if (!r) return null;
  return {
    tokenTags: r.tokenTags,
    riskControlLevel: r.riskControlLevel,
    bundleHoldingPercent: fmtNum(r.bundleHoldingPercent, 2),
    top10HoldPercent: fmtNum(r.top10HoldPercent, 2),
    sniperHoldingPercent: fmtNum(r.sniperHoldingPercent, 2),
    suspiciousHoldingPercent: fmtNum(r.suspiciousHoldingPercent, 2),
    lpBurnedPercent: fmtNum(r.lpBurnedPercent, 2),
    devHoldingPercent: fmtNum(r.devHoldingPercent, 2),
    // historical-only stats are kept here so the model can SEE we're aware
    // of them — but the system prompt instructs it to ignore them for exits.
    devHistory: {
      createTokenCount: r.devCreateTokenCount,
      launchedTokenCount: r.devLaunchedTokenCount,
      rugPullTokenCount: r.devRugPullTokenCount,
    },
    snipersTotal: r.snipersTotal,
    snipersClearAddressCount: r.snipersClearAddressCount,
  };
}

function summarizeSignals(signals: SignalRecord[]): unknown {
  // Keep only the 5 most recent signals, compress fields.
  const top = [...signals].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  return top.map(s => ({
    walletType: s.walletType, // 1=SmartMoney, 2=KOL, 3=Whale
    triggerWalletCount: s.triggerWalletCount,
    amountUsd: fmtNum(s.amountUsd, 0),
    soldRatioPercent: fmtNum(s.soldRatioPercent, 2),
    ageSecs: Math.floor((Date.now() - s.timestamp) / 1000),
  }));
}

function summarizeKline(candles: Candle[], bar: string, keep: number): unknown {
  if (candles.length === 0) return { bar, candles: [] };
  // Keep only the most recent `keep` candles, and only the load-bearing fields.
  const slice = candles.slice(-keep);
  const closes = slice.map(c => c.close);
  const first = closes[0] ?? 0;
  const last = closes[closes.length - 1] ?? 0;
  const trendPct = first > 0 ? ((last / first) - 1) * 100 : 0;
  const totalVolUsd = slice.reduce((s, c) => s + c.volumeUsd, 0);
  return {
    bar,
    count: slice.length,
    trendPct: fmtNum(trendPct, 2),
    totalVolumeUsd: fmtNum(totalVolUsd, 0),
    closes: closes.map(c => fmtNum(c, 8)),
    volsUsd: slice.map(c => fmtNum(c.volumeUsd, 0)),
  };
}

function compactSnapshot(snapshot: PositionSnapshot): unknown {
  return {
    momentum: summarizeMomentum(snapshot.momentum),
    smartMoney: summarizeWindow(snapshot.smartMoney),
    bundlers: summarizeWindow(snapshot.bundlers),
    insiders: summarizeWindow(snapshot.insiders),
    whales: summarizeWindow(snapshot.whales),
    dev: summarizeWindow(snapshot.dev),
    topHolders: summarizeHolders(snapshot.topHolders),
    liquidity: summarizeLiquidity(snapshot.liquidity),
    risk: summarizeRisk(snapshot.risk),
    recentSignals: summarizeSignals(snapshot.signals),
    // 1m: last 20 candles ≈ 20 minutes; 5m: last 12 candles ≈ 1 hour broader trend.
    kline1m: summarizeKline(snapshot.kline1m, "1m", 20),
    kline5m: summarizeKline(snapshot.kline5m, "5m", 12),
  };
}

// ---------------------------------------------------------------------------
// User-prompt builder
// ---------------------------------------------------------------------------
function buildUserPrompt(ctx: LlmContext, snapshot: PositionSnapshot): string {
  const payload = {
    position: {
      name: ctx.name,
      mint: ctx.mint,
      // The position is priced in SOL-per-token, NOT USD-per-token. The
      // separate `snapshot.momentum.priceUsd` IS the USD price.
      entryPriceSol: fmtNum(ctx.entryPriceUsd, 12),    // bump precision for tiny SOL values
      currentPriceSol: fmtNum(ctx.currentPriceUsd, 12),
      // All "...Pct" fields are in WHOLE PERCENT (e.g. 234 means +234%).
      // The trail field is named *Decimal* explicitly because new_trail_pct
      // must be in the SAME decimal scale (0.0 – 1.0+).
      pnlPct: fmtNum(ctx.pnlPct * 100, 2),
      peakPnlPct: fmtNum(ctx.peakPnlPct * 100, 2),
      drawdownFromPeakPct: fmtNum(ctx.drawdownFromPeakPct * 100, 2),
      currentTrailPctDecimal: fmtNum(ctx.currentTrailPct, 4),
      holdSecs: ctx.holdSecs,
    },
    snapshot: compactSnapshot(snapshot),
  };
  return [
    "Decide the exit action for this position using the philosophy in the system prompt.",
    "Call submit_decision exactly once.",
    "",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Network plumbing — single fetch with timeout
// ---------------------------------------------------------------------------
type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: ChatMessage;
    finish_reason?: string;
  }>;
  error?: { message?: string; type?: string };
};

async function callMinimax(
  apiKey: string,
  messages: ChatMessage[],
): Promise<ChatCompletionResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(MINIMAX_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages,
        tools: [SUBMIT_DECISION_TOOL],
        tool_choice: { type: "function", function: { name: "submit_decision" } },
        temperature: 0.2,
        max_tokens: MAX_OUTPUT_TOKENS,
        // M2.7 has native interleaved thinking. Setting reasoning_split=true via
        // extra_body keeps thinking content out of message.content, which prevents
        // the <think> block from eating the tool-call JSON budget.
        extra_body: { reasoning_split: true },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, body: text.slice(0, 500) },
        "[llm] minimax http error",
      );
      return null;
    }
    return (await res.json()) as ChatCompletionResponse;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[llm] minimax request failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Decision-parsing
// ---------------------------------------------------------------------------
function parseDecision(
  resp: ChatCompletionResponse,
  ctx: LlmContext,
): LlmDecision | null {
  if (resp.error) {
    logger.warn({ err: resp.error }, "[llm] minimax api error");
    return null;
  }
  const msg = resp.choices?.[0]?.message;
  const call = msg?.tool_calls?.[0];
  if (!call || call.function?.name !== "submit_decision") {
    logger.warn({ msg }, "[llm] no submit_decision tool call in response");
    return null;
  }

  let args: { action?: string; reason?: string; new_trail_pct?: number };
  try {
    args = JSON.parse(call.function.arguments) as typeof args;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, raw: call.function.arguments },
      "[llm] failed to parse tool arguments",
    );
    return null;
  }

  const action = args.action;
  const reason = (args.reason ?? "").trim();
  if (!reason) {
    logger.warn("[llm] decision missing reason");
    return null;
  }

  if (action === "hold" || action === "exit_now") {
    return { action, reason };
  }
  if (action === "tighten_trail") {
    const newTrailPct = Number(args.new_trail_pct);
    if (
      !Number.isFinite(newTrailPct) ||
      newTrailPct <= 0 ||
      newTrailPct >= ctx.currentTrailPct
    ) {
      logger.warn(
        { newTrailPct, currentTrailPct: ctx.currentTrailPct },
        "[llm] tighten_trail with invalid new_trail_pct",
      );
      return null;
    }
    return { action, reason, newTrailPct };
  }

  logger.warn({ action }, "[llm] unknown action in decision");
  return null;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function consultLlm(
  ctx: LlmContext,
  snapshot: PositionSnapshot,
): Promise<LlmDecision | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    logger.warn("[llm] MINIMAX_API_KEY missing — skipping LLM consult");
    return null;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(ctx, snapshot) },
  ];

  const start = Date.now();
  const resp = await callMinimax(apiKey, messages);
  if (!resp) return null;

  const decision = parseDecision(resp, ctx);
  if (decision) {
    logger.info(
      {
        mint: ctx.mint,
        name: ctx.name,
        action: decision.action,
        newTrailPct: decision.newTrailPct,
        latencyMs: Date.now() - start,
      },
      "[llm] decision",
    );
  }
  return decision;
}
