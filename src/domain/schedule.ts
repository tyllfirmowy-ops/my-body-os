import { addDays, diffDays, mondayOf, type LocalDate } from './dates';

/** 2-2-3, cykl 14 dni od poniedziałku: 1 = córka u użytkownika. */
export const PATTERN_223 = [1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0] as const;

export interface CustodyInput { cycleStart: LocalDate; overrides: Record<LocalDate, boolean> }

export function cycleIndex(cycleStart: LocalDate, date: LocalDate): number {
  return ((diffDays(cycleStart, date) % 14) + 14) % 14;
}
export function cycleStartFor(cycleStart: LocalDate, date: LocalDate): LocalDate {
  return addDays(date, -cycleIndex(cycleStart, date));
}
export function withDaughter(c: CustodyInput, date: LocalDate): boolean {
  if (date in c.overrides) return c.overrides[date];
  return PATTERN_223[cycleIndex(c.cycleStart, date)] === 1;
}

export interface SessionRef { date: LocalDate; templateId: 'A' | 'B'; status: 'completed' | 'in_progress' | 'abandoned' }
export interface PlannedWorkout { date: LocalDate; templateId: 'A' | 'B' }

/**
 * Plan treningów od `from` na `horizon` dni.
 * - tylko dni bez córki,
 * - maks. `perCycle` treningów w każdym 14-dniowym cyklu (wliczając wykonane),
 * - min. `minGapDays` między treningami (2 = ~48 h),
 * - opuszczone treningi NIE kumulują się: plan liczony jest zawsze od nowa od dziś,
 * - rotacja A/B wynika z ostatniego wykonanego treningu.
 */
export function planWorkouts(opts: {
  from: LocalDate; horizon: number; custody: CustodyInput; sessions: SessionRef[]; perCycle: number; minGapDays?: number;
}): PlannedWorkout[] {
  const gap = opts.minGapDays ?? 2;
  const done = opts.sessions.filter((s) => s.status === 'completed').sort((a, b) => a.date.localeCompare(b.date));
  let last = done.length ? done[done.length - 1] : undefined;
  let nextType: 'A' | 'B' = last ? (last.templateId === 'A' ? 'B' : 'A') : 'A';
  let lastDate = last?.date;
  const doneToday = done.some((s) => s.date === opts.from);
  const plan: PlannedWorkout[] = [];
  const countInCycle = new Map<LocalDate, number>();
  for (const s of done) {
    const cs = cycleStartFor(opts.custody.cycleStart, s.date);
    countInCycle.set(cs, (countInCycle.get(cs) ?? 0) + 1);
  }
  for (let i = 0; i < opts.horizon; i++) {
    const d = addDays(opts.from, i);
    if (i === 0 && doneToday) continue;
    if (withDaughter(opts.custody, d)) continue;
    if (lastDate && diffDays(lastDate, d) < gap) continue;
    const cs = cycleStartFor(opts.custody.cycleStart, d);
    if ((countInCycle.get(cs) ?? 0) >= opts.perCycle) continue;
    plan.push({ date: d, templateId: nextType });
    countInCycle.set(cs, (countInCycle.get(cs) ?? 0) + 1);
    lastDate = d;
    nextType = nextType === 'A' ? 'B' : 'A';
  }
  return plan;
}

/** Bilans cyklu: zaplanowane vs wykonane (odpoczynek i opieka nie obniżają oceny). */
export function cycleSummary(custody: CustodyInput, sessions: SessionRef[], date: LocalDate, perCycle: number) {
  const cs = cycleStartFor(custody.cycleStart, date);
  const ce = addDays(cs, 13);
  const done = sessions.filter((s) => s.status === 'completed' && s.date >= cs && s.date <= ce).length;
  let freeDays = 0;
  for (let i = 0; i < 14; i++) if (!withDaughter(custody, addDays(cs, i))) freeDays++;
  return { cycleStart: cs, cycleEnd: ce, done, target: perCycle, freeDays };
}

// ---- Planowanie od 0.8: dostępność ogólna, bez zależności od kalendarza opieki ----

export interface WeeklyOpts {
  from: LocalDate; horizon: number; sessions: SessionRef[];
  /** cel treningów w tygodniu (pon–nd); domyślnie 3 */
  perWeek?: number;
  /** min. odstęp w dniach między treningami tego samego typu FBW (2 ≈ 48 h; heurystyka regeneracji) */
  minGapDays?: number;
  /** dni oznaczone przez użytkownika jako niedostępne / przełożone */
  skip?: Set<LocalDate> | LocalDate[];
}

/**
 * Plan FBW A/B od `from`: maks. `perWeek` treningów w tygodniu (wliczając wykonane), min. odstęp, pomija dni niedostępne.
 * Pominięte treningi nie kumulują się (plan zawsze od dziś), rotacja A/B z ostatniego wykonanego treningu.
 */
export function planWeekly(o: WeeklyOpts): PlannedWorkout[] {
  const perWeek = Math.max(1, Math.min(6, o.perWeek ?? 3));
  const gap = o.minGapDays ?? 2;
  const skip = o.skip instanceof Set ? o.skip : new Set(o.skip ?? []);
  const done = o.sessions.filter((s) => s.status === 'completed').sort((a, b) => a.date.localeCompare(b.date));
  const last = done.at(-1);
  let nextType: 'A' | 'B' = last ? (last.templateId === 'A' ? 'B' : 'A') : 'A';
  let lastDate = last?.date;
  const perWk = new Map<LocalDate, number>();
  for (const s of done) perWk.set(mondayOf(s.date), (perWk.get(mondayOf(s.date)) ?? 0) + 1);
  const doneToday = done.some((s) => s.date === o.from);
  const plan: PlannedWorkout[] = [];
  for (let i = 0; i < o.horizon; i++) {
    const d = addDays(o.from, i);
    if (i === 0 && doneToday) continue;
    if (skip.has(d)) continue;
    if (lastDate && diffDays(lastDate, d) < gap) continue;
    const wk = mondayOf(d);
    if ((perWk.get(wk) ?? 0) >= perWeek) continue;
    plan.push({ date: d, templateId: nextType });
    perWk.set(wk, (perWk.get(wk) ?? 0) + 1);
    lastDate = d;
    nextType = nextType === 'A' ? 'B' : 'A';
  }
  return plan;
}

/** Bilans tygodnia: wykonane vs cel; 2 treningi to wciąż realizacja minimum (≥ 2 dni w tygodniu wg WHO/ACSM). */
export function weekSummary(sessions: SessionRef[], date: LocalDate, perWeek: number) {
  const ws = mondayOf(date), we = addDays(ws, 6);
  const done = sessions.filter((s) => s.status === 'completed' && s.date >= ws && s.date <= we).length;
  return { weekStart: ws, weekEnd: we, done, target: perWeek, minimum: Math.min(2, perWeek) };
}
