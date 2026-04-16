import { useEffect, useState } from "react";
import type { State } from "./types";
import { TopBar } from "./components/TopBar";
import { HeroSection } from "./components/HeroSection";
import { PositionsTable } from "./components/PositionsTable";
import { AlertsFeed } from "./components/AlertsFeed";
import { BottomConfigStrip } from "./components/BottomConfigStrip";
import { TooltipProvider } from "./components/ui/tooltip";
import { Rocket, Terminal } from "lucide-react";

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll /api/state every 2s — keeps everything reactive without WebSockets.
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const r = await fetch("/api/state");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as State;
        if (!cancelled) {
          setState(j);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const positionCount = state?.positions?.length ?? 0;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Backdrop layers — extra star field on top of the existing CSS gradient */}
        <div className="star-field" aria-hidden="true" />

        {/* Slim glass top bar — fixed */}
        <TopBar state={state} error={error} />

        {/* Main content — pad for the fixed top bar (56px) and bottom strip (48px) */}
        <main className="pt-[72px] pb-16 min-h-screen px-4 md:px-6 max-w-[1440px] mx-auto w-full space-y-6">
          {/* Hero — big PnL number + KPI tiles */}
          <HeroSection state={state} />

          {/* Two-column body: positions on left (2/3), alerts on right (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 space-y-3">
              <SectionTitle
                icon={<Rocket className="w-4 h-4 text-pepe" />}
                label="OPEN POSITIONS"
                right={`${positionCount} TRACKED`}
              />
              <PositionsTable
                positions={state?.positions ?? []}
                tokenInfo={state?.tokenInfo ?? {}}
                kline1m={state?.kline1m ?? {}}
                loading={state === null && !error}
              />
            </section>

            <section className="space-y-3">
              <SectionTitle
                icon={<Terminal className="w-4 h-4 text-earth" />}
                label="LIVE FEED"
                right="REALTIME"
              />
              <AlertsFeed
                alerts={state?.alerts ?? []}
                closedTrades={state?.closedTrades ?? []}
                tokenInfo={state?.tokenInfo ?? {}}
                loading={state === null && !error}
              />
            </section>
          </div>
        </main>

        {/* Fixed config strip — replaces the old ConfigCard */}
        <BottomConfigStrip config={state?.config} botUsername={state?.telegramBotUsername} />
      </div>
    </TooltipProvider>
  );
}

function SectionTitle({
  icon,
  label,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  right?: string;
}) {
  return (
    <div className="flex justify-between items-center px-2">
      <h2 className="font-display font-bold text-lg tracking-tight flex items-center gap-2">
        {icon}
        {label}
      </h2>
      {right && (
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          {right}
        </span>
      )}
    </div>
  );
}
