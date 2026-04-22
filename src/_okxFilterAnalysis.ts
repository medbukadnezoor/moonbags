/**
 * One-off: pull recent OKX signals via `onchainos signal list`, fetch forward
 * OHLCV, compute peak forward PnL, sweep the OKX filter knobs (minHolders,
 * walletType, mcap) to see which thresholds actually separate winners.
 *
 * Run: npx tsx src/_okxFilterAnalysis.ts [--pages N]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

type Candle = { ts: number; open: number; high: number; low: number; close: number };

type OkxSignalRow = {
  amountUsd?: string;
  timestamp?: string;
  price?: string;
  soldRatioPercent?: string;
  triggerWalletCount?: string;
  walletType?: string;
  cursor?: string;
  token?: {
    holders?: string;
    marketCapUsd?: string;
    name?: string;
    symbol?: string;
    tokenAddress?: string;
    top10HolderPercent?: string;
  };
};

type Candidate = {
  mint: string;
  symbol: string;
  timestamp: number; // ms — when the OKX signal fired
  walletType: number; // 1=Smart Money, 2=KOL, 3=Whale
  triggerWalletCount: number;
  amountUsd: number;
  soldRatioPercent: number;
  holders: number;
  marketCapUsd: number;
  top10Pct: number;
  hasOhlcv: boolean;
  candleCount: number;
  entryPrice: number;
  maxPnLPct: number;
  finalPnLPct: number;
  minPnLPct: number;
  timeToPeakMins: number;
};

const WALLET_LABELS: Record<number, string> = {
  1: "SmartMoney",
  2: "KOL",
  3: "Whale",
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function runOnchainos<T>(args: string[], timeoutMs = 20_000): Promise<T | null> {
  const env = { ...process.env };
  if (!env.OKX_PASSPHRASE && env.OKX_API_PASSPHRASE) env.OKX_PASSPHRASE = env.OKX_API_PASSPHRASE;
  try {
    const { stdout } = await execFileAsync("onchainos", args, { timeout: timeoutMs, env, maxBuffer: 8 * 1024 * 1024 });
    const parsed = JSON.parse(String(stdout || "{}")) as { ok?: boolean; data?: T; error?: unknown };
    if (parsed.ok === false) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

async function harvestSignals(pages: number): Promise<Candidate[]> {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  let cursor: string | undefined;
  for (let p = 0; p < pages; p++) {
    const args = ["signal", "list", "--chain", "solana", "--limit", "100"];
    if (cursor) args.push("--cursor", cursor);
    const rows = await runOnchainos<OkxSignalRow[]>(args);
    if (!rows || rows.length === 0) break;
    for (const row of rows) {
      const mint = row.token?.tokenAddress ?? "";
      if (!mint || seen.has(mint)) continue;
      seen.add(mint);
      const ts = num(row.timestamp);
      out.push({
        mint,
        symbol: row.token?.symbol ?? row.token?.name ?? mint.slice(0, 6),
        timestamp: ts > 0 && ts < 1e12 ? ts * 1000 : ts,
        walletType: Math.round(num(row.walletType)),
        triggerWalletCount: Math.round(num(row.triggerWalletCount)),
        amountUsd: num(row.amountUsd),
        soldRatioPercent: num(row.soldRatioPercent),
        holders: Math.round(num(row.token?.holders)),
        marketCapUsd: num(row.token?.marketCapUsd),
        top10Pct: num(row.token?.top10HolderPercent),
        hasOhlcv: false,
        candleCount: 0,
        entryPrice: 0,
        maxPnLPct: 0,
        finalPnLPct: 0,
        minPnLPct: 0,
        timeToPeakMins: 0,
      });
    }
    cursor = rows[rows.length - 1]?.cursor;
    if (!cursor) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  return out;
}

async function fetchKlines(address: string): Promise<Candle[]> {
  const data = await runOnchainos<Array<{ ts: string; o: string; h: string; l: string; c: string }>>([
    "market", "kline",
    "--address", address,
    "--chain", "solana",
    "--bar", "5m",
    "--limit", "299",
  ], 12_000);
  if (!data?.length) return [];
  return data
    .map((c) => ({ ts: Number(c.ts), open: parseFloat(c.o), high: parseFloat(c.h), low: parseFloat(c.l), close: parseFloat(c.c) }))
    .filter((c) => c.open > 0)
    .sort((a, b) => a.ts - b.ts);
}

function computeForwardPnL(c: Candidate, candles: Candle[]): void {
  // Filter candles to those AFTER the OKX signal fired — that's the real entry window.
  const postSignal = candles.filter((k) => k.ts >= c.timestamp);
  c.candleCount = postSignal.length;
  c.hasOhlcv = postSignal.length >= 12;
  if (!c.hasOhlcv) return;
  const first = postSignal[0];
  const last = postSignal[postSignal.length - 1];
  if (!first || !last) {
    c.hasOhlcv = false;
    return;
  }
  const entry = first.close;
  c.entryPrice = entry;
  let max = entry, min = entry, peakIdx = 0;
  for (let i = 1; i < postSignal.length; i++) {
    const k = postSignal[i];
    if (!k) continue;
    if (k.high > max) { max = k.high; peakIdx = i; }
    if (k.low < min) min = k.low;
  }
  c.maxPnLPct = ((max / entry) - 1) * 100;
  c.minPnLPct = ((min / entry) - 1) * 100;
  c.finalPnLPct = ((last.close / entry) - 1) * 100;
  const peak = postSignal[peakIdx];
  c.timeToPeakMins = peak ? (peak.ts - first.ts) / 60_000 : 0;
}

const WINNER_PCT = 50;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2) return s[m] ?? 0;
  return ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

function summarize(label: string, g: Candidate[]): string {
  if (g.length === 0) return `  ${label.padEnd(40)} n=0`;
  const wins = g.filter((c) => c.maxPnLPct >= WINNER_PCT).length;
  const wr = (wins / g.length) * 100;
  const mMax = median(g.map((c) => c.maxPnLPct));
  const mFin = median(g.map((c) => c.finalPnLPct));
  const mMin = median(g.map((c) => c.minPnLPct));
  return `  ${label.padEnd(40)} n=${String(g.length).padStart(3)}  win@50%=${wr.toFixed(0).padStart(3)}%  medMax=${mMax >= 0 ? "+" : ""}${mMax.toFixed(0)}%  medFinal=${mFin >= 0 ? "+" : ""}${mFin.toFixed(0)}%  medMin=${mMin.toFixed(0)}%`;
}

function sweep(label: string, cs: Candidate[], field: keyof Candidate, thresholds: number[], dir: "min" | "max"): void {
  console.log(`\n--- ${label} (keep when ${dir === "min" ? ">=" : "<="} threshold) ---`);
  console.log(`  ${"baseline (no filter)".padEnd(40)} ${summarize("", cs).slice(2)}`);
  for (const t of thresholds) {
    const kept = cs.filter((c) => {
      const v = c[field] as number;
      return dir === "min" ? v >= t : v <= t;
    });
    const dropped = cs.length - kept.length;
    console.log(summarize(`${String(field)} ${dir === "min" ? ">=" : "<="} ${t} (drops ${dropped})`, kept));
  }
}

async function writeCsv(cs: Candidate[]): Promise<string> {
  const dir = path.resolve("state");
  await mkdir(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(dir, `okx-filter-analysis-${ts}.csv`);
  const header = [
    "mint", "symbol", "timestamp", "walletType", "walletTypeLabel", "triggerWalletCount",
    "amountUsd", "soldRatioPercent", "holders", "marketCapUsd", "top10Pct",
    "hasOhlcv", "candleCount", "entryPrice", "maxPnLPct", "finalPnLPct", "minPnLPct", "timeToPeakMins",
  ];
  const rows = cs.map((c) => header.map((h) => {
    if (h === "walletTypeLabel") return WALLET_LABELS[c.walletType] ?? "?";
    const v = c[h as keyof Candidate];
    if (typeof v === "boolean") return v ? "1" : "0";
    if (typeof v === "number") return String(Math.round(v * 100) / 100);
    return String(v ?? "");
  }).join(","));
  await writeFile(file, [header.join(","), ...rows].join("\n") + "\n");
  return file;
}

async function main(): Promise<void> {
  const pagesArg = process.argv.indexOf("--pages");
  const pages = pagesArg !== -1 ? Number(process.argv[pagesArg + 1] ?? 3) : 3;

  console.log(`Step 1: harvesting OKX signals from onchainos CLI (${pages} pages × 100)...`);
  const t0 = Date.now();
  const cs = await harvestSignals(pages);
  console.log(`  → ${cs.length} unique mints in ${Date.now() - t0}ms`);

  if (cs.length === 0) {
    console.log("No OKX signals returned. Check onchainos auth / subscription.");
    return;
  }

  console.log(`\nStep 2: fetching forward OHLCV for each...`);
  let withOhlcv = 0;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (!c) continue;
    const candles = await fetchKlines(c.mint);
    computeForwardPnL(c, candles);
    if (c.hasOhlcv) withOhlcv++;
    process.stdout.write(`  ohlcv ${i + 1}/${cs.length}  hasData=${withOhlcv}\r`);
  }
  console.log(`  → ${withOhlcv}/${cs.length} have ≥1h forward candles                  `);

  const csvFile = await writeCsv(cs);
  console.log(`\nCSV: ${csvFile}`);

  const usable = cs.filter((c) => c.hasOhlcv);
  if (usable.length === 0) {
    console.log("\nNo usable forward OHLCV.");
    return;
  }

  console.log(`\n========================================================================`);
  console.log(`SUMMARY — ${usable.length} OKX signals with forward OHLCV (winner = maxPnL >= ${WINNER_PCT}%)`);
  console.log(`========================================================================`);
  console.log(summarize("ALL", usable));

  console.log(`\nBy walletType:`);
  for (const [id, label] of Object.entries(WALLET_LABELS)) {
    console.log(summarize(`walletType=${id} (${label})`, usable.filter((c) => c.walletType === Number(id))));
  }

  console.log(`\nBy walletType combination (filter presets):`);
  console.log(summarize("SmartMoney only [1]", usable.filter((c) => c.walletType === 1)));
  console.log(summarize("KOL only [2]", usable.filter((c) => c.walletType === 2)));
  console.log(summarize("Whale only [3]", usable.filter((c) => c.walletType === 3)));
  console.log(summarize("Current default [1,2]", usable.filter((c) => c.walletType === 1 || c.walletType === 2)));
  console.log(summarize("All three [1,2,3]", usable.filter((c) => [1, 2, 3].includes(c.walletType))));

  sweep("holders (current default: 500)", usable, "holders",
    [0, 100, 250, 500, 1_000, 2_500, 5_000], "min");
  sweep("marketCapUsd", usable, "marketCapUsd",
    [0, 25_000, 100_000, 500_000, 1_000_000, 5_000_000], "min");
  sweep("top10Pct", usable, "top10Pct",
    [100, 50, 40, 30, 25, 20], "max");
  sweep("triggerWalletCount", usable, "triggerWalletCount",
    [1, 2, 3, 5, 10], "min");
  sweep("amountUsd (bigger wallet commit)", usable, "amountUsd",
    [0, 100, 500, 1_000, 5_000], "min");
  sweep("soldRatioPercent (lower = fresh buy)", usable, "soldRatioPercent",
    [100, 75, 50, 25, 10], "max");
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
