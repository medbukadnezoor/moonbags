import type { State } from "../types";
import { Send } from "lucide-react";

type Props = {
  config: State["config"] | undefined;
  botUsername?: string | null;
  exitSettings?: State["exitSettings"];
};

/**
 * Fixed 48px bottom strip showing the most-relevant config knobs as inline
 * pills. Editing happens in Telegram via /settings — there's no inline editor.
 */
export function BottomConfigStrip({ config, botUsername, exitSettings }: Props) {
  // Deep-link format. https://t.me/<username> opens the web/desktop/mobile
  // Telegram client and lands on the bot chat. We can't preload a /settings
  // command with Telegram's deep-link grammar (start param only runs once per
  // bot), but opening the chat is the 1-tap solution.
  const telegramUrl = botUsername ? `https://t.me/${botUsername}` : null;
  const exit = exitSettings ?? (config ? {
    profitStrategy: {
      type: "trail" as const,
      fixedTargetPct: 1,
      ladderTargets: [],
      trailRemainder: true,
    },
    trail: {
      armPct: config.ARM_PCT,
      trailPct: config.TRAIL_PCT,
    },
    risk: {
      stopPct: config.STOP_PCT,
      maxHoldSecs: config.MAX_HOLD_SECS,
    },
    runner: {
      keepPct: 0,
      trailPct: 0,
      timeoutSecs: 0,
    },
    llm: {
      enabled: Boolean(config.LLM_EXIT_ENABLED),
    },
  } : undefined);
  return (
    <footer className="fixed bottom-0 inset-x-0 h-12 z-50 bg-background border-t border-pepe/10 flex justify-between items-center px-4 shadow-[0_-8px_32px_rgba(107,170,52,0.08)]">
      <div className="flex items-center gap-6 overflow-x-auto no-scrollbar whitespace-nowrap">
        {config ? (
          <>
            <Pill label="BUY" value={`${config.BUY_SIZE_SOL} SOL`} />
            <Pill
              label="EXIT"
              value={exit ? exitMode(exit) : "—"}
              tone="pepe"
            />
            <Pill label="RISK" value={exit ? `S-${pct(exit.risk.stopPct)} H${hold(exit.risk.maxHoldSecs)}` : "—"} tone="coral" />
            <Pill
              label="MOON"
              value={exit ? moonbag(exit.runner.keepPct, exit.runner.trailPct, exit.runner.timeoutSecs) : "—"}
              tone="earth"
            />
            <Pill label="LLM" value={exit?.llm.enabled ? "🤖 ON" : "OFF"} tone={exit?.llm.enabled ? "earth" : "muted"} />
            <Pill
              label="DRY"
              value={config.DRY_RUN ? "TRUE" : "FALSE"}
              tone={config.DRY_RUN ? "earth" : undefined}
            />
          </>
        ) : (
          <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest">
            Loading config…
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <Send className="w-3.5 h-3.5 text-earth" aria-hidden="true" />
        {telegramUrl ? (
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-earth font-mono text-[10px] font-bold tracking-widest uppercase hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-earth"
            title={`Open @${botUsername} on Telegram — then type /settings`}
          >
            EDIT IN TELEGRAM /settings
          </a>
        ) : (
          <span
            className="text-muted-foreground font-mono text-[10px] font-bold tracking-widest uppercase cursor-default"
            title="Telegram bot not configured"
          >
            EDIT IN TELEGRAM /settings
          </span>
        )}
      </div>
    </footer>
  );
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pepe" | "earth" | "coral" | "muted";
}) {
  const valueColor =
    tone === "pepe"
      ? "text-pepe"
      : tone === "earth"
        ? "text-earth"
        : tone === "coral"
          ? "text-coral"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-500 font-mono text-[9px] uppercase tracking-widest">{label}</span>
      <span className={`font-mono text-[10px] font-bold tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function exitMode(exit: NonNullable<State["exitSettings"]>): string {
  if (exit.profitStrategy.type === "fixed_tp") return `FIXED +${pct(exit.profitStrategy.fixedTargetPct)}`;
  if (exit.profitStrategy.type === "tp_ladder") {
    const first = exit.profitStrategy.ladderTargets[0];
    return first ? `LADDER +${pct(first.pnlPct)}/${pct(first.sellPct)}` : "LADDER";
  }
  if (exit.profitStrategy.type === "llm_managed") return "LLM MANAGED";
  return `TRAIL A${pct(exit.trail.armPct)} T${pct(exit.trail.trailPct)}`;
}

function hold(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "off";
  if (seconds >= 99_999_999) return "∞";
  if (seconds >= 86400) return `${(seconds / 86400).toFixed(1)}d`;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds)}s`;
}

function moonbag(keepPct: number, trailPct: number, timeoutSecs: number): string {
  if (keepPct <= 0) return "off";
  return `K${pct(keepPct)} T${pct(trailPct)} ${hold(timeoutSecs)}`;
}
