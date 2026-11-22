import type { SafetyLevel } from './safety';

/** Minimalny opis ćwiczenia potrzebny do zasad zamiany (bez zależności od UI). */
export interface SwapExercise { id: string; knee: 'none' | 'low' | 'moderate'; group?: string; equip?: string[]; swapTo?: string[] }
export interface SwapSession { order: string[]; substitutions?: Record<string, string> }
export interface SwapCtx { safety: SafetyLevel; kneeCleared: boolean; equipment?: string[]; inSession?: string[] }
export interface SwapOption { id: string; allowed: boolean; reason?: string; original: boolean }

const KNEE = { none: 0, low: 1, moderate: 2 } as const;

/** Faktycznie wykonywane ćwiczenie w danym slocie planu. */
export const actualFor = (s: SwapSession, slot: string) => s.substitutions?.[slot] ?? slot;

/**
 * Lista zamienników dla slotu (pierwotne ćwiczenie + alternatywy), z uzasadnieniem blokad.
 * Zasady bezpieczeństwa (nie da się ich obejść zamianą):
 *  - blokada nóg (stop_legs): tylko ćwiczenia bez obciążenia kolana,
 *  - ostrożność (caution_legs): obciążenie kolana najwyżej „niskie”,
 *  - kolano bez oceny specjalisty: zamiennik nie może obciążać kolana bardziej niż ćwiczenie z planu.
 */
export function swapOptions(slot: string, lib: (id: string) => SwapExercise | undefined, ctx: SwapCtx): SwapOption[] {
  const orig = lib(slot);
  if (!orig) return [];
  const ids = [slot, ...(orig.swapTo ?? [])];
  return ids.map((id) => {
    const e = lib(id);
    if (!e) return { id, allowed: false, reason: 'Nieznane ćwiczenie', original: id === slot };
    let reason: string | undefined;
    if (ctx.safety === 'urgent') reason = 'Objaw alarmowy: dziś bez treningu';
    else if (ctx.safety === 'stop_legs' && e.knee !== 'none') reason = 'Blokada kolana: dziś tylko ćwiczenia bez obciążenia kolana';
    else if (ctx.safety === 'caution_legs' && KNEE[e.knee] > KNEE.low) reason = 'Kolano: dziś bez ćwiczeń mocno obciążających kolano';
    else if (!ctx.kneeCleared && KNEE[e.knee] > KNEE[orig.knee]) reason = 'Bardziej obciąża kolano niż ćwiczenie z planu (brak oceny specjalisty)';
    else if (id !== slot && ctx.inSession?.includes(id)) reason = 'To ćwiczenie jest już w tym treningu';
    else if (ctx.equipment?.length && e.equip?.length && !e.equip.some((q) => ctx.equipment!.includes(q))) reason = 'Brak wybranego sprzętu';
    return { id, allowed: !reason, reason, original: id === slot };
  });
}

/** Zamiana ćwiczenia w slocie (czysta funkcja). Powrót do oryginału usuwa podmianę. Historia serii się nie zmienia. */
export function swapExercise<T extends SwapSession>(s: T, slot: string, to: string, options: SwapOption[]): T {
  if (!s.order.includes(slot)) throw new Error('Nie ma takiego ćwiczenia w treningu');
  const opt = options.find((o) => o.id === to);
  if (!opt || !opt.allowed) throw new Error(opt?.reason ?? 'Zamiana niedozwolona');
  const subs = { ...(s.substitutions ?? {}) };
  if (to === slot) delete subs[slot]; else subs[slot] = to;
  return { ...s, substitutions: subs };
}

/** Serie przypisane do slotu: nowe mają pole slot; starsze (sprzed v0.5) mają tylko exerciseId = slot. */
export function setsForSlot<S extends { exerciseId: string; slot?: string }>(sets: S[], slot: string): S[] {
  return sets.filter((x) => (x.slot ?? x.exerciseId) === slot);
}

/** Ostatnie wykonane serie danego ćwiczenia (osobna historia każdej wersji ćwiczenia, niezależnie od slotu). */
export function lastSetsFor<Se extends { id: string; date: string; status: string; startedAt: number }, St extends { sessionId: string; exerciseId: string; done: boolean; setIndex: number }>(
  sessions: Se[], sets: St[], exerciseId: string, excludeSession?: string,
): { session: Se; sets: St[] } | undefined {
  const done = sessions.filter((s) => s.status === 'completed' && s.id !== excludeSession).sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt);
  for (const s of done) {
    const ss = sets.filter((x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.done).sort((a, b) => a.setIndex - b.setIndex);
    if (ss.length) return { session: s, sets: ss };
  }
  return undefined;
}

/** Blokada kolana w trakcie treningu: zależy od ćwiczenia i dzisiejszego poziomu bezpieczeństwa, nie od planu. */
export function kneeBlocked(level: string, knee: 'none' | 'low' | 'moderate'): boolean {
  return level === 'urgent' || (level === 'stop_legs' && knee !== 'none') || (level === 'caution_legs' && knee === 'moderate');
}

/** Historia ćwiczenia (exerciseId) z ostatnich zakończonych sesji, od najnowszej. Zamienniki mają osobną historię. */
export function historyFor<Se extends { id: string; date: string; status: string; startedAt: number; technique?: Record<string, 'ok' | 'bad'> }, St extends { sessionId: string; exerciseId: string; done: boolean; setIndex: number; weightKg: number; reps: number; rir?: number; pain?: number }>(
  sessions: Se[], sets: St[], exerciseId: string, excludeSession?: string, n = 3,
): { date: string; sets: St[]; technique?: 'ok' | 'bad' }[] {
  const out: { date: string; sets: St[]; technique?: 'ok' | 'bad' }[] = [];
  const done = sessions.filter((s) => s.status === 'completed' && s.id !== excludeSession).sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt);
  for (const s of done) {
    const ss = sets.filter((x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.done).sort((a, b) => a.setIndex - b.setIndex);
    if (ss.length) out.push({ date: s.date, sets: ss, technique: s.technique?.[exerciseId] });
    if (out.length >= n) break;
  }
  return out;
}
