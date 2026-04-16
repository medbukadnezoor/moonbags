import type { ClosedTrade } from "../types";

/**
 * Build N evenly-spaced height % values (0..100) from a series of cumulative
 * PnL points. Used by the hero sparkline + position micro-bars.
 */
export function buildBars(values: number[], bars = 8): number[] {
  if (!values.length) return [];
  // bucket values into `bars` groups
  const out: number[] = [];
  const step = values.length / bars;
  for (let i = 0; i < bars; i++) {
    const idx = Math.min(values.length - 1, Math.floor(i * step));
    out.push(values[idx]);
  }
  // normalize to 0..100 based on min/max so even small motions read visually
  const min = Math.min(...out);
  const max = Math.max(...out);
  const span = Math.max(1e-9, max - min);
  return out.map((v) => Math.max(8, Math.round(((v - min) / span) * 100)));
}

/**
 * Hero sparkline — cumulative realized PnL across the most recent closed
 * trades, bucketed into 8 bars.
 */
export function heroBars(closed: ClosedTrade[]): number[] {
  if (!closed.length) return [];
  // sort ascending by closedAt then build cumulative PnL series
  const sorted = [...closed].sort((a, b) => a.closedAt - b.closedAt);
  let acc = 0;
  const series = sorted.map((t) => (acc += t.pnlSol));
  return buildBars(series, 8);
}

type SparkBarsProps = {
  bars: number[];
  className?: string;
  barClassName?: string;
};

/**
 * Tiny inline bar chart used in the hero card.
 */
export function SparkBars({ bars, className = "", barClassName = "" }: SparkBarsProps) {
  return (
    <div className={`flex items-end gap-1 h-full w-full ${className}`}>
      {bars.map((h, i) => (
        <div
          key={i}
          className={`w-full bg-gradient-to-t from-pepe/40 to-pepe/5 rounded-t-sm ${barClassName}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Build a 5-bar fake candle series for a position based on entry/peak/current.
 * Returns heights in 0..100 + a directional flag per bar (true = up bar).
 */
export function positionMicroBars(entry: number, current: number, peak: number): {
  height: number;
  up: boolean;
}[] {
  if (entry <= 0) return [];
  // Anchor 5 points: entry, mid1, peak (or near peak), mid2, current
  const points = [entry, (entry + peak) / 2, peak, (peak + current) / 2, current];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1e-9, max - min);
  const out: { height: number; up: boolean }[] = [];
  for (let i = 0; i < points.length; i++) {
    const h = Math.max(15, Math.round(((points[i] - min) / span) * 100));
    const up = i === 0 ? current >= entry : points[i] >= points[i - 1];
    out.push({ height: h, up });
  }
  return out;
}
