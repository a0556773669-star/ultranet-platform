import type { SeriesPoint } from "@/lib/rental-reports";

/**
 * גרף מגמה קטן, בסגנון מדד בבורסה: קו + שטח, והנקודה האחרונה מסומנת. SVG טהור, בלי ספרייה.
 * `values` עם `null` = אין נתון בנקודה (למשל תפוסה בתקופה בלי ימי זמינות) — הקו נשבר שם.
 */
export function TrendChart({
  points,
  pick,
  format,
  color,
}: {
  points: SeriesPoint[];
  pick: (p: SeriesPoint) => number | null;
  format: (n: number) => string;
  color: string;
}) {
  const W = 320;
  const H = 96;
  const PAD = 6;
  const values = points.map(pick);
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return <p className="py-6 text-center text-xs text-muted">אין נתונים בתקופה</p>;

  const min = Math.min(0, ...nums);
  const max = Math.max(...nums, min + 1e-9);
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (points.length - 1));
  const y = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - 2 * PAD);

  // הקו עובר משמאל לימין בסדר הזמן; בעברית (RTL) הגרף נשאר LTR כמו כל מדד.
  const segments: string[] = [];
  let cur = "";
  values.forEach((v, i) => {
    if (v === null) {
      if (cur) segments.push(cur);
      cur = "";
    } else cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
  });
  if (cur) segments.push(cur);
  const lastIdx = values.map((v) => v !== null).lastIndexOf(true);
  const lastVal = values[lastIdx] as number;
  const firstIdx = values.findIndex((v) => v !== null);
  const area = `M${x(firstIdx).toFixed(1)},${H - PAD} ${values
    .map((v, i) => (v === null ? "" : `L${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .join(" ")} L${x(lastIdx).toFixed(1)},${H - PAD} Z`;

  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label="גרף מגמה">
        {min < 0 && <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeDasharray="3 3" />}
        <path d={area} fill={color} opacity={0.1} />
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        <circle cx={x(lastIdx)} cy={y(lastVal)} r={3.5} fill={color} />
      </svg>
      <div className="flex justify-between text-[11px] text-muted">
        <span>{points[0]?.label}</span>
        <span className="font-bold" style={{ color }}>
          {format(lastVal)}
        </span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}
