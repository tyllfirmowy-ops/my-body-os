export interface SetResult { weightKg: number; reps: number; rir?: number; pain?: number; done: boolean }
export interface Suggestion {
  action: 'increase' | 'hold' | 'decrease' | 'skip' | 'no_data';
  weightKg: number | null; targetReps: string; reason: string;
}

/**
 * Podwójna progresja. Zwiększenie ciężaru tylko gdy WSZYSTKIE warunki są spełnione;
 * brak danych => brak automatycznego zwiększenia.
 */
export function suggestNext(p: {
  last: SetResult[] | undefined; plannedSets: number; repMin: number; repMax: number; increment: number;
  technique?: 'ok' | 'bad'; safetyBlock: boolean; minRir?: number;
}): Suggestion {
  const range = `${p.repMin}–${p.repMax}`;
  if (p.safetyBlock) return { action: 'skip', weightKg: null, targetReps: range, reason: 'Aktywna blokada bezpieczeństwa. Pomiń to ćwiczenie dziś.' };
  const sets = (p.last ?? []).filter((s) => s.done);
  if (!sets.length) return { action: 'no_data', weightKg: null, targetReps: range, reason: 'Pierwszy raz: dobierz ciężar, przy którym zostają ~3 powtórzenia w zapasie.' };
  const w = sets[0].weightKg;
  const maxPain = Math.max(...sets.map((s) => s.pain ?? 0));
  if (maxPain >= 4) return { action: 'decrease', weightKg: round(w * 0.85, p.increment), targetReps: range, reason: `Ból ${maxPain}/10 ostatnio. Zmniejsz ciężar albo pomiń, jeśli ból wraca.` };
  if (p.technique === 'bad') return { action: 'hold', weightKg: w, targetReps: range, reason: 'Zgłoszona słabsza technika: zostań przy tym ciężarze.' };
  const allSetsDone = sets.length >= p.plannedSets;
  const allTop = sets.every((s) => s.reps >= p.repMax);
  const rirKnown = sets.every((s) => s.rir !== undefined);
  const rirOk = rirKnown && Math.min(...sets.map((s) => s.rir!)) >= (p.minRir ?? 1);
  const sameWeight = sets.every((s) => s.weightKg === w);
  if (allSetsDone && allTop && sameWeight && p.technique === 'ok' && rirOk && maxPain <= 2) {
    return { action: 'increase', weightKg: w + p.increment, targetReps: `${p.repMin}+`, reason: `Wszystkie serie na górze zakresu (${p.repMax}) z zapasem. +${p.increment} kg.` };
  }
  if (sets.some((s) => s.reps < p.repMin) && sets.some((s) => s.rir === 0)) {
    return { action: 'decrease', weightKg: round(w * 0.9, p.increment), targetReps: range, reason: 'Poniżej zakresu powtórzeń bez zapasu. Lekko zmniejsz ciężar.' };
  }
  const missing = [!rirKnown && 'RIR', p.technique === undefined && 'ocena techniki'].filter(Boolean).join(', ');
  return { action: 'hold', weightKg: w, targetReps: range, reason: missing && allTop ? `Brak danych (${missing}), więc bez zwiększania.` : 'Ten sam ciężar, spróbuj dodać 1 powtórzenie w serii.' };
}

function round(v: number, step: number): number {
  return Math.max(0, Math.round(v / step) * step);
}

/** Pierwsze 2 tygodnie: 2 serie; tydz. 3–4: docelowe serie, ale max 3. */
export function plannedSetsFor(templateSets: number, weekIndex: number): number {
  return weekIndex < 2 ? Math.min(2, templateSets) : templateSets;
}
