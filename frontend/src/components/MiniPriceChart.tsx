/**
 * Mini SVG price chart — renders a real (no fake interpolation) area + line
 * sparkline from a series of close prices. Used on each open-position card to
 * show the actual last ~60 minutes of 1m kline data fetched server-side from
 * OKX.
 */

type Tone = "good" | "neutral" | "bad";

const STROKE: Record<Tone, string> = {
  good: "hsl(89 53% 55%)",       // pepe bright
  neutral: "hsl(202 80% 60%)",   // earth
  bad: "hsl(20 65% 60%)",        // coral
};

const FILL_TOP: Record<Tone, string> = {
  good: "hsl(89 53% 50% / 0.35)",
  neutral: "hsl(202 80% 55% / 0.35)",
  bad: "hsl(20 65% 55% / 0.35)",
};

type Props = {
  closes: number[];
  tone: Tone;
  width?: number;
  height?: number;
  /** Optional reference price (e.g. entry) — drawn as a faint dashed line. */
  entryPriceUsd?: number;
};

export function MiniPriceChart({
  closes,
  tone,
  width = 120,
  height = 48,
  entryPriceUsd,
}: Props) {
  if (closes.length < 2) return null;

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || max * 0.001 || 1;

  // padding so the line never touches the edges
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = innerW / (closes.length - 1);

  const yFor = (price: number) =>
    pad + innerH - ((price - min) / range) * innerH;

  const points = closes.map((c, i) => `${pad + i * step},${yFor(c)}`).join(" ");
  const areaPoints = `${pad},${pad + innerH} ${points} ${pad + innerW},${pad + innerH}`;

  // Optional reference line for entry price (only if it's within the y-range)
  const showRef =
    entryPriceUsd != null && entryPriceUsd >= min && entryPriceUsd <= max;
  const refY = showRef ? yFor(entryPriceUsd!) : null;

  const gradId = `mini-grad-${tone}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Price chart, ${closes.length} bars`}
      className="block"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={FILL_TOP[tone]} />
          <stop offset="100%" stopColor={FILL_TOP[tone]} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <polygon points={areaPoints} fill={`url(#${gradId})`} />

      {/* Reference line (entry) */}
      {showRef && refY != null && (
        <line
          x1={pad}
          y1={refY}
          x2={pad + innerW}
          y2={refY}
          stroke="hsl(48 19% 92% / 0.25)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}

      {/* Price line */}
      <polyline
        points={points}
        fill="none"
        stroke={STROKE[tone]}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Last point marker */}
      <circle
        cx={pad + (closes.length - 1) * step}
        cy={yFor(closes[closes.length - 1]!)}
        r={2}
        fill={STROKE[tone]}
      />
    </svg>
  );
}
