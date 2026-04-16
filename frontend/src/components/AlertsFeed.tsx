import type { Alert, ClosedTrade, TokenInfo } from "../types";
import { useEffect, useState, useMemo } from "react";
import { TokenAvatar } from "./TokenAvatar";

type Props = {
  alerts: Alert[];
  closedTrades?: ClosedTrade[];
  tokenInfo?: Record<string, TokenInfo>;
  loading?: boolean;
};

/**
 * Compact "live feed" of recent alerts as small cards stacked vertically.
 * Left border color encodes status:
 *   pepe   — fired & still open
 *   earth  — fired & closed in profit
 *   coral  — fired & closed at a loss
 *   muted  — filtered / scanning
 */
export function AlertsFeed({ alerts, closedTrades = [], tokenInfo = {}, loading }: Props) {
  // re-render once a second so timestamps stay fresh
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Build mint → most recent closed trade lookup so alerts show final PnL
  const closedByMint = useMemo(() => {
    const map = new Map<string, ClosedTrade>();
    for (const t of closedTrades) {
      const existing = map.get(t.mint);
      if (!existing || t.closedAt > existing.closedAt) map.set(t.mint, t);
    }
    return map;
  }, [closedTrades]);

  const visible = alerts.filter((a) => a.action !== "dedup");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground font-mono text-xs uppercase tracking-widest motion-safe:animate-pulse border border-outline-variant/10 bg-surface-container-low rounded-md">
        Connecting…
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground font-mono text-xs uppercase tracking-widest border border-outline-variant/10 bg-surface-container-low rounded-md">
        Silent night 🌙
      </div>
    );
  }

  return (
    <div
      className="space-y-1.5 h-[500px] overflow-y-auto pr-2"
      role="log"
      aria-live="polite"
      aria-label="Recent alerts"
    >
      {visible.map((a, i) => (
        <AlertItem
          key={`${a.at}-${a.mint}-${i}`}
          a={a}
          closed={closedByMint.get(a.mint)}
          info={tokenInfo[a.mint]}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function fmtClock(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8); // "HH:MM:SS"
}

function AlertItem({ a, closed, info }: { a: Alert; closed?: ClosedTrade; info?: TokenInfo }) {
  const filtered = a.action === "filtered";
  const fired = a.action === "fired";
  const closedWon = closed && closed.pnlSol >= 0;
  const closedLost = closed && closed.pnlSol < 0;

  // border color resolution
  const borderClass = closedWon
    ? "border-earth"
    : closedLost
      ? "border-coral"
      : fired
        ? "border-pepe"
        : "border-outline-variant/30";

  // right-side status text
  const status = (() => {
    if (closed) {
      const sign = closed.pnlPct >= 0 ? "+" : "";
      const tone = closed.pnlSol >= 0 ? "bg-earth text-background" : "bg-coral text-background";
      return (
        <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold inline-block rounded-sm ${tone}`}>
          CLOSED {sign}{closed.pnlPct.toFixed(0)}%
        </span>
      );
    }
    if (fired) {
      return (
        <span className="text-[10px] font-mono text-pepe whitespace-nowrap">
          BUY @ score {a.score}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
        {filtered ? "FILTERED" : "SCANNING"}
      </span>
    );
  })();

  // organic-score chip color
  const scoreTone = a.score >= 80
    ? "bg-pepe/20 text-pepe"
    : a.score >= 60
      ? "bg-earth/20 text-earth"
      : "bg-coral/20 text-coral";

  return (
    <div
      className={`p-3 bg-surface-container-low border-l-2 ${borderClass} flex items-start justify-between rounded-r-sm ${filtered ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-2 min-w-0">
        <TokenAvatar icon={info?.icon} name={a.name} size={24} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-xs truncate max-w-[120px]">{a.name}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{fmtClock(a.at)}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            <a
              href={`https://gmgn.ai/sol/token/${a.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-1 bg-surface-container-highest text-[8px] font-mono text-pepe hover:opacity-80"
              title="Open on GMGN"
            >
              GMGN
            </a>
            <a
              href={`https://jup.ag/tokens/${a.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-1 bg-surface-container-highest text-[8px] font-mono text-earth hover:opacity-80"
              title="Open on Jupiter"
            >
              JUP
            </a>
            <span className={`px-1 text-[8px] font-mono ${scoreTone}`}>SCORE {a.score}</span>
            {info?.organicScoreLabel && (
              <span className="px-1 bg-surface-container-highest text-[8px] font-mono text-muted-foreground uppercase">
                {info.organicScoreLabel}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="shrink-0 ml-2">{status}</div>
    </div>
  );
}
