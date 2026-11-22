/**
 * Dane z Apple Zdrowie przekazywane przez Skrót iOS.
 * Formaty: "MBOS1;steps=8432;sleep=7.2;active=540;rhr=62;weight=109.8;date=2026-11-22"
 * albo hash adresu: "#sync&steps=8432&sleep=7.2..." (gdy aplikacja działa w Safari).
 * Separator dziesiętny może być przecinkiem (polskie ustawienia iPhone'a).
 */
export interface HealthSync {
  date?: string;
  steps?: number;
  sleepMinutes?: number;
  activeKcal?: number;
  restingHr?: number;
  weightKg?: number;
}

const num = (v: string | undefined) => {
  if (v === undefined) return undefined;
  const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Sen: <24 → godziny, <1440 → minuty, większe → sekundy (różne wersje Skrótów zwracają różne jednostki). */
export function normalizeSleep(v: number | undefined): number | undefined {
  if (v === undefined || v <= 0) return undefined;
  const min = v < 24 ? v * 60 : v < 1440 ? v : v / 60;
  return min >= 60 && min <= 16 * 60 ? Math.round(min) : undefined;
}

export function parseSync(text: string): HealthSync | null {
  const t = text.trim();
  let body: string;
  if (t.startsWith('MBOS1')) body = t.slice(5);
  else if (t.includes('#sync')) body = t.slice(t.indexOf('#sync') + 5);
  else return null;
  const kv: Record<string, string> = {};
  for (const part of body.split(/[;&]/)) {
    const i = part.indexOf('=');
    if (i > 0) kv[decodeURIComponent(part.slice(0, i)).trim().toLowerCase()] = decodeURIComponent(part.slice(i + 1)).trim();
  }
  const r: HealthSync = {};
  const steps = num(kv.steps); if (steps !== undefined && steps >= 0 && steps < 100000) r.steps = Math.round(steps);
  const sleep = normalizeSleep(num(kv.sleep)); if (sleep) r.sleepMinutes = sleep;
  const act = num(kv.active); if (act !== undefined && act >= 0 && act < 6000) r.activeKcal = Math.round(act);
  const rhr = num(kv.rhr); if (rhr !== undefined && rhr >= 30 && rhr <= 130) r.restingHr = Math.round(rhr);
  const w = num(kv.weight); if (w !== undefined && w >= 30 && w <= 300) r.weightKg = Math.round(w * 10) / 10;
  if (kv.date && /^\d{4}-\d{2}-\d{2}$/.test(kv.date)) r.date = kv.date;
  return Object.keys(r).filter((k) => k !== 'date').length ? r : null;
}
