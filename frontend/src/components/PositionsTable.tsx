import type { Position, TokenInfo } from "../types";
import { truncMint } from "../lib/format";
import { Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { TokenAvatar } from "./TokenAvatar";
import { TokenInfoBadges } from "./TokenInfoBadges";
import { MiniPriceChart } from "./MiniPriceChart";

type Props = {
  positions: Position[];
  tokenInfo?: Record<string, TokenInfo>;
  kline1m?: Record<string, number[]>;
  loading?: boolean;
};

/**
 * Renders each Position as a 120px tall rich card (not a table row).
 * Accent color (strip + avatar ring + SELL button tone) is derived from PnL:
 *   winning   → pepe green
 *   neutral   → earth blue  (|pnl| < 5%)
 *   losing    → coral
 */
export function PositionsTable({ positions, tokenInfo = {}, kline1m = {}, loading }: Props) {
  // tick so the age/pnl stay fresh
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground font-mono text-xs uppercase tracking-widest motion-safe:animate-pulse border border-outline-variant/10 bg-surface-container-low rounded-md">
        Connecting…
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground font-mono text-xs uppercase tracking-widest border border-outline-variant/10 bg-surface-container-low rounded-md">
        Scanning the void 🛰️
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map((p) => (
        <PositionCard key={p.mint} p={p} info={tokenInfo[p.mint]} kline={kline1m[p.mint] ?? []} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

type Tone = "good" | "neutral" | "bad";

function toneFromPnl(pnl: number, hasEntry: boolean): Tone {
  if (!hasEntry) return "neutral";
  if (pnl >= 0.05) return "good";
  if (pnl <= -0.05) return "bad";
  return "neutral";
}

const TONE_ACCENT: Record<Tone, string> = {
  good: "bg-pepe",
  neutral: "bg-earth",
  bad: "bg-coral",
};
const TONE_RING: Record<Tone, string> = {
  good: "border-pepe",
  neutral: "border-earth",
  bad: "border-coral",
};
const TONE_TEXT: Record<Tone, string> = {
  good: "text-pepe",
  neutral: "text-earth",
  bad: "text-coral",
};
const TONE_HOVER_BORDER: Record<Tone, string> = {
  good: "hover:border-pepe/30",
  neutral: "hover:border-earth/30",
  bad: "hover:border-coral/30",
};

function PositionCard({ p, info, kline }: { p: Position; info?: TokenInfo; kline: number[] }) {
  const hasEntry = p.entryPricePerTokenSol > 0;
  const pnl = hasEntry
    ? (p.currentPricePerTokenSol - p.entryPricePerTokenSol) / p.entryPricePerTokenSol
    : 0;
  const pnlPositive = pnl >= 0;
  const tone = toneFromPnl(pnl, hasEntry);

  // Drawdown from peak — 1.0 means we're still at the peak, lower means we've
  // retraced. We render this as a "health" bar (100% = healthy, shrinks as we fall).
  const drawdownFromPeak = p.peakPricePerTokenSol > 0
    ? p.currentPricePerTokenSol / p.peakPricePerTokenSol
    : 1;
  const drawdownPct = Math.max(0, Math.min(1, drawdownFromPeak)) * 100;

  const onSell = () => {
    // Sell endpoint not yet wired on backend
    console.log("SELL", p.mint);
  };

  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(p.mint).catch(() => {});
  };

  // Real 1m closes from OKX (last ~60 min), oldest first. Empty if backend
  // hasn't fetched yet or token has no liquidity.
  const haveKline = kline.length >= 2;

  return (
    <div
      className={`group h-[120px] bg-surface-container-low border border-outline-variant/10 ${TONE_HOVER_BORDER[tone]} transition-all flex items-center px-6 gap-6 relative overflow-hidden rounded-md motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-300`}
    >
      {/* Left accent strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${TONE_ACCENT[tone]}`} aria-hidden="true" />

      {/* Avatar with colored ring */}
      <div className={`relative shrink-0 rounded-full border-2 ${TONE_RING[tone]} p-1`}>
        <TokenAvatar icon={info?.icon} name={p.name} size={56} />
      </div>

      {/* Middle column: name + PnL row + drawdown bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-display font-bold text-xl tracking-tight truncate">{p.name}</span>
          {info?.symbol && (
            <span className="font-mono text-xs text-muted-foreground">${info.symbol}</span>
          )}
          {p.armed && (
            <span className="px-1.5 py-0.5 bg-pepe text-background text-[9px] font-mono font-bold rounded-sm">
              ARMED
            </span>
          )}
          {/* Mint + external links */}
          <button
            onClick={onCopy}
            className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={`Copy mint address ${p.mint}`}
            title="Copy mint"
          >
            <span>{truncMint(p.mint)}</span>
            <Copy className="h-3 w-3" aria-hidden="true" />
          </button>
          <a
            href={`https://gmgn.ai/sol/token/${p.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono text-[10px] text-pepe hover:text-pepe/80 transition-colors"
            title="Open on GMGN"
            onClick={(e) => e.stopPropagation()}
          >
            <span>GMGN</span>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
          <a
            href={`https://jup.ag/tokens/${p.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono text-[10px] text-earth hover:text-earth/80 transition-colors"
            title="Open on Jupiter"
            onClick={(e) => e.stopPropagation()}
          >
            <span>JUP</span>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>

        <div className="flex items-end gap-4">
          <span className={`text-3xl font-mono font-bold tabular-nums ${TONE_TEXT[tone]}`}>
            {hasEntry ? `${pnlPositive ? "+" : ""}${(pnl * 100).toFixed(0)}%` : "—"}
          </span>
          <div className="flex-1 max-w-[180px] pb-2">
            <div className="h-1 bg-surface-container-lowest w-full rounded-full overflow-hidden">
              <div
                className={`h-full ${TONE_ACCENT[tone]} transition-[width] duration-500`}
                style={{ width: `${drawdownPct}%` }}
              />
            </div>
            <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">
              DRAWDOWN LIMIT
            </span>
          </div>
        </div>

        {info && (
          <div className="mt-1 hidden lg:block">
            <TokenInfoBadges info={info} compact />
          </div>
        )}
      </div>

      {/* Real 1m price chart — last ~60 min OKX closes */}
      {haveKline ? (
        <div className="hidden md:flex flex-col items-end shrink-0">
          <MiniPriceChart
            closes={kline}
            tone={tone}
            entryPriceUsd={info?.priceUsd && hasEntry
              ? info.priceUsd / (p.currentPricePerTokenSol / p.entryPricePerTokenSol)
              : undefined}
            width={132}
            height={48}
          />
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">
            1m · {kline.length}
          </span>
        </div>
      ) : (
        <div
          className="hidden md:flex flex-col items-center justify-center shrink-0 w-32 h-12 text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest border border-dashed border-outline-variant/20 rounded-sm"
          aria-hidden="true"
        >
          loading kline…
        </div>
      )}

      {/* Right: SELL button */}
      <button
        onClick={onSell}
        disabled
        aria-label={`Sell ${p.name} (not yet wired to backend)`}
        title="Manual sell endpoint not yet wired"
        className={`shrink-0 font-mono font-bold px-6 py-2 text-xs rounded-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
          pnlPositive
            ? "bg-coral text-background hover:opacity-90"
            : "bg-surface-container-highest text-foreground hover:bg-surface-container-high"
        }`}
      >
        SELL
      </button>
    </div>
  );
}
