import { addNutrients, ZERO } from './calc';
import type { EveningCheckIn, FoodEntry, MacroKey, Nutrients } from './types';

export interface DayIntake extends Nutrients {
  meals: number;
  entries: number;
  /** Udział kcal z wpisów, dla których dane makro jest znane (0–1). */
  coverage: Record<MacroKey, number>;
}

/** Suma dnia z rozróżnieniem „nieznane” od „zero”. */
export function sumDay(entries: FoodEntry[]): DayIntake | undefined {
  if (!entries.length) return undefined;
  const totals = entries.reduce<Nutrients>((a, e) => addNutrients(a, e.snapshot), ZERO);
  const kcal = totals.kcal;
  const keys: MacroKey[] = ['protein', 'fat', 'carbs', 'fiber'];
  const coverage = Object.fromEntries(keys.map((k) => {
    const unknownKcal = entries.filter((e) => e.unknown?.includes(k)).reduce((a, e) => a + e.snapshot.kcal, 0);
    return [k, kcal > 0 ? Math.max(0, 1 - unknownKcal / kcal) : entries.some((e) => e.unknown?.includes(k)) ? 0 : 1];
  })) as Record<MacroKey, number>;
  return { ...totals, meals: new Set(entries.map((e) => e.meal)).size, entries: entries.length, coverage };
}

export const COVERAGE_MIN = 0.8;
/** Makro do analiz tylko, gdy znane dla ≥80% kcal dnia. W przeciwnym razie brak danych (undefined), nie zaniżona liczba. */
export function reliableMacro(d: DayIntake | undefined, k: MacroKey): number | undefined {
  if (!d || d.coverage[k] < COVERAGE_MIN) return undefined;
  return d[k];
}

export type Completeness = 'confirmed' | 'probable' | 'incomplete' | 'none';
/**
 * Czy dziennik dnia jest kompletny?
 * - confirmed: użytkownik zaznaczył „wpisałem wszystko” i suma jest wiarygodna (≥ 50% celu),
 * - probable: brak potwierdzenia, ale ≥ (posiłki z planu − 1) posiłków i ≥ 70% celu,
 * - incomplete: są wpisy, ale nie wiadomo, czy wszystkie,
 * - none: brak wpisów.
 * Wartości < 50% celu przy potwierdzeniu traktujemy jako błąd zapisu (incomplete), nie jako „jadłem 900 kcal”.
 */
export function completeness(d: DayIntake | undefined, ev: EveningCheckIn | undefined, target: number, mealsPerDay: number): Completeness {
  if (!d) return 'none';
  if (ev?.foodLogComplete) return d.kcal >= target * 0.5 ? 'confirmed' : 'incomplete';
  if (ev?.foodLogComplete === false) return 'incomplete';
  return d.meals >= Math.max(2, mealsPerDay - 1) && d.kcal >= target * 0.7 ? 'probable' : 'incomplete';
}
