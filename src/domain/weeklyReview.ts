import { addDays, mondayOf } from './dates';

interface SessionLike { id: string; date: string; status: string }
interface SetLike { sessionId: string; exerciseId: string; weightKg: number; reps: number; done: boolean }
export interface Best { weightKg: number; reps: number }
export interface Improvement { exerciseId: string; before: Best; after: Best }

/** Najlepsza seria: większy ciężar, przy tym samym ciężarze więcej powtórzeń. */
function bestOf(sets: SetLike[]): Best | null {
  let b: Best | null = null;
  for (const s of sets) if (s.done && (!b || s.weightKg > b.weightKg || (s.weightKg === b.weightKg && s.reps > b.reps))) b = { weightKg: s.weightKg, reps: s.reps };
  return b;
}

/**
 * Tygodniowe podsumowanie (pon–nd): liczba treningów i ćwiczenia, w których najlepsza seria jest lepsza niż w poprzednim tygodniu.
 * Porównuje tylko ćwiczenia wykonane w obu tygodniach (brak danych ≠ spadek).
 */
export function weeklyReview(sessions: SessionLike[], sets: SetLike[], today: string) {
  const ws = mondayOf(today), prevWs = addDays(ws, -7);
  const inWeek = (from: string) => new Set(sessions.filter((s) => s.status === 'completed' && s.date >= from && s.date <= addDays(from, 6)).map((s) => s.id));
  const cur = inWeek(ws), prev = inWeek(prevWs);
  const byEx = (ids: Set<string>) => {
    const m = new Map<string, SetLike[]>();
    for (const s of sets) if (ids.has(s.sessionId)) m.set(s.exerciseId, [...(m.get(s.exerciseId) ?? []), s]);
    return m;
  };
  const c = byEx(cur), p = byEx(prev);
  const improved: Improvement[] = [];
  let compared = 0;
  for (const [ex, ss] of c) {
    const a = bestOf(ss), b = bestOf(p.get(ex) ?? []);
    if (!a || !b) continue;
    compared++;
    if (a.weightKg > b.weightKg || (a.weightKg === b.weightKg && a.reps > b.reps)) improved.push({ exerciseId: ex, before: b, after: a });
  }
  return { weekStart: ws, done: cur.size, prevDone: prev.size, compared, improved };
}
