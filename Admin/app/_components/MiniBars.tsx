/**
 * Hand-rolled SVG bar chart with rounded corners, gradient fills, and interactive
 * hover titles. Zero client-side JS dependency, lightweight and highly readable.
 */
export default function MiniBars({
  data,
  height = 130,
  color = "var(--primary)",
  gradientFrom = "#6366f1",
  gradientTo = "#4f46e5",
  format = (v: number) => String(v),
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  format?: (v: number) => string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl bg-muted-bg/30 border border-dashed border-border/80">
        <p className="text-xs text-muted">No data available for this range.</p>
      </div>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / data.length;
  const total = data.reduce((s, d) => s + d.value, 0);
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);

  // Stable, pure ID: charts with different colors get different gradient defs;
  // identical-color charts safely share one (same def). Avoids impure random().
  const gradId = `barGrad-${gradientFrom.replace("#", "")}-${gradientTo.replace("#", "")}`;

  return (
    <div className="w-full">
      <div className="relative">
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="w-full overflow-visible"
          style={{ height }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientFrom} stopOpacity={0.85} />
              <stop offset="100%" stopColor={gradientTo} stopOpacity={0.2} />
            </linearGradient>
          </defs>

          {/* Grid lines for visual depth */}
          <line x1="0" y1={height * 0.25} x2="100" y2={height * 0.25} stroke="var(--border)" strokeWidth="0.1" strokeDasharray="1,1" />
          <line x1="0" y1={height * 0.5} x2="100" y2={height * 0.5} stroke="var(--border)" strokeWidth="0.1" strokeDasharray="1,1" />
          <line x1="0" y1={height * 0.75} x2="100" y2={height * 0.75} stroke="var(--border)" strokeWidth="0.1" strokeDasharray="1,1" />

          {data.map((d, i) => {
            // Give it a minimum height of 2px if the value > 0 so it's visible, else 0
            const h = d.value > 0 ? Math.max(3, (d.value / max) * (height - 8)) : 0;
            return (
              <rect
                key={i}
                x={i * barW + barW * 0.15}
                y={height - h}
                width={barW * 0.7}
                height={h}
                fill={`url(#${gradId})`}
                stroke={gradientFrom}
                strokeWidth="0.15"
                rx={1}
                className="transition-all duration-300 hover:opacity-100 opacity-90 cursor-pointer"
              >
                <title suppressHydrationWarning>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>

      <div suppressHydrationWarning className="mt-3 flex justify-between border-t border-border/60 pt-2 text-[10px] text-muted">
        <span>{data[0].label}</span>
        <span className="font-semibold text-foreground/80">
          Peak {peak.label}: <span className="text-primary font-bold">{format(peak.value)}</span>
        </span>
        <span>{data[data.length - 1].label}</span>
      </div>
      <p suppressHydrationWarning className="mt-1 text-center text-[10px] font-semibold text-muted">
        Total: <span className="text-foreground">{format(total)}</span>
      </p>
    </div>
  );
}
