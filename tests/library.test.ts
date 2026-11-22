import { describe, expect, it } from 'vitest';
import { RECIPE_LIBRARY, slotForHour } from '../src/data/recipeLibrary';
import { SEED_FOODS } from '../src/data/foods';
import { EXTRA_FOODS } from '../src/data/foodsExtra';
import { adaptForProfile, recipeTotals } from '../src/domain/recipes';
import { remainingFor, suggestMeals, type SuggestInput } from '../src/domain/mealSuggest';
import { usageFrom } from '../src/domain/foodSearch';
import type { DayTargets } from '../src/domain/targets';
import type { FoodEntry } from '../src/domain/types';

const products = new Map([...SEED_FOODS, ...EXTRA_FOODS].map((p) => [p.id, p]));
const t: DayTargets = { kcal: 2400, proteinG: 180, fatG: 70, carbsG: 260, fiberG: 30, sugarMaxG: null, carbsPerMealMaxG: null, carbMaxG: null, dayType: 'rest', notes: [] };
const input = (over: Partial<SuggestInput> = {}): SuggestInput => ({ products, recipes: [], templates: [], favorites: [], usage: new Map(), t, rem: remainingFor(t, undefined, 4), todayProductIds: new Set(), dairyFree: false, library: RECIPE_LIBRARY, ...over });

describe('Biblioteka przepisów', () => {
  it('każdy składnik jest w bazie, żaden nie jest szacunkiem, id unikalne, kroki opisane', () => {
    expect(new Set(RECIPE_LIBRARY.map((r) => r.id)).size).toBe(RECIPE_LIBRARY.length);
    for (const r of RECIPE_LIBRARY) {
      expect(r.steps?.length, r.id).toBeGreaterThan(0);
      for (const it of r.items) {
        const p = products.get(it.productId);
        expect(p, `${r.id}: ${it.productId}`).toBeDefined();
        expect(p!.reliability, `${r.id}: ${it.productId}`).not.toBe('estimate');
      }
    }
  });
  it('porcje mają sensowną kaloryczność i białko (posiłek 300–800 kcal, przekąska 150–400)', () => {
    for (const r of RECIPE_LIBRARY) {
      const per = recipeTotals(products, r.items, r.servings).perServing;
      const [lo, hi] = r.meal === 'snack' ? [150, 400] : [300, 800];
      expect(per.kcal, `${r.name}: ${Math.round(per.kcal)} kcal`).toBeGreaterThanOrEqual(lo);
      expect(per.kcal, `${r.name}: ${Math.round(per.kcal)} kcal`).toBeLessThanOrEqual(hi);
      if (r.meal !== 'snack') expect(per.protein, `${r.name}: białko`).toBeGreaterThanOrEqual(18);
    }
  });
  it('każda pora dnia ma co najmniej 3 przepisy', () => {
    for (const m of ['breakfast', 'lunch', 'dinner', 'snack'] as const) expect(RECIPE_LIBRARY.filter((r) => r.meal === m).length).toBeGreaterThanOrEqual(3);
  });
  it('pora z godziny', () => {
    expect([7, 12, 18, 22].map(slotForHour)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
  });
});

describe('Dopasowanie do profilu', () => {
  const skyr = RECIPE_LIBRARY.find((r) => r.id === 'lib_skyr_bowl')!;
  it('dieta bez nabiału: skyr zamieniony na zamiennik bez mleka, kcal w podobnym zakresie', () => {
    const a = adaptForProfile(skyr, products, true);
    expect(a.ok).toBe(true);
    expect(a.changes[0]).toMatch(/Skyr/);
    expect(a.recipe.items.every((i) => products.get(i.productId)!.dairy !== 'contains')).toBe(true);
    const k0 = recipeTotals(products, skyr.items, 1).total.kcal, k1 = recipeTotals(products, a.recipe.items, 1).total.kcal;
    expect(Math.abs(k1 - k0) / k0).toBeLessThan(0.5);
  });
  it('bez ograniczeń przepis bez zmian; źle tolerowany składnik zamieniany', () => {
    expect(adaptForProfile(skyr, products, false).changes).toEqual([]);
    const bad = new Map(products); bad.set('tuna', { ...products.get('tuna')!, tolerance: 'bad' });
    const a = adaptForProfile(RECIPE_LIBRARY.find((r) => r.id === 'lib_tuna_salad')!, bad, false);
    expect(a.recipe.items.some((i) => i.productId === 'tuna')).toBe(false);
  });
  it('propozycje przy diecie bez nabiału nie zawierają nabiału', () => {
    const s = suggestMeals(input({ dairyFree: true, slot: 'breakfast' }), 3);
    for (const x of s) if (x.source.kind === 'recipe') expect(x.source.recipe.items.every((i) => products.get(i.productId)!.dairy !== 'contains')).toBe(true);
  });
});

describe('Propozycje z biblioteki i uczenie się', () => {
  it('bez własnych przepisów propozycje pochodzą z biblioteki; pora dnia ma znaczenie', () => {
    const morning = suggestMeals(input({ slot: 'breakfast', rem: remainingFor(t, undefined, 4) }));
    expect(morning.length).toBeGreaterThanOrEqual(2);
    expect(morning.every((x) => x.id.startsWith('r:lib_'))).toBe(true);
    expect(morning.filter((x) => x.source.kind === 'recipe' && x.source.recipe.meal === 'breakfast').length).toBeGreaterThanOrEqual(1);
    const lunch = suggestMeals(input({ slot: 'lunch' }));
    expect(lunch[0].source.kind === 'recipe' && lunch[0].source.recipe.meal).toBe('lunch');
  });
  it('„Nie proponuj” usuwa propozycję', () => {
    const first = suggestMeals(input({ slot: 'lunch' }))[0];
    const next = suggestMeals(input({ slot: 'lunch', hidden: [first.id] }));
    expect(next.some((x) => x.id === first.id)).toBe(false);
  });
  it('często wybierany przepis awansuje (uczenie z wpisów)', () => {
    const base = suggestMeals(input({ slot: 'lunch' }), 10);
    const lowest = base[base.length - 1];
    const libId = lowest.id.slice(2);
    const entries = Array.from({ length: 5 }, (_, k) => ({ id: 'e' + k, createdAt: k, updatedAt: k, date: '2026-11-1' + k, meal: 2, productId: `recipe:${libId}`, grams: 400, snapshot: { name: '', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } }) as FoodEntry);
    const learned = suggestMeals(input({ slot: 'lunch', usage: usageFrom(entries) }), 10);
    expect(learned.findIndex((x) => x.id === lowest.id)).toBeLessThan(base.findIndex((x) => x.id === lowest.id));
  });
  it('przepis skopiowany do „moich” nie dubluje się z biblioteką', () => {
    const lib = RECIPE_LIBRARY.find((r) => r.id === 'lib_chicken_rice')!;
    const mine = { ...lib, id: 'u1', libraryId: lib.id };
    const s = suggestMeals(input({ slot: 'lunch', recipes: [mine] }), 10);
    expect(s.some((x) => x.id === 'r:lib_chicken_rice')).toBe(false);
  });
});
