import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BodyDB } from '../src/db/db';
import { remainingFor, suggestMeals, entriesFor, nextMealNumber, type SuggestInput } from '../src/domain/mealSuggest';
import { sumDay } from '../src/domain/intake';
import { recipeTotals } from '../src/domain/recipes';
import { usageFrom } from '../src/domain/foodSearch';
import type { DayTargets } from '../src/domain/targets';
import type { FoodEntry, FoodProduct, Recipe } from '../src/domain/types';

const P = (id: string, per100: [number, number, number, number, number], x: Partial<FoodProduct> = {}): FoodProduct =>
  ({ id, name: id, per100: { kcal: per100[0], protein: per100[1], fat: per100[2], carbs: per100[3], fiber: per100[4] }, basis: 'raw', dairy: 'none', tolerance: 'unknown', source: 't', reliability: 'reference', updatedAt: 0, ...x });
const list = [
  P('chicken', [110, 23, 1.5, 0, 0]), P('rice', [350, 7, 1, 78, 1]), P('oil', [900, 0, 100, 0, 0]), P('broccoli', [35, 3, 0.4, 7, 3]),
  P('oats', [380, 13, 7, 60, 10]), P('skyr', [63, 11, 0.2, 4, 0], { dairy: 'contains', favorite: true }), P('tofu', [140, 15, 8, 2, 1], { favorite: true }),
  P('cake', [420, 5, 22, 50, 1], { tolerance: 'bad' }), P('bar', [380, 30, 12, 35, 0], { unknown: ['fiber'], favorite: true }), P('mystery', [250, 0, 0, 0, 0], { unknown: ['protein', 'fat', 'carbs', 'fiber'] }),
];
const products = new Map(list.map((p) => [p.id, p]));
const t: DayTargets = { kcal: 2400, proteinG: 180, fatG: 70, carbsG: 260, fiberG: 30, sugarMaxG: null, carbsPerMealMaxG: null, carbMaxG: null, dayType: 'training', notes: [] };
const R = (id: string, name: string, items: [string, number][], servings = 2): Recipe => ({ id, name, servings, createdAt: 0, updatedAt: 0, items: items.map(([productId, grams]) => ({ productId, grams })) });
const recipes = [
  R('r1', 'Kurczak z ryżem', [['chicken', 500], ['rice', 200], ['oil', 10], ['broccoli', 200]]),
  R('r2', 'Owsianka', [['oats', 160]]),
  R('r3', 'Ciasto', [['cake', 300]], 3),
  R('r4', 'Tajemnica', [['mystery', 400]], 2),
];
const entry = (id: string, productId: string, grams: number, meal: number): FoodEntry => {
  const p = products.get(productId)!;
  return { id, createdAt: 1, updatedAt: 1, date: '2026-11-22', meal, productId, grams, snapshot: { name: p.name, kcal: p.per100.kcal * grams / 100, protein: p.per100.protein * grams / 100, fat: p.per100.fat * grams / 100, carbs: p.per100.carbs * grams / 100, fiber: p.per100.fiber * grams / 100 }, ...(p.unknown ? { unknown: p.unknown } : {}) };
};
const input = (entries: FoodEntry[], over: Partial<SuggestInput> = {}): SuggestInput => ({
  products, recipes, templates: [], favorites: list.filter((p) => p.favorite), usage: usageFrom(entries), t,
  rem: remainingFor(t, sumDay(entries), 4), todayProductIds: new Set(entries.map((e) => e.productId)), dairyFree: false, ...over,
});

describe('W1 pozostały bilans', () => {
  it('odejmuje zjedzone od celu dnia i dzieli na pozostałe posiłki', () => {
    const eaten = [entry('a', 'oats', 100, 1)];
    const r = remainingFor(t, sumDay(eaten), 4);
    expect(r.kcal).toBeCloseTo(2400 - 380);
    expect(r.protein).toBeCloseTo(180 - 13);
    expect(r.mealsLeft).toBe(3);
    expect(r.mealKcal).toBeCloseTo((2400 - 380) / 3);
    expect(r.state).toBe('ok');
  });
  it('brak wpisów: wyraźna informacja, nie zgadywanie', () => {
    const r = remainingFor(t, undefined, 4);
    expect(r.kcal).toBe(2400);
    expect(r.notes[0]).toMatch(/Brak wpisów/);
  });
  it('niepełne dane z dzisiaj: makro oznaczone jako niepewne', () => {
    const r = remainingFor(t, sumDay([entry('m', 'mystery', 400, 1)]), 4);
    expect(r.uncertain).toEqual(['protein', 'fat', 'carbs', 'fiber']);
    expect(r.notes.join()).toMatch(/częściowo/);
  });
  it('cel przekroczony lub prawie osiągnięty: brak propozycji, komunikat bez odrabiania', () => {
    const over = [entry('a', 'oil', 300, 1)];
    expect(remainingFor(t, sumDay(over), 4).state).toBe('over');
    expect(suggestMeals(input(over))).toEqual([]);
    expect(remainingFor({ ...t, kcal: 2780 }, sumDay(over), 4).state).toBe('almost_done');
  });
});

describe('W1 propozycje', () => {
  it('2–3 propozycje z porcją dopasowaną do budżetu posiłku i kcal/B/T/W liczonymi jak w przepisie', () => {
    const s = suggestMeals(input([entry('a', 'oats', 100, 1)]));
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s.length).toBeLessThanOrEqual(3);
    const rec = s.find((x) => x.source.kind === 'recipe' && x.source.recipe.id === 'r1')!;
    expect(rec).toBeDefined();
    const portions = (rec.source as { portions: number }).portions;
    const per = recipeTotals(products, recipes[0].items, 2).perServing;
    expect(rec.nutrients.kcal).toBeCloseTo(per.kcal * portions, 0);
    expect(rec.nutrients.protein).toBeCloseTo(per.protein * portions, 0);
    expect(Math.abs(rec.nutrients.kcal - (2400 - 380) / 3)).toBeLessThan(per.kcal * 0.25); // krok 0,25 porcji
    expect(rec.reasons.join(' ')).toMatch(/białko/i);
  });
  it('preferuje białko: przy dużym braku białka przepis z kurczakiem przed owsianką', () => {
    const s = suggestMeals(input([entry('a', 'oats', 100, 1)]));
    const ids = s.map((x) => x.id);
    expect(ids.indexOf('r:r1')).toBeLessThan(ids.indexOf('r:r2') === -1 ? 99 : ids.indexOf('r:r2'));
  });
  it('pomija produkty źle tolerowane i nabiał przy diecie bez nabiału', () => {
    const s = suggestMeals(input([entry('a', 'oil', 150, 1), entry('b', 'oats', 200, 2), entry('c', 'chicken', 300, 3)], { dairyFree: true }));
    expect(s.some((x) => x.id === 'r:r3')).toBe(false);
    expect(s.some((x) => x.id === 'p:skyr')).toBe(false);
  });
  it('niepełne dane: ostrzeżenie, zerowe pokrycie i niższa pozycja zamiast fałszywej dokładności', () => {
    const all = suggestMeals(input([]), 10);
    expect(all.findIndex((x) => x.id === 'r:r4')).toBe(all.length - 1); // kompletne przepisy wyżej
    const only = suggestMeals(input([], { recipes: [recipes[3], recipes[1]] }), 10);
    const mystery = only.find((x) => x.id === 'r:r4')!;
    expect(mystery.warnings.join()).toMatch(/Niepełne dane: białko, tłuszcz, węglowodany, błonnik/);
    expect(mystery.coverage.protein).toBe(0);
    expect(only.indexOf(mystery)).toBe(only.length - 1);
  });
  it('przy małym budżecie proponuje też ulubione produkty z gramaturą', () => {
    const eaten = [entry('a', 'rice', 300, 1), entry('b', 'chicken', 500, 2), entry('c', 'oil', 40, 3)];
    const s = suggestMeals(input(eaten));
    const rem = remainingFor(t, sumDay(eaten), 4);
    expect(rem.mealKcal).toBeLessThanOrEqual(450);
    const prod = s.find((x) => x.source.kind === 'product');
    expect(prod).toBeDefined();
    expect(prod!.nutrients.kcal).toBeLessThanOrEqual(rem.kcal * 1.05 + 1);
  });
  it('różnorodność: maks. 2 z jednego źródła, gdy są inne; bez innych źródeł pełne 3', () => {
    const tpl = { id: 'A', name: 'A', meals: [1, 2, 3, 4].map((k) => ({ name: 'M' + k, items: [{ productId: 'chicken', grams: 150 + k * 20 }, { productId: 'rice', grams: 60 + k * 10 }] })) };
    const onlyTpl = suggestMeals(input([], { recipes: [], favorites: [], templates: [tpl] }));
    expect(onlyTpl).toHaveLength(3);
    const mixed = suggestMeals(input([], { templates: [tpl] }));
    expect(mixed.filter((x) => x.source.kind === 'template').length).toBeLessThanOrEqual(2);
  });
  it('posiłek z szablonu: gramatury przeskalowane, bez duplikatów identycznych posiłków', () => {
    const tpl = { id: 'A', name: 'Dzień A', meals: [{ name: 'Obiad', items: [{ productId: 'chicken', grams: 200 }, { productId: 'rice', grams: 80 }] }, { name: 'Obiad', items: [{ productId: 'chicken', grams: 200 }, { productId: 'rice', grams: 80 }] }] };
    const s = suggestMeals(input([], { recipes: [], templates: [tpl, { ...tpl, id: 'B' }] }), 5);
    expect(s.filter((x) => x.source.kind === 'template')).toHaveLength(1);
    const tp = s.find((x) => x.source.kind === 'template')!;
    const items = (tp.source as { items: { grams: number }[] }).items;
    const f = items[0].grams / 200;
    expect(tp.nutrients.kcal).toBeCloseTo(110 * 2 * f + 350 * 0.8 * f, -1);
  });
});

describe('W1 dodanie do dziennika', () => {
  it('wpisy przez istniejące funkcje (snapshot), numer następnego posiłku, historia innych wpisów bez zmian', async () => {
    const db = new BodyDB('w1-' + Math.random());
    const before = [entry('a', 'oats', 100, 1), entry('b', 'tofu', 150, 2)];
    await db.entries.bulkPut(before);
    const s = suggestMeals(input(before))[0];
    let n = 0;
    const meal = nextMealNumber(before, 4);
    expect(meal).toBe(3);
    const rows = entriesFor(s, products, '2026-11-22', meal, () => `new${n++}`, 5);
    await db.entries.bulkAdd(rows);
    const day = sumDay(await db.entries.where('date').equals('2026-11-22').toArray())!;
    expect(day.kcal).toBeCloseTo(sumDay(before)!.kcal + s.nutrients.kcal, 0);
    expect(await db.entries.get('a')).toEqual(before[0]);
    expect(rows.every((r) => r.meal === 3)).toBe(true);
    expect(nextMealNumber([...before, ...rows], 4)).toBe(4);
    expect(nextMealNumber([1, 2, 3, 4].map((m) => entry('x' + m, 'oats', 10, m)), 4)).toBe(4);
  });
  it('przepis dodany z propozycji zapisuje porcje i nieznane makro (model kompletności)', () => {
    const r = R('rb', 'Baton z ryżem', [['bar', 100], ['rice', 100]], 1);
    const s = suggestMeals(input([], { recipes: [r], favorites: [] }), 5).find((x) => x.id === 'r:rb')!;
    const [e] = entriesFor(s, products, 'd', 1, () => 'e', 1);
    expect(e.recipeId).toBe('rb');
    expect(e.portions).toBe((s.source as { portions: number }).portions);
    expect(e.unknownKcal?.fiber).toBeGreaterThan(0);
  });
});
