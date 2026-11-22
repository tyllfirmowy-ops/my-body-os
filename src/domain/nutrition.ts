import { scaleNutrients, sumNutrients } from './calc';
import type { FoodProduct, Nutrients } from './types';
import type { DayTemplate, TemplateItem } from '../data/foods';

export type ProductMap = Map<string, FoodProduct>;

export function itemNutrients(products: ProductMap, item: TemplateItem): Nutrients {
  const p = products.get(item.productId);
  if (!p) throw new Error(`Brak produktu ${item.productId}`);
  return scaleNutrients(p.per100, item.grams);
}
export function templateTotals(products: ProductMap, day: DayTemplate): Nutrients {
  return sumNutrients(day.meals.flatMap((m) => m.items.map((i) => itemNutrients(products, i))));
}

/** Skaluje porcję przepisu / szablonu (np. meal prep na 3 dni). */
export function scaleItems(items: TemplateItem[], factor: number): TemplateItem[] {
  return items.map((i) => ({ ...i, grams: Math.round(i.grams * factor) }));
}

export interface FitTargets { kcal: number; proteinG: number; fatG: number; carbsG: number }
export interface FitResult {
  day: DayTemplate; totals: Nutrients; ok: boolean;
  deviation: { kcal: number; protein: number; fat: number; carbs: number };
  swapped: { from: string; to: string }[];
  notes: string[];
}
const TOL = { kcalPct: 0.05, proteinG: 8, fatG: 8, carbsPct: 0.1, carbsMinG: 20 };
const ROLE_LIMITS: Record<string, [number, number]> = { protein: [0.6, 1.6], carb: [0.4, 1.8], fat: [0.3, 2] };

/**
 * Dopasowanie szablonu dnia do kcal i makro:
 * 1) produkty oznaczone jako źle tolerowane → zamiana na produkt tej samej roli (dopasowanie białka lub kcal),
 * 2) iteracyjne skalowanie grup: białko → źródła białka, tłuszcz → źródła tłuszczu, węglowodany → źródła węgli
 *    (warzywa i owoce bez zmian), w granicach rozsądnych porcji,
 * 3) zaokrąglenie do 5 g i ocena tolerancji (kcal ±5%, białko ±8 g, tłuszcz ±8 g, węgle ±max(20 g, 10%)).
 * Węgle są lekko obniżane o energię z błonnika, żeby trafić w kcal z etykiet.
 */
export function fitDayToTargets(products: ProductMap, day: DayTemplate, t: FitTargets): FitResult {
  const swapped: { from: string; to: string }[] = [];
  const notes: string[] = [];
  const all = [...products.values()];
  let meals = day.meals.map((m) => ({ ...m, items: m.items.map((i) => {
    const p = products.get(i.productId);
    if (!p || p.tolerance !== 'bad') return { ...i };
    const alt = candidatesForSwap(all, p).find((c) => c.dairy === 'none') ?? candidatesForSwap(all, p)[0];
    if (!alt) { notes.push(`Brak zamiennika dla: ${p.name}`); return { ...i }; }
    swapped.push({ from: p.name, to: alt.name });
    return { productId: alt.id, grams: swapProduct(p, i.grams, alt).grams };
  }) }));
  const base = meals.map((m) => m.items.map((i) => i.grams));
  const role = (id: string) => products.get(id)?.role ?? 'mixed';
  const factor: Record<string, number> = { protein: 1, carb: 1, fat: 1 };
  const apply = () => meals.map((m, mi) => ({ ...m, items: m.items.map((i, ii) => factor[role(i.productId)] !== undefined ? { ...i, grams: base[mi][ii] * factor[role(i.productId)] } : { ...i, grams: base[mi][ii] }) }));
  const totalsOf = (ms: typeof meals) => sumNutrients(ms.flatMap((m) => m.items.map((i) => itemNutrients(products, i))));
  const groupSum = (ms: typeof meals, r: string, k: keyof Nutrients) => sumNutrients(ms.flatMap((m) => m.items.filter((i) => role(i.productId) === r).map((i) => itemNutrients(products, i))))[k] as number;
  const clamp = (r: string, v: number) => Math.min(ROLE_LIMITS[r][1], Math.max(ROLE_LIMITS[r][0], v));
  for (let it = 0; it < 12; it++) {
    const cur = apply(); const tot = totalsOf(cur);
    const adj = (r: string, k: 'protein' | 'fat' | 'carbs', target: number) => {
      const g = groupSum(cur, r, k); if (g <= 0) return;
      const rest = tot[k] - g;
      factor[r] = clamp(r, factor[r] * Math.max(0.1, (target - rest) / g));
    };
    // energia spoza B/T/W (błonnik ~2 kcal/g, polialkohole) – korygujemy nią węgle, żeby trafić w kcal
    const other = tot.kcal - (tot.protein * 4 + tot.fat * 9 + tot.carbs * 4);
    adj('protein', 'protein', t.proteinG); adj('fat', 'fat', t.fatG); adj('carb', 'carbs', t.carbsG - Math.max(0, other) / 4);
  }
  meals = apply().map((m) => ({ ...m, items: m.items.map((i) => ({ ...i, grams: Math.max(5, Math.round(i.grams / 5) * 5) })) }));
  const totals = totalsOf(meals);
  const deviation = { kcal: Math.round(totals.kcal - t.kcal), protein: Math.round(totals.protein - t.proteinG), fat: Math.round(totals.fat - t.fatG), carbs: Math.round(totals.carbs - t.carbsG) };
  const ok = Math.abs(deviation.kcal) <= t.kcal * TOL.kcalPct && Math.abs(deviation.protein) <= TOL.proteinG && Math.abs(deviation.fat) <= TOL.fatG && Math.abs(deviation.carbs) <= Math.max(TOL.carbsMinG, t.carbsG * TOL.carbsPct) + Math.max(0, totals.kcal - (totals.protein * 4 + totals.fat * 9 + totals.carbs * 4)) / 4;
  if (!ok) notes.push('Szablon nie mieści się w tolerancji przy rozsądnych porcjach: sprawdź odchylenia i dopasuj ręcznie.');
  return { day: { ...day, meals }, totals, ok, deviation, swapped, notes };
}

/** @deprecated zachowane dla zgodności: dopasowanie tylko do kcal (makro proporcjonalnie). */
export function fitDayToKcal(products: ProductMap, day: DayTemplate, targetKcal: number): DayTemplate {
  const tot = templateTotals(products, day);
  const k = targetKcal / tot.kcal;
  const fatG = tot.fat * k;
  return fitDayToTargets(products, day, { kcal: targetKcal, proteinG: tot.protein, fatG, carbsG: (targetKcal - tot.protein * 4 - fatG * 9) / 4 }).day;
}

/** Lista zakupów: suma gramatur z wybranych dni szablonów. */
export function shoppingList(products: ProductMap, days: DayTemplate[]): { productId: string; name: string; grams: number; basis: string }[] {
  const acc = new Map<string, number>();
  for (const d of days) for (const m of d.meals) for (const i of m.items) acc.set(i.productId, (acc.get(i.productId) ?? 0) + i.grams);
  return [...acc.entries()].map(([productId, grams]) => {
    const p = products.get(productId)!;
    return { productId, name: p.name, grams, basis: p.basis };
  }).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

/**
 * Zamiennik produktu: gramatura dobrana tak, by zachować białko (dla źródeł białka) albo kcal (pozostałe).
 * Zwraca różnice, żeby użytkownik widział koszt zamiany.
 */
export function swapProduct(from: FoodProduct, grams: number, to: FoodProduct) {
  const orig = scaleNutrients(from.per100, grams);
  const key: keyof Nutrients = from.role === 'protein' && to.per100.protein > 0 ? 'protein' : 'kcal';
  const newGrams = to.per100[key] > 0 ? Math.round(((orig[key] / to.per100[key]) * 100) / 5) * 5 : grams;
  const next = scaleNutrients(to.per100, newGrams);
  return {
    grams: newGrams, matchedOn: key,
    diff: { kcal: next.kcal - orig.kcal, protein: next.protein - orig.protein, fat: next.fat - orig.fat, fiber: next.fiber - orig.fiber },
    dairyWarning: to.dairy !== 'none',
  };
}

export function candidatesForSwap(all: FoodProduct[], from: FoodProduct): FoodProduct[] {
  return all.filter((p) => p.id !== from.id && p.role === from.role && p.tolerance !== 'bad');
}
