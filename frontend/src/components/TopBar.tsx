import type { State } from "../types";
import { fmtUptime } from "../lib/format";
import { useEffect, useState } from "react";

type Props = { state: State | null; error: string | null };

/**
 * Slim 56px glass-effect top app bar.
 *  - Left:  🌙 MOONBAGS wordmark + glowing dot + LIVE / DRY / DISCONNECTED pill
 *  - Right: compact OPEN / REALIZED / UPTIME stats with thin vertical dividers
 */
export function TopBar({ state, error }: Props) {
  // tick once a second so uptime display stays fresh
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const dry = state?.stats.dryRun ?? state?.config.DRY_RUN ?? false;
  const openCount = state?.stats.openCount ?? 0;
  const maxConc = state?.stats.maxConcurrent ?? state?.config.MAX_CONCURRENT_POSITIONS ?? 0;
  const pnl = state?.stats.realizedPnlSol ?? 0;
  const bootAt = state?.stats.bootAt ?? Date.now();
  const uptimeMs = Date.now() - bootAt;
  const pnlPositive = pnl >= 0;

  // status pill: ERROR > DRY > LIVE > CONNECTING
  const statusPill = (() => {
    if (error) {
      return (
        <span className="px-2 py-0.5 bg-coral/20 text-coral text-[10px] font-mono font-bold tracking-widest border border-coral/40 rounded-sm">
          DISCONNECTED
        </span>
      );
    }
    if (!state) {
      return (
        <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-mono font-bold tracking-widest border border-border rounded-sm">
          CONNECTING
        </span>
      );
    }
    if (dry) {
      return (
        <span className="px-2 py-0.5 bg-earth/20 text-earth text-[10px] font-mono font-bold tracking-widest border border-earth/40 rounded-sm">
          DRY RUN
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-pepe/20 text-pepe text-[10px] font-mono font-bold tracking-widest border border-pepe/40 rounded-sm">
        LIVE
      </span>
    );
  })();

  return (
    <header className="fixed top-0 inset-x-0 h-14 z-50 bg-background/80 backdrop-blur-xl border-b border-pepe/10 flex justify-between items-center px-4">
      {/* Left: logo cluster */}
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold text-pepe tracking-tighter font-display flex items-center gap-2">
          🌙 MOONBAGS
          <span
            className="flex h-2 w-2 rounded-full bg-pepe motion-safe:animate-pulse shadow-[0_0_8px_hsl(89_53%_44%)]"
            aria-hidden="true"
          />
        </span>
        <div className="ml-2" role="status" aria-live="polite">{statusPill}</div>
      </div>

      {/* Right: compact stats */}
      <nav className="hidden md:flex gap-6 items-center" aria-label="Bot status">
        <Stat label="OPEN" value={`${openCount} / ${maxConc}`} />
        <Divider />
        <div className="flex flex-col items-center">
          <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-tighter">REALIZED</span>
          <span
            className={`font-mono font-bold text-sm tabular-nums ${pnlPositive ? "text-pepe" : "text-coral"}`}
          >
            {pnlPositive ? "▲" : "▼"} {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} SOL
          </span>
        </div>
        <Divider />
        <Stat label="UPTIME" value={fmtUptime(uptimeMs)} />
      </nav>
    </header>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-outline-variant/20" aria-hidden="true" />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-tighter">{label}</span>
      <span className="text-foreground font-mono font-bold text-sm tabular-nums">{value}</span>
    </div>
  );
}
