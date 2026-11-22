import { addNutrients, scaleNutrients, ZERO } from './calc';
import type { DayTemplateRec, FoodEntry, FoodProduct, MacroKey, Nutrients, Recipe, RecipeItem } from './types';
import type { DayTemplate } from '../data/foods';
import { candidatesForSwap, swapProduct, type ProductMap } from './nutrition';

const MACROS: MacroKey[] = ['protein', 'fat', 'carbs', 'fiber'];

export interface RecipeTotals {
  total: Nutrients;
  perServing: Nutrients;
  grams: number;
  /** kcal całego przepisu, dla których dane makro nie są znane */
  unknownKcal: Partial<Record<MacroKey, number>>;
  /** udział kcal ze znanym makro (0–1) */
  coverage: Record<MacroKey, number>;
  missing: string[];
  warnings: string[];
}

/** Suma przepisu z rozróżnieniem „nieznane” od „zero” (model kompletności z 0.4). */
export function recipeTotals(products: ProductMap, items: RecipeItem[], servings: number, opts: { dairyFree?: boolean } = {}): RecipeTotals {
  let total = ZERO;
  const unknownKcal: Partial<Record<MacroKey, number>> = {};
  const missing: string[] = [];
  const warnings: string[] = [];
  let grams = 0;
  for (const it of items) {
    const p = products.get(it.productId);
    if (!p) { missing.push(it.productId); continue; }
    const n = scaleNutrients(p.per100, it.grams);
    total = addNutrients(total, n);
    grams += it.grams;
    for (const k of p.unknown ?? []) unknownKcal[k] = (unknownKcal[k] ?? 0) + n.kcal;
    if (p.tolerance === 'bad') warnings.push(`${p.name}: oznaczony jako źle tolerowany.`);
    if (opts.dairyFree && p.dairy === 'contains') warnings.push(`${p.name}: zawiera mleko.`);
    else if (opts.dairyFree && p.dairy === 'unknown') warnings.push(`${p.name}: skład niepewny pod kątem mleka.`);
  }
  if (missing.length) warnings.push(`Brak ${missing.length} produktu(ów) w bazie: wartości niepełne.`);
  const s = Math.max(1, servings);
  const coverage = Object.fromEntries(MACROS.map((k) => [k, total.kcal > 0 ? Math.max(0, 1 - (unknownKcal[k] ?? 0) / total.kcal) : unknownKcal[k] ? 0 : 1])) as Record<MacroKey, number>;
  return { total, perServing: scaleNutrients(total, 100 / s), grams, unknownKcal, coverage, missing, warnings };
}

/** Zmiana liczby porcji: gramatury rosną proporcjonalnie (zaokrąglenie do 1 g). */
export function scaleRecipe<T extends { items: RecipeItem[]; servings: number }>(r: T, servings: number): T {
  const f = servings / Math.max(1, r.servings);
  return { ...r, servings, items: r.items.map((i) => ({ ...i, grams: Math.max(1, Math.round(i.grams * f)) })) };
}

export function copyRecipe(r: Recipe, id: string, t: number): Recipe {
  return { ...structuredClone(r), id, name: `${r.name} (kopia)`, createdAt: t, updatedAt: t, favorite: false };
}

/** Ile porcji przepisu zmieści się w zadanym budżecie kcal (np. obiad na dzień treningowy vs odpoczynek). */
export function portionsForKcal(totals: RecipeTotals, kcal: number): number {
  if (totals.perServing.kcal <= 0) return 1;
  return Math.max(0.25, Math.round((kcal / totals.perServing.kcal) * 4) / 4);
}

/**
 * Wpis do dziennika z przepisu: snapshot wartości w chwili wpisu (późniejsza edycja przepisu nie zmienia historii),
 * część kcal z nieznanym makro zapisana w unknownKcal.
 */
export function recipeEntry(r: Recipe, products: ProductMap, portions: number, date: string, meal: number, id: string, t: number): FoodEntry {
  const tot = recipeTotals(products, r.items, r.servings);
  const f = portions / Math.max(1, r.servings);
  const snap = scaleNutrients(tot.total, f * 100);
  const unknownKcal: Partial<Record<MacroKey, number>> = {};
  for (const k of MACROS) if (tot.unknownKcal[k]) unknownKcal[k] = tot.unknownKcal[k]! * f;
  // brak produktu w bazie: nie znamy niczego o tej części, więc cały wpis traktujemy jako niepełny
  const unknown = tot.missing.length ? [...MACROS] : undefined;
  return {
    id, createdAt: t, updatedAt: t, date, meal, productId: `recipe:${r.id}`, recipeId: r.id, portions,
    grams: Math.round(tot.grams * f), snapshot: { ...snap, name: `${r.name} (${portions} porc.)` },
    ...(Object.keys(unknownKcal).length ? { unknownKcal } : {}), ...(unknown ? { unknown } : {}), source: 'manual',
  };
}

/** Wpis z produktu z przeniesieniem informacji o nieznanym makro. */
export function productEntry(p: FoodProduct, grams: number, date: string, meal: number, id: string, t: number, source: FoodEntry['source'] = 'manual'): FoodEntry {
  return { id, createdAt: t, updatedAt: t, date, meal, productId: p.id, grams, snapshot: { ...scaleNutrients(p.per100, grams), name: p.name }, ...(p.unknown?.length ? { unknown: [...p.unknown] } : {}), source };
}

/** Szablony dni: zapisane w aplikacji nadpisują domyślne o tym samym id; własne warianty dochodzą na końcu. */
export function effectiveTemplates(defaults: DayTemplate[], user: DayTemplateRec[]): (DayTemplate & { edited: boolean; custom: boolean })[] {
  const byId = new Map(user.map((u) => [u.id, u]));
  const base = defaults.map((d) => {
    const u = byId.get(d.id);
    return u ? { id: d.id, name: u.name, meals: u.meals, edited: true, custom: false } : { ...d, name: d.name ?? `Dzień ${d.id}`, edited: false, custom: false };
  });
  const ids = new Set(defaults.map((d) => d.id));
  return [...base, ...user.filter((u) => !ids.has(u.id)).sort((a, b) => a.createdAt - b.createdAt).map((u) => ({ id: u.id, name: u.name, meals: u.meals, edited: true, custom: true }))];
}

/** Walidacja szablonu przed zapisem. */
export function validateTemplate(t: { name: string; meals: { name: string; items: RecipeItem[] }[] }, products: ProductMap): string[] {
  const e: string[] = [];
  if (!t.name.trim()) e.push('Podaj nazwę szablonu.');
  if (!t.meals.length) e.push('Szablon musi mieć co najmniej jeden posiłek.');
  if (t.meals.length > 5) e.push('Maksymalnie 5 posiłków.');
  t.meals.forEach((m, i) => {
    if (!m.items.length) e.push(`Posiłek ${i + 1} jest pusty.`);
    for (const it of m.items) {
      if (!products.has(it.productId)) e.push(`Posiłek ${i + 1}: produkt spoza bazy.`);
      if (!(it.grams > 0) || it.grams > 2000) e.push(`Posiłek ${i + 1}: gramatura musi być w zakresie 1–2000 g.`);
    }
  });
  return e;
}

/** Propozycje zamian dla źle tolerowanych / mlecznych składników (ta sama rola, bez nabiału). */
export function intoleranceSwaps(products: ProductMap, items: RecipeItem[], dairyFree: boolean) {
  const all = [...products.values()];
  return items.flatMap((it, index) => {
    const p = products.get(it.productId);
    if (!p || !(p.tolerance === 'bad' || (dairyFree && p.dairy === 'contains'))) return [];
    const alt = candidatesForSwap(all, p).filter((c) => c.dairy === 'none').slice(0, 3);
    return [{ index, product: p, alternatives: alt }];
  });
}

/** Lista zakupów z dowolnych zestawów pozycji (szablony dni, przepisy) z mnożnikami. */
export function shoppingFrom(products: ProductMap, groups: { items: RecipeItem[]; times: number }[]) {
  const acc = new Map<string, number>();
  for (const g of groups) if (g.times > 0) for (const i of g.items) acc.set(i.productId, (acc.get(i.productId) ?? 0) + i.grams * g.times);
  return [...acc.entries()].flatMap(([productId, grams]) => {
    const p = products.get(productId);
    return p ? [{ productId, name: p.name, grams: Math.round(grams), basis: p.basis }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

export const PORTION_LIMITS = [0.25, 20] as const;
/** Porcje wpisu przepisu: pole portions, a dla wpisów sprzed 0.6.1 liczba z nazwy „(x porc.)”. */
export function entryPortions(e: FoodEntry): number | undefined {
  if (!e.recipeId) return undefined;
  if (e.portions && e.portions > 0) return e.portions;
  const m = e.snapshot.name.match(/\(([\d.,]+) porc\.\)\s*$/);
  const v = m ? Number(m[1].replace(',', '.')) : NaN;
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * Zmiana porcji wpisu przepisu w dzienniku: proporcjonalnie z WŁASNEGO snapshotu wpisu
 * (nie z obecnej wersji przepisu, który mógł się zmienić). Inne wpisy i przepis bez zmian.
 */
export function rescaleRecipeEntry(e: FoodEntry, portions: number, t: number): FoodEntry {
  const old = entryPortions(e);
  if (old === undefined) throw new Error('To nie jest wpis przepisu z porcjami');
  if (!(portions >= PORTION_LIMITS[0] && portions <= PORTION_LIMITS[1])) throw new Error('Porcje poza zakresem 0,25–20');
  const f = portions / old;
  const sn = e.snapshot;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const scaled = { kcal: Math.round(sn.kcal * f), protein: r1(sn.protein * f), fat: r1(sn.fat * f), carbs: r1(sn.carbs * f), fiber: r1(sn.fiber * f),
    ...(sn.sugar !== undefined ? { sugar: r1(sn.sugar * f) } : {}), ...(sn.satFat !== undefined ? { satFat: r1(sn.satFat * f) } : {}), ...(sn.salt !== undefined ? { salt: r1(sn.salt * f) } : {}) };
  const base = sn.name.replace(/\s*\([\d.,]+ porc\.\)\s*$/, '');
  const unknownKcal = e.unknownKcal ? Object.fromEntries(Object.entries(e.unknownKcal).map(([k, v]) => [k, (v ?? 0) * f])) : undefined;
  return { ...e, portions, grams: Math.round(e.grams * f), snapshot: { ...sn, ...scaled, name: `${base} (${portions} porc.)` }, ...(unknownKcal ? { unknownKcal } : {}), updatedAt: t };
}

/**
 * Wersja przepisu dopasowana do profilu: składniki źle tolerowane i (przy diecie bez nabiału) mleczne
 * zamieniane na najlepszy zamiennik tej samej roli. Bez zamiennika przepis nie pasuje (ok = false).
 */
export function adaptForProfile(r: Recipe, products: ProductMap, dairyFree: boolean): { ok: boolean; recipe: Recipe; changes: string[] } {
  const swaps = intoleranceSwaps(products, r.items, dairyFree);
  if (!swaps.length) return { ok: true, recipe: r, changes: [] };
  const items = r.items.map((x) => ({ ...x }));
  const changes: string[] = [];
  for (const sw of swaps) {
    const alt = sw.alternatives[0];
    if (!alt) return { ok: false, recipe: r, changes: [`Brak zamiennika dla: ${sw.product.name}`] };
    items[sw.index] = { productId: alt.id, grams: swapProduct(sw.product, items[sw.index].grams, alt).grams };
    changes.push(`${sw.product.name} → ${alt.name}`);
  }
  return { ok: true, recipe: { ...r, items }, changes };
}
