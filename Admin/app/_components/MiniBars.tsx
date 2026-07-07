/**
 * Tiny dependency-free SVG bar chart. The admin panel is an internal tool, so
 * a hand-rolled chart beats shipping a full charting library. Pure server
 * component — no client JS.
 */
export default function MiniBars({
  data,
  height = 120,
  color = "#34d399",
  format = (v: number) => String(v),
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-zinc-600">No data yet.</p>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / data.length;
  const total = data.reduce((s, d) => s + d.value, 0);
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 4);
          return (
            <rect
              key={i}
              x={i * barW + barW * 0.15}
              y={height - h}
              width={barW * 0.7}
              height={h}
              fill={color}
              rx={0.6}
            >
              <title>
                {d.label}: {format(d.value)}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
        <span>{data[0].label}</span>
        <span>
          peak {peak.label}: {format(peak.value)}
        </span>
        <span>{data[data.length - 1].label}</span>
      </div>
      <p className="mt-0.5 text-center text-[10px] text-zinc-600">
        total {format(total)}
      </p>
    </div>
  );
}
