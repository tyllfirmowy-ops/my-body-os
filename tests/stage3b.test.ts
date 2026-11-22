import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { BodyDB, CURRENT_SCHEMA } from '../src/db/db';
import { exportAll, importAll } from '../src/db/backup';
import { recipeTotals, scaleRecipe, copyRecipe, recipeEntry, productEntry, portionsForKcal, effectiveTemplates, validateTemplate, intoleranceSwaps, shoppingFrom } from '../src/domain/recipes';
import { sumDay, reliableMacro } from '../src/domain/intake';
import { fitDayToTargets } from '../src/domain/nutrition';
import { DAY_TEMPLATES } from '../src/data/foods';
import type { FoodProduct, Recipe } from '../src/domain/types';

const P = (id: string, per100: [number, number, number, number, number], extra: Partial<FoodProduct> = {}): FoodProduct =>
  ({ id, name: id, per100: { kcal: per100[0], protein: per100[1], fat: per100[2], carbs: per100[3], fiber: per100[4] }, basis: 'raw', dairy: 'none', tolerance: 'unknown', source: 't', reliability: 'reference', updatedAt: 0, ...extra });
const products = new Map([
  P('chicken', [110, 23, 1.5, 0, 0], { role: 'protein' }),
  P('rice', [350, 7, 1, 78, 1], { role: 'carb' }),
  P('oil', [900, 0, 100, 0, 0], { role: 'fat' }),
  P('sauce', [120, 2, 5, 15, 0], { unknown: ['fiber'] }),
  P('milk', [60, 3, 3, 5, 0], { dairy: 'contains', role: 'protein' }),
  P('soy', [40, 3.5, 2, 1, 0.5], { role: 'protein' }),
  P('bad', [100, 20, 2, 0, 0], { tolerance: 'bad', role: 'protein' }),
].map((p) => [p.id, p]));
const recipe: Recipe = { id: 'r1', name: 'Kurczak z ryżem', servings: 2, createdAt: 0, updatedAt: 0, items: [{ productId: 'chicken', grams: 400 }, { productId: 'rice', grams: 150 }, { productId: 'oil', grams: 10 }] };

describe('3B przepisy', () => {
  it('sumuje kcal, B/T/W i błonnik oraz liczy porcję', () => {
    const t = recipeTotals(products, recipe.items, recipe.servings);
    expect(t.total.kcal).toBeCloseTo(440 + 525 + 90);
    expect(t.total.protein).toBeCloseTo(92 + 10.5);
    expect(t.total.fiber).toBeCloseTo(1.5);
    expect(t.perServing.kcal).toBeCloseTo(t.total.kcal / 2);
    expect(t.grams).toBe(560);
    expect(t.coverage.protein).toBe(1);
  });
  it('nieznane makro składnika nie jest zerem: coverage < 1 i unknownKcal', () => {
    const t = recipeTotals(products, [...recipe.items, { productId: 'sauce', grams: 100 }], 2);
    expect(t.unknownKcal.fiber).toBeCloseTo(120);
    expect(t.coverage.fiber).toBeLessThan(1);
    expect(t.coverage.protein).toBe(1);
  });
  it('zmiana porcji skaluje gramatury, wartość porcji bez zmian', () => {
    const s = scaleRecipe(recipe, 4);
    expect(s.items.map((i) => i.grams)).toEqual([800, 300, 20]);
    expect(recipeTotals(products, s.items, 4).perServing.kcal).toBeCloseTo(recipeTotals(products, recipe.items, 2).perServing.kcal);
  });
  it('kopia ma nowe id i nie dzieli tablicy składników z oryginałem', () => {
    const c = copyRecipe(recipe, 'r2', 5);
    c.items[0].grams = 1;
    expect(recipe.items[0].grams).toBe(400);
    expect(c.name).toContain('kopia');
  });
  it('porcje pod cel: dzień treningowy daje więcej porcji niż odpoczynek', () => {
    const t = recipeTotals(products, recipe.items, 2);
    expect(portionsForKcal(t, 800)).toBeGreaterThan(portionsForKcal(t, 500));
  });
  it('wpis z przepisu: snapshot, unknownKcal i historia niezmienna po edycji przepisu', () => {
    const r = { ...recipe, items: [...recipe.items, { productId: 'sauce', grams: 100 }] };
    const e = recipeEntry(r, products, 1, '2026-11-22', 2, 'e1', 1);
    const kcal = e.snapshot.kcal;
    expect(e.productId).toBe('recipe:r1');
    expect(e.unknownKcal?.fiber).toBeCloseTo(60);
    r.items[0].grams = 1000; // edycja przepisu po wpisie
    expect(e.snapshot.kcal).toBe(kcal);
    const day = sumDay([e])!;
    expect(day.coverage.fiber).toBeCloseTo(1 - 60 / kcal);
    expect(day.coverage.protein).toBe(1);
  });
  it('przepis z produktem spoza bazy: wpis oznaczony jako niepełny', () => {
    const e = recipeEntry({ ...recipe, items: [{ productId: 'ghost', grams: 100 }, ...recipe.items] }, products, 1, '2026-11-22', 1, 'e', 1);
    expect(e.unknown).toEqual(['protein', 'fat', 'carbs', 'fiber']);
    expect(reliableMacro(sumDay([e]), 'protein')).toBeUndefined();
  });
  it('wpis z produktu przenosi nieznane makro', () => {
    expect(productEntry(products.get('sauce')!, 50, 'd', 1, 'x', 0).unknown).toEqual(['fiber']);
    expect(productEntry(products.get('rice')!, 50, 'd', 1, 'x', 0).unknown).toBeUndefined();
  });
  it('ostrzeżenia i zamienniki: źle tolerowane, nabiał przy diecie bez nabiału', () => {
    const items = [{ productId: 'milk', grams: 200 }, { productId: 'bad', grams: 100 }, { productId: 'rice', grams: 50 }];
    expect(recipeTotals(products, items, 1, { dairyFree: true }).warnings.join(' ')).toMatch(/mleko.*źle tolerowany|źle tolerowany.*mleko/s);
    const sw = intoleranceSwaps(products, items, true);
    expect(sw.map((s) => s.product.id)).toEqual(['milk', 'bad']);
    expect(sw[0].alternatives.every((a) => a.dairy === 'none' && a.tolerance !== 'bad')).toBe(true);
  });
  it('lista zakupów sumuje przepisy i szablony z mnożnikami', () => {
    const list = shoppingFrom(products, [{ items: recipe.items, times: 2 }, { items: [{ productId: 'rice', grams: 50 }], times: 3 }, { items: [{ productId: 'oil', grams: 5 }], times: 0 }]);
    expect(list.find((x) => x.productId === 'rice')!.grams).toBe(450);
    expect(list.find((x) => x.productId === 'oil')!.grams).toBe(20);
  });
});

describe('3B szablony dni', () => {
  const user = [
    { id: 'B', name: 'Mój B', meals: [{ name: 'X', items: [{ productId: 'oats', grams: 50 }] }], createdAt: 1, updatedAt: 1 },
    { id: 'u1', name: 'Wariant', meals: [{ name: 'Y', items: [{ productId: 'oats', grams: 60 }] }], createdAt: 2, updatedAt: 2 },
  ];
  it('edytowany szablon nadpisuje domyślny, własny dochodzi, reszta domyślna', () => {
    const e = effectiveTemplates(DAY_TEMPLATES, user);
    expect(e.map((t) => t.id)).toEqual(['A', 'B', 'C', 'u1']);
    expect(e[1].name).toBe('Mój B');
    expect(e[0].edited).toBe(false);
    expect(e[3].custom).toBe(true);
  });
  it('walidacja: pusta nazwa, pusty posiłek, gramatura poza zakresem, produkt spoza bazy', () => {
    expect(validateTemplate({ name: '', meals: [{ name: 'a', items: [] }] }, products).length).toBe(2);
    expect(validateTemplate({ name: 'x', meals: [{ name: 'a', items: [{ productId: 'rice', grams: 0 }, { productId: 'zz', grams: 10 }] }] }, products).length).toBe(2);
    expect(validateTemplate({ name: 'x', meals: [{ name: 'a', items: [{ productId: 'rice', grams: 80 }] }] }, products)).toEqual([]);
  });
  it('szablon własny dopasowuje się inaczej do dnia treningowego i odpoczynku', () => {
    const tpl = { id: 'u', meals: [{ name: 'a', items: [{ productId: 'chicken', grams: 200 }, { productId: 'rice', grams: 100 }, { productId: 'oil', grams: 10 }] }] };
    const train = fitDayToTargets(products, tpl, { kcal: 1100, proteinG: 60, fatG: 20, carbsG: 150 });
    const rest = fitDayToTargets(products, tpl, { kcal: 900, proteinG: 60, fatG: 20, carbsG: 100 });
    const g = (r: typeof train) => r.day.meals[0].items.find((i) => i.productId === 'rice')!.grams;
    expect(g(train)).toBeGreaterThan(g(rest));
  });
});

describe('3B migracja i kopie', () => {
  it('Dexie v2 → v3: nowe tabele puste, stare dane bez zmian', async () => {
    const name = 'v2-' + Math.random();
    const v2 = new Dexie(name);
    const stores = { profile: 'id', health: 'id', plans: 'id, validFrom', morning: 'date', evening: 'date', measurements: 'id, date', foods: 'id, name, favorite', entries: 'id, date, productId', water: 'date', sessions: 'id, date, status', sets: 'id, sessionId, exerciseId, [sessionId+exerciseId]', custody: 'id', overrides: 'date', symptoms: 'id, date', labs: 'id, date', feedback: 'id, date', settings: 'id' };
    v2.version(1).stores(stores); v2.version(2).stores({});
    await v2.table('water').add({ date: '2026-11-01', ml: 2000, updatedAt: 0 });
    v2.close();
    const db = new BodyDB(name); await db.open();
    expect(db.verno).toBe(CURRENT_SCHEMA);
    expect(await db.recipes.count()).toBe(0);
    expect((await db.water.get('2026-11-01'))!.ml).toBe(2000);
    db.close();
  });
  it('kopia zawiera przepisy i szablony; kopia sprzed v3 ich nie kasuje', async () => {
    const a = new BodyDB('r-' + Math.random());
    await a.recipes.put(recipe);
    await a.mealTemplates.put({ id: 'A', name: 'Mój A', meals: [{ name: 'x', items: [{ productId: 'rice', grams: 50 }] }], createdAt: 0, updatedAt: 0 });
    const dump = await exportAll(a);
    const b = new BodyDB('r2-' + Math.random());
    expect((await importAll(JSON.parse(JSON.stringify(dump)), b)).ok).toBe(true);
    expect((await b.recipes.get('r1'))!.items).toHaveLength(3);
    const old = { format: 'my-body-os-backup', version: 1, exportedAt: 0, tables: { water: [] } };
    const r = await importAll(old, b);
    expect(r.ok && r.untouched).toContain('recipes');
    expect(await b.recipes.count()).toBe(1);
  });
});
