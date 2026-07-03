/** Indian veg/non-veg square-dot marker. Renders nothing when isVeg is null. */
export default function VegDot({ isVeg }: { isVeg: boolean | null }) {
  if (isVeg === null) return null;
  const color = isVeg ? "#0f8a0f" : "#c0392b";
  return (
    <span
      className="inline-flex size-3.5 shrink-0 items-center justify-center border-2"
      style={{ borderColor: color }}
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
    </span>
  );
}
