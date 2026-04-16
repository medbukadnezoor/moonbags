import type { State } from "../types";
import { Send } from "lucide-react";

type Props = {
  config: State["config"] | undefined;
  botUsername?: string | null;
};

/**
 * Fixed 48px bottom strip showing the most-relevant config knobs as inline
 * pills. Editing happens in Telegram via /settings — there's no inline editor.
 */
export function BottomConfigStrip({ config, botUsername }: Props) {
  // Deep-link format. https://t.me/<username> opens the web/desktop/mobile
  // Telegram client and lands on the bot chat. We can't preload a /settings
  // command with Telegram's deep-link grammar (start param only runs once per
  // bot), but opening the chat is the 1-tap solution.
  const telegramUrl = botUsername ? `https://t.me/${botUsername}` : null;
  return (
    <footer className="fixed bottom-0 inset-x-0 h-12 z-50 bg-background border-t border-pepe/10 flex justify-between items-center px-4 shadow-[0_-8px_32px_rgba(107,170,52,0.08)]">
      <div className="flex items-center gap-6 overflow-x-auto no-scrollbar whitespace-nowrap">
        {config ? (
          <>
            <Pill label="BUY" value={`${config.BUY_SIZE_SOL} SOL`} />
            <Pill label="ARM" value={`+${(config.ARM_PCT * 100).toFixed(0)}%`} tone="pepe" />
            <Pill label="TRAIL" value={`${(config.TRAIL_PCT * 100).toFixed(0)}%`} />
            <Pill label="STOP" value={`-${(config.STOP_PCT * 100).toFixed(0)}%`} tone="coral" />
            <Pill
              label="LLM"
              value={config.LLM_EXIT_ENABLED ? "🤖 ON" : "OFF"}
              tone={config.LLM_EXIT_ENABLED ? "earth" : "muted"}
            />
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
