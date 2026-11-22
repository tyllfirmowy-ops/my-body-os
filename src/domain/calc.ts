import { addDays, diffDays, type LocalDate } from './dates';
import type { Nutrients, UserProfile } from './types';

export function bmrMifflin(p: { weightKg: number; heightCm: number; age: number; sex: 'male' | 'female' }): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}
export function macroKcal(proteinG: number, fatG: number, carbsG: number): number {
  return proteinG * 4 + fatG * 9 + carbsG * 4;
}
export function ageOn(p: Pick<UserProfile, 'ageYears' | 'ageRefDate'>, date: LocalDate): number {
  return p.ageYears + Math.max(0, Math.floor(diffDays(p.ageRefDate, date) / 365.25));
}
/** Szacunkowe TDEE jako zakres (hipoteza, nie pomiar). */
export function tdeeRange(bmr: number): [number, number] {
  return [Math.round((bmr * 1.25) / 50) * 50, Math.round((bmr * 1.42) / 50) * 50];
}

export interface Avg { value: number | null; n: number }
/** Średnia z pominięciem braków danych (brak ≠ 0). */
export function mean(values: (number | null | undefined)[]): Avg {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return { value: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, n: v.length };
}
export function round(v: number | null, digits = 1): number | null {
  if (v === null) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export interface DatedValue { date: LocalDate; value: number }
/** Niepokrywające się bloki 7-dniowe kończące się na endDate (włącznie). Blok 0 = najnowszy. */
export function blockAverages(series: DatedValue[], endDate: LocalDate, blocks: number, size = 7): (Avg & { from: LocalDate; to: LocalDate })[] {
  const out = [];
  for (let b = 0; b < blocks; b++) {
    const to = addDays(endDate, -b * size);
    const from = addDays(to, -(size - 1));
    const vals = series.filter((s) => s.date >= from && s.date <= to).map((s) => s.value);
    out.push({ ...mean(vals), from, to });
  }
  return out;
}

const opt = (x?: number, y?: number) => (x === undefined && y === undefined ? undefined : (x ?? 0) + (y ?? 0));
/** Cukry, tłuszcze nasycone i sól są opcjonalne (nie każda etykieta/baza je podaje): suma tylko ze znanych wartości. */
export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  const r: Nutrients = { kcal: a.kcal + b.kcal, protein: a.protein + b.protein, fat: a.fat + b.fat, carbs: a.carbs + b.carbs, fiber: a.fiber + b.fiber };
  const sugar = opt(a.sugar, b.sugar), satFat = opt(a.satFat, b.satFat), salt = opt(a.salt, b.salt);
  if (sugar !== undefined) r.sugar = sugar; if (satFat !== undefined) r.satFat = satFat; if (salt !== undefined) r.salt = salt;
  return r;
}
export const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const r: Nutrients = { kcal: per100.kcal * f, protein: per100.protein * f, fat: per100.fat * f, carbs: per100.carbs * f, fiber: per100.fiber * f };
  if (per100.sugar !== undefined) r.sugar = per100.sugar * f;
  if (per100.satFat !== undefined) r.satFat = per100.satFat * f;
  if (per100.salt !== undefined) r.salt = per100.salt * f;
  return r;
}
export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(addNutrients, ZERO);
}
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1));
}
