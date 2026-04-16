import type { State } from "../types";
import { Rocket } from "lucide-react";
import { heroBars, SparkBars } from "../lib/sparkline";

type Props = { state: State | null };

/**
 * Visual centerpiece — massive PnL number, faux Pepe-glow halo, sparkline of
 * cumulative realized PnL across closed trades, and a 4-tile KPI footer.
 */
export function HeroSection({ state }: Props) {
  const pnl = state?.stats.realizedPnlSol ?? 0;
  const pnlPositive = pnl >= 0;
  const closed = state?.closedTrades ?? [];
  const hasClosed = closed.length > 0;

  // KPIs derived from closedTrades
  const winRate = hasClosed
    ? (closed.filter((t) => t.pnlSol >= 0).length / closed.length) * 100
    : null;
  const avgPnl = hasClosed
    ? closed.reduce((s, t) => s + t.pnlPct, 0) / closed.length
    : null;
  const best = hasClosed ? Math.max(...closed.map((t) => t.pnlPct)) : null;
  const worst = hasClosed ? Math.min(...closed.map((t) => t.pnlPct)) : null;

  const bars = heroBars(closed);

  return (
    <section className="relative mt-2 rounded-lg overflow-hidden border border-outline-variant/10 bg-surface-container-low/40 backdrop-blur-xl p-8 md:p-12">
      {/* Pepe-green ambient halo behind the number */}
      <div className="absolute inset-0 pepe-glow blur-3xl pointer-events-none" aria-hidden="true" />

      {/* Astronaut watermark — large faded Lucide icon bottom-right */}
      <div
        className="absolute -bottom-12 -right-12 opacity-[0.08] pointer-events-none text-pepe"
        aria-hidden="true"
      >
        <Rocket className="w-[260px] h-[260px]" strokeWidth={1} />
      </div>

      {/* Top row: hero number + sparkline */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-8">
        <div className="space-y-2">
          <div className="relative inline-block">
            <h1
              className={`text-7xl md:text-[120px] font-display font-bold leading-none tracking-tighter relative ${
                pnlPositive ? "text-pepe" : "text-coral"
              }`}
            >
              {pnlPositive ? "+" : ""}
              {pnl.toFixed(2)}
              <span className="text-4xl md:text-6xl ml-4 align-baseline">SOL</span>
            </h1>
          </div>
          <p className="font-mono text-muted-foreground tracking-[0.2em] text-sm uppercase">
            REALIZED · LIFETIME
          </p>
        </div>

        <div className="w-full md:w-1/3 h-32 flex items-end">
          {hasClosed ? (
            <SparkBars bars={bars} />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground/70">
              No closed trades yet — to the moon 🌙
            </div>
          )}
        </div>
      </div>

      {/* Footer KPI tiles */}
      <div className="relative z-10 mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-outline-variant/10 pt-8">
        <Kpi label="WIN RATE" value={winRate === null ? null : `${winRate.toFixed(0)}%`} tone="neutral" />
        <Kpi label="AVG PNL" value={avgPnl === null ? null : `${avgPnl >= 0 ? "+" : ""}${avgPnl.toFixed(1)}%`} tone={avgPnl === null ? "neutral" : avgPnl >= 0 ? "good" : "bad"} />
        <Kpi label="BEST" value={best === null ? null : `${best >= 0 ? "+" : ""}${best.toFixed(0)}%`} tone="good" />
        <Kpi label="WORST" value={worst === null ? null : `${worst >= 0 ? "+" : ""}${worst.toFixed(0)}%`} tone={worst === null ? "neutral" : worst < 0 ? "bad" : "good"} />
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null;
  tone: "good" | "bad" | "neutral";
}) {
  const color = value === null
    ? "text-muted-foreground"
    : tone === "good"
      ? "text-pepe"
      : tone === "bad"
        ? "text-coral"
        : "text-foreground";
  return (
    <div>
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1">
        {label}
      </span>
      <span className={`text-2xl font-mono font-bold tabular-nums ${color}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}
