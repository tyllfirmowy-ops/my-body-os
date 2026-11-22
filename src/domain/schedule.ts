import { addDays, diffDays, type LocalDate } from './dates';

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
