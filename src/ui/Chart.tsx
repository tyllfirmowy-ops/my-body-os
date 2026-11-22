import { addDays, diffDays, type LocalDate } from '../domain/dates';
import type { DatedValue } from '../domain/calc';

/** Prosty wykres SVG: punkty = dane rzeczywiste, linia = średnia krocząca 7 dni (tylko gdy ≥4 pomiary w oknie). Luki = brak danych. */
export function TrendChart({ data, from, to, unit, goal, showAvg = true, height = 160 }: {
  data: DatedValue[]; from: LocalDate; to: LocalDate; unit: string; goal?: number; showAvg?: boolean; height?: number;
}) {
  const pts = data.filter((d) => d.date >= from && d.date <= to);
  if (pts.length < 2) return <div className="h-24 grid place-items-center text-sm text-muted">Za mało danych do wykresu ({pts.length})</div>;
  const span = Math.max(1, diffDays(from, to));
  const vals = pts.map((p) => p.value).concat(goal !== undefined && goal > Math.min(...pts.map((p) => p.value)) - 3 ? [goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const W = 340, H = height, L = 34, R = 8, T = 8, B = 18;
  const x = (d: LocalDate) => L + (diffDays(from, d) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const avg: { d: LocalDate; v: number }[] = [];
  if (showAvg) for (let i = 0; i <= span; i++) {
    const d = addDays(from, i);
    const w = pts.filter((p) => p.date <= d && p.date > addDays(d, -7));
    if (w.length >= 4) avg.push({ d, v: w.reduce((a, b) => a + b.value, 0) / w.length });
  }
  const path = avg.map((a, i) => `${i && diffDays(avg[i - 1].d, a.d) === 1 ? 'L' : 'M'}${x(a.d).toFixed(1)},${y(a.v).toFixed(1)}`).join('');
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Wykres ${unit}`}>
      {ticks.map((t) => (
        <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={L - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{t.toFixed(1)}</text></g>
      ))}
      {goal !== undefined && goal >= lo && goal <= hi && <g><line x1={L} x2={W - R} y1={y(goal)} y2={y(goal)} stroke="var(--accent)" strokeDasharray="3 4" opacity=".6" />
        <text x={W - R} y={y(goal) - 3} textAnchor="end" fontSize="9" fill="var(--accent)">cel {goal}</text></g>}
      {pts.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="2.6" fill="var(--muted)" opacity=".75" />)}
      {path && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      <text x={L} y={H - 4} fontSize="9" fill="var(--muted)">{from.slice(5)}</text>
      <text x={W - R} y={H - 4} fontSize="9" textAnchor="end" fill="var(--muted)">{to.slice(5)}</text>
    </svg>
  );
}

export function Bars({ data, from, to, target, height = 110 }: { data: DatedValue[]; from: LocalDate; to: LocalDate; target?: number; height?: number }) {
  const span = diffDays(from, to) + 1;
  const max = Math.max(target ?? 0, ...data.map((d) => d.value), 1) * 1.1;
  const W = 340, H = height, bw = (W - 8) / span;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Wykres słupkowy">
      {Array.from({ length: span }, (_, i) => {
        const d = addDays(from, i); const v = data.find((x) => x.date === d)?.value;
        return v === undefined
          ? <rect key={d} x={4 + i * bw + 1} y={H - 16} width={Math.max(1, bw - 2)} height={2} fill="var(--line)" />
          : <rect key={d} x={4 + i * bw + 1} y={H - 14 - (v / max) * (H - 20)} width={Math.max(1, bw - 2)} height={(v / max) * (H - 20)} rx="2" fill="var(--accent)" opacity=".85" />;
      })}
      {target && <line x1="4" x2={W - 4} y1={H - 14 - (target / max) * (H - 20)} y2={H - 14 - (target / max) * (H - 20)} stroke="var(--warn)" strokeDasharray="3 4" />}
      <text x="4" y={H - 2} fontSize="9" fill="var(--muted)">{from.slice(5)}</text>
      <text x={W - 4} y={H - 2} fontSize="9" textAnchor="end" fill="var(--muted)">{to.slice(5)}</text>
    </svg>
  );
}
