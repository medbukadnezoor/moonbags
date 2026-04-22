/**
 * One-off analysis: fetch GMGN candidates with NO filters, enrich, get forward
 * OHLCV, compute peak forward PnL, then sweep each baseline filter threshold to
 * see which thresholds best separate winners from losers.
 *
 * Run: npx tsx src/_gmgnFilterAnalysis.ts
 *
 * Output:
 *   - state/gmgn-filter-analysis-<ts>.csv  (full per-candidate table)
 *   - stdout: threshold sweep summary
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getMarketSignal,
  getMarketTrenches,
  getMarketTrending,
  getTokenInfo,
  getTokenSecurity,
  isGmgnConfigured,
  type GmgnRow,
} from "./gmgnClient.js";

const execFileAsync = promisify(execFile);

type Candle = { ts: number; open: number; high: number; low: number; close: number };

type Candidate = {
  mint: string;
  symbol: string;
  source: "signal" | "trenches" | "trending";
  // Filter inputs
  liquidityUsd: number;
  holders: number;
  marketCapUsd: number;
  top10Pct: number;
  rugRatio: number;
  bundlerPct: number;
  creatorBalancePct: number;
  smartMoneyCount: number;
  kolCount: number;
  isHoneypot: boolean;
  isWashTrading: boolean;
  // Forward PnL outcome
  hasOhlcv: boolean;
  candleCount: number;
  entryPrice: number;
  maxPnLPct: number;   // peak high / entry - 1, %
  finalPnLPct: number; // last close / entry - 1, %
  minPnLPct: number;   // worst low / entry - 1, %
  timeToPeakMins: number;
};

function pickStr(row: GmgnRow, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickNum(row: GmgnRow, keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function pickBool(row: GmgnRow, keys: string[]): boolean {
  for (const k of keys) {
    const v = row[k];
    if (v === true || v === 1 || v === "true" || v === "1") return true;
    if (v === false || v === 0 || v === "false" || v === "0") return false;
  }
  return false;
}

function maybeRatioPct(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value <= 1 ? value * 100 : value;
}

async function fetchKlines(address: string): Promise<Candle[]> {
  try {
    const { stdout } = await execFileAsync("onchainos", [
      "market", "kline",
      "--address", address,
      "--chain", "solana",
      "--bar", "5m",
      "--limit", "299",
    ], { timeout: 12_000 });
    const parsed = JSON.parse(String(stdout)) as {
      ok?: boolean;
      data?: Array<{ ts: string; o: string; h: string; l: string; c: string }>;
    };
    if (parsed.ok === false || !parsed.data?.length) return [];
    return parsed.data
      .map((c) => ({
        ts: Number(c.ts),
        open: parseFloat(c.o),
        high: parseFloat(c.h),
        low: parseFloat(c.l),
        close: parseFloat(c.c),
      }))
      .filter((c) => c.open > 0)
      .sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

async function harvestCandidates(): Promise<Candidate[]> {
  const settled = await Promise.allSettled([
    getMarketSignal("sol", { groups: [{ signal_type: [12] }], limit: 30 }),
    getMarketTrenches("sol", { limit: 30 }),
    getMarketTrending("sol", "5m", { limit: 30 }),
  ]);
  const signalRows = settled[0].status === "fulfilled" ? settled[0].value : [];
  const trenchesRows = settled[1].status === "fulfilled" ? settled[1].value : [];
  const trendingRows = settled[2].status === "fulfilled" ? settled[2].value : [];

  const seen = new Map<string, Candidate>();
  const harvest = (rows: GmgnRow[], source: "signal" | "trenches" | "trending") => {
    for (const row of rows) {
      const mint = pickStr(row, ["address", "token_address", "mint", "contract_address"]);
      if (!mint || seen.has(mint)) continue;
      seen.set(mint, {
        mint,
        symbol: pickStr(row, ["symbol", "name"]) ?? mint.slice(0, 6),
        source,
        liquidityUsd: 0,
        holders: 0,
        marketCapUsd: 0,
        top10Pct: 0,
        rugRatio: 0,
        bundlerPct: 0,
        creatorBalancePct: 0,
        smartMoneyCount: 0,
        kolCount: 0,
        isHoneypot: false,
        isWashTrading: false,
        hasOhlcv: false,
        candleCount: 0,
        entryPrice: 0,
        maxPnLPct: 0,
        finalPnLPct: 0,
        minPnLPct: 0,
        timeToPeakMins: 0,
      });
    }
  };
  harvest(signalRows, "signal");
  harvest(trenchesRows, "trenches");
  harvest(trendingRows, "trending");
  return [...seen.values()];
}

async function enrichCandidate(c: Candidate): Promise<void> {
  const [info, sec] = await Promise.allSettled([
    getTokenInfo("sol", c.mint),
    getTokenSecurity("sol", c.mint),
  ]);
  if (info.status === "fulfilled" && info.value) {
    const r = info.value;
    c.liquidityUsd = pickNum(r, ["liquidity"]);
    c.marketCapUsd = pickNum(r, ["market_cap", "marketCap"]);
    c.holders = Math.round(pickNum(r, ["holder_count"]));
    if (!c.symbol || c.symbol === c.mint.slice(0, 6)) {
      const sym = pickStr(r, ["symbol", "name"]);
      if (sym) c.symbol = sym;
    }
    const stat = (r.stat ?? {}) as GmgnRow;
    const tags = (r.wallet_tags_stat ?? {}) as GmgnRow;
    c.top10Pct = maybeRatioPct(pickNum(stat, ["top_10_holder_rate"]));
    c.bundlerPct = maybeRatioPct(pickNum(stat, ["top_bundler_trader_percentage", "bot_degen_rate"]));
    c.creatorBalancePct = maybeRatioPct(pickNum(stat, ["creator_hold_rate", "dev_team_hold_rate"]));
    c.smartMoneyCount = Math.round(pickNum(tags, ["smart_wallets"]));
    c.kolCount = Math.round(pickNum(tags, ["renowned_wallets"]));
  }
  if (sec.status === "fulfilled" && sec.value) {
    const r = sec.value;
    // fallback to security endpoint's own top_10_holder_rate if info didn't have it
    if (c.top10Pct === 0) c.top10Pct = maybeRatioPct(pickNum(r, ["top_10_holder_rate", "top10_holder_rate"]));
    c.isHoneypot = pickBool(r, ["is_honeypot"]);
    // rugRatio and isWashTrading are not exposed by GMGN open API — leave at defaults
  }
}

function computeForwardPnL(c: Candidate, candles: Candle[]): void {
  c.candleCount = candles.length;
  c.hasOhlcv = candles.length >= 12; // need at least 1h forward
  if (!c.hasOhlcv) return;
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last) {
    c.hasOhlcv = false;
    return;
  }
  const entry = first.close;
  c.entryPrice = entry;
  let max = entry;
  let min = entry;
  let peakIdx = 0;
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;
    if (candle.high > max) {
      max = candle.high;
      peakIdx = i;
    }
    if (candle.low < min) min = candle.low;
  }
  c.maxPnLPct = ((max / entry) - 1) * 100;
  c.minPnLPct = ((min / entry) - 1) * 100;
  c.finalPnLPct = ((last.close / entry) - 1) * 100;
  const peakCandle = candles[peakIdx];
  c.timeToPeakMins = peakCandle ? (peakCandle.ts - first.ts) / 60_000 : 0;
}

const WINNER_THRESHOLD_PCT = 50; // candidate is a "winner" if maxPnL >= 50%

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[m] ?? 0;
  return ((sorted[m - 1] ?? 0) + (sorted[m] ?? 0)) / 2;
}

function summarize(label: string, group: Candidate[]): string {
  if (group.length === 0) return `  ${label.padEnd(40)} n=0`;
  const wins = group.filter((c) => c.maxPnLPct >= WINNER_THRESHOLD_PCT).length;
  const winRate = (wins / group.length) * 100;
  const medMax = median(group.map((c) => c.maxPnLPct));
  const medFinal = median(group.map((c) => c.finalPnLPct));
  const medMin = median(group.map((c) => c.minPnLPct));
  return `  ${label.padEnd(40)} n=${String(group.length).padStart(3)}  win@50%=${winRate.toFixed(0).padStart(3)}%  medMax=${medMax >= 0 ? "+" : ""}${medMax.toFixed(0)}%  medFinal=${medFinal >= 0 ? "+" : ""}${medFinal.toFixed(0)}%  medMin=${medMin.toFixed(0)}%`;
}

function sweepThreshold(
  label: string,
  candidates: Candidate[],
  field: keyof Candidate,
  thresholds: number[],
  direction: "min" | "max",
): void {
  console.log(`\n--- Threshold sweep: ${label} (direction: keep when ${direction === "min" ? ">=" : "<="} threshold) ---`);
  console.log(`  ${"baseline (no filter)".padEnd(40)} ${summarize("", candidates).slice(2)}`);
  for (const t of thresholds) {
    const kept = candidates.filter((c) => {
      const v = c[field] as number;
      return direction === "min" ? v >= t : v <= t;
    });
    const dropped = candidates.length - kept.length;
    console.log(`${summarize(`${field} ${direction === "min" ? ">=" : "<="} ${t} (drops ${dropped})`, kept)}`);
  }
}

async function writeCsv(candidates: Candidate[]): Promise<string> {
  const dir = path.resolve("state");
  await mkdir(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(dir, `gmgn-filter-analysis-${ts}.csv`);
  const header = [
    "mint", "symbol", "source",
    "liquidityUsd", "holders", "marketCapUsd",
    "top10Pct", "rugRatio", "bundlerPct", "creatorBalancePct",
    "smartMoneyCount", "kolCount", "isHoneypot", "isWashTrading",
    "hasOhlcv", "candleCount",
    "entryPrice", "maxPnLPct", "finalPnLPct", "minPnLPct", "timeToPeakMins",
  ];
  const rows = candidates.map((c) => header.map((h) => {
    const v = c[h as keyof Candidate];
    if (typeof v === "boolean") return v ? "1" : "0";
    if (typeof v === "number") return String(Math.round(v * 100) / 100);
    return String(v ?? "");
  }).join(","));
  await writeFile(file, [header.join(","), ...rows].join("\n") + "\n");
  return file;
}

async function main(): Promise<void> {
  if (!isGmgnConfigured()) {
    console.error("GMGN_API_KEY not set in env");
    process.exit(1);
  }
  console.log("Step 1: harvesting candidates from signal/trenches/trending (limit=30 each)...");
  const t0 = Date.now();
  const candidates = await harvestCandidates();
  console.log(`  → ${candidates.length} unique mints in ${Date.now() - t0}ms`);

  console.log(`\nStep 2: enriching ${candidates.length} candidates (token info + security)...`);
  let enriched = 0;
  for (const c of candidates) {
    await enrichCandidate(c);
    enriched++;
    if (enriched % 5 === 0) process.stdout.write(`  enriched ${enriched}/${candidates.length}\r`);
  }
  console.log(`  → ${enriched}/${candidates.length} enriched              `);

  console.log(`\nStep 3: fetching forward OHLCV (5m × 299 candles ≈ 25h) for each...`);
  let withOhlcv = 0;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c) continue;
    const candles = await fetchKlines(c.mint);
    computeForwardPnL(c, candles);
    if (c.hasOhlcv) withOhlcv++;
    process.stdout.write(`  ohlcv ${i + 1}/${candidates.length}  hasData=${withOhlcv}\r`);
  }
  console.log(`  → ${withOhlcv}/${candidates.length} have ≥1h forward candles                  `);

  const csv = await writeCsv(candidates);
  console.log(`\nFull table written to ${csv}`);

  const usable = candidates.filter((c) => c.hasOhlcv);
  if (usable.length === 0) {
    console.log("\nNo usable forward OHLCV — analysis impossible for this batch.");
    return;
  }

  console.log(`\n========================================================================`);
  console.log(`SUMMARY — ${usable.length} candidates with forward OHLCV (winner = maxPnL >= ${WINNER_THRESHOLD_PCT}%)`);
  console.log(`========================================================================`);
  console.log(`\nBaseline (no filter applied):`);
  console.log(summarize("ALL", usable));

  console.log(`\nBy source:`);
  for (const src of ["signal", "trenches", "trending"] as const) {
    console.log(summarize(`source=${src}`, usable.filter((c) => c.source === src)));
  }

  sweepThreshold("liquidityUsd (current default: 10,000)", usable, "liquidityUsd",
    [0, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000], "min");
  sweepThreshold("holders (current default: 200)", usable, "holders",
    [0, 50, 100, 200, 500, 1_000, 2_000], "min");
  sweepThreshold("top10Pct (current default: 45)", usable, "top10Pct",
    [100, 80, 60, 50, 45, 40, 35, 30, 25, 20], "max");
  sweepThreshold("rugRatio (current default: 0.35)", usable, "rugRatio",
    [1, 0.5, 0.35, 0.2, 0.1, 0.05], "max");
  sweepThreshold("bundlerPct (current default: 50)", usable, "bundlerPct",
    [100, 80, 60, 50, 40, 30, 20, 10], "max");
  sweepThreshold("creatorBalancePct (current default: 20)", usable, "creatorBalancePct",
    [100, 50, 30, 20, 15, 10, 5], "max");

  console.log(`\nHoneypot / wash-trading filter impact:`);
  console.log(summarize("isHoneypot=true", usable.filter((c) => c.isHoneypot)));
  console.log(summarize("isHoneypot=false", usable.filter((c) => !c.isHoneypot)));
  console.log(summarize("isWashTrading=true", usable.filter((c) => c.isWashTrading)));
  console.log(summarize("isWashTrading=false", usable.filter((c) => !c.isWashTrading)));
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
