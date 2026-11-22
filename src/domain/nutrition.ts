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

/**
 * Dopasowanie gramatur do celu kcal: białko zostaje bez zmian,
 * skalowane są źródła węglowodanów i tłuszczu. Zaokrąglenie do 5 g.
 */
export function fitDayToKcal(products: ProductMap, day: DayTemplate, targetKcal: number): DayTemplate {
  const total = templateTotals(products, day).kcal;
  const adjustable = day.meals.flatMap((m) => m.items).filter((i) => ['carb', 'fat'].includes(products.get(i.productId)?.role ?? ''));
  const adjKcal = sumNutrients(adjustable.map((i) => itemNutrients(products, i))).kcal;
  if (adjKcal <= 0) return day;
  const factor = Math.max(0.5, Math.min(1.5, (adjKcal + (targetKcal - total)) / adjKcal));
  return {
    ...day,
    meals: day.meals.map((m) => ({
      ...m,
      items: m.items.map((i) => ['carb', 'fat'].includes(products.get(i.productId)?.role ?? '')
        ? { ...i, grams: Math.max(5, Math.round((i.grams * factor) / 5) * 5) } : i),
    })),
  };
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
