import { describe, expect, it } from 'vitest';
import { dayTargets, ruleWarnings } from '../src/domain/targets';
import { offToProduct, parseServingGrams } from '../src/domain/off';
import { addNutrients, scaleNutrients } from '../src/domain/calc';
import { EXTRA_FOODS } from '../src/data/foodsExtra';
import { SEED_FOODS } from '../src/data/foods';
import type { PlanVersion } from '../src/domain/types';

const plan: PlanVersion = { id: 'p', createdAt: 0, updatedAt: 0, validFrom: '2026-11-22', kcal: 2450, proteinG: 165, fatG: 80, carbsG: 267, fiberG: [30, 35], mealsPerDay: 4, workoutsPer14d: 4, reason: '', approvedByUser: true };

describe('dni treningowe / nietreningowe', () => {
  it('bez cyklu: ten sam cel', () => expect(dayTargets(plan, true).kcal).toBe(2450));
  it('cykl zachowuje średnią tygodniową i stałe białko', () => {
    const p = { ...plan, cycling: { enabled: true, trainingExtraKcal: 200 } };
    const tr = dayTargets(p, true), rest = dayTargets(p, false);
    expect(tr.kcal).toBe(2650); expect(rest.kcal).toBe(2370);
    expect((tr.kcal * 2 + rest.kcal * 5) / 7).toBeCloseTo(2450, -1);
    expect(tr.proteinG).toBe(165); expect(rest.proteinG).toBe(165);
    expect(tr.carbsG - rest.carbsG).toBe(70);
  });
  it('insulinooporność domyślnie: tylko ostrzeżenia, plan bez zmian', () => {
    const p = { ...plan, rules: { insulinResistance: { enabled: true, carbMaxPct: 40, sugarMaxPct: 10, fiberMin: 32, carbsPerMealMaxG: 80 } } };
    const t = dayTargets(p, false);
    expect(t.carbsG).toBe(267); expect(t.fatG).toBe(80); expect(t.carbMaxG).toBe(245);
    expect(t.notes.join(' ')).toContain('Plan bez zmian');
  });
  it('insulinooporność z opcją indywidualną: nadwyżka do tłuszczu, białko bez zmian', () => {
    const p = { ...plan, cycling: { enabled: true, trainingExtraKcal: 200 }, rules: { insulinResistance: { enabled: true, carbMaxPct: 40, sugarMaxPct: 10, fiberMin: 32, carbsPerMealMaxG: 80, shiftExcessToFat: true } } };
    const t = dayTargets(p, true);
    expect(t.carbsG * 4).toBeLessThanOrEqual(t.kcal * 0.4);
    expect(t.proteinG).toBe(165); expect(t.fiberG).toBe(32); expect(t.sugarMaxG).toBe(66);
    expect(Math.abs(t.proteinG * 4 + t.fatG * 9 + t.carbsG * 4 - t.kcal)).toBeLessThan(10);
  });
  it('ostrzeżenia: cukry i węgle na posiłek', () => {
    const t = dayTargets({ ...plan, rules: { insulinResistance: { enabled: true, carbMaxPct: 45, sugarMaxPct: 10, fiberMin: 30, carbsPerMealMaxG: 80 } } }, false);
    const w = ruleWarnings(t, { kcal: 2400, protein: 160, fat: 80, carbs: 260, fiber: 30, sugar: 90 }, [100, 50, 50, 60]);
    expect(w).toHaveLength(2);
  });
});

describe('Open Food Facts', () => {
  const sample = { code: '590123', product_name_pl: 'Jogurt naturalny', brands: 'Mleczarnia X, Y', serving_size: '150 g', allergens_tags: ['en:milk'],
    nutriments: { 'energy-kcal_100g': 61, proteins_100g: 4.3, fat_100g: 3, carbohydrates_100g: 4.6, sugars_100g: 4.6, 'saturated-fat_100g': 2, salt_100g: 0.13 } };
  it('mapuje etykietę, mleko i porcję', () => {
    const p = offToProduct(sample)!;
    expect(p).toMatchObject({ id: 'off_590123', name: 'Jogurt naturalny (Mleczarnia X)', dairy: 'contains', reliability: 'label', unit: { grams: 150 } });
    expect(p.per100).toMatchObject({ kcal: 61, sugar: 4.6, satFat: 2, salt: 0.1, fiber: 0 });
  });
  it('brak makro → odrzucony (nie zgadujemy)', () => expect(offToProduct({ product_name: 'X', nutriments: { 'energy-kcal_100g': 100 } })).toBeNull());
  it('kJ → kcal', () => expect(offToProduct({ product_name: 'X', nutriments: { energy_100g: 418.4, proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 1 } })!.per100.kcal).toBe(100));
  it('mleko ze składu, gdy brak alergenów', () => expect(offToProduct({ product_name: 'Baton', ingredients_text_pl: 'cukier, serwatka w proszku', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 5, fat_100g: 20, carbohydrates_100g: 50 } })!.dairy).toBe('contains'));
  it('porcja w ml/g', () => { expect(parseServingGrams('250 ml')).toBe(250); expect(parseServingGrams('1 szt. (30,5 g)')).toBe(31); });
});

describe('składniki opcjonalne', () => {
  it('cukry sumują się tylko ze znanych wartości', () => {
    const a = scaleNutrients({ kcal: 100, protein: 1, fat: 1, carbs: 10, fiber: 0, sugar: 10 }, 50);
    const b = scaleNutrients({ kcal: 100, protein: 1, fat: 1, carbs: 10, fiber: 0 }, 100);
    expect(addNutrients(a, b).sugar).toBe(5);
    expect(addNutrients(b, b).sugar).toBeUndefined();
  });
});

describe('baza produktów', () => {
  const all = [...SEED_FOODS, ...EXTRA_FOODS];
  it('ponad 250 produktów, unikalne id', () => { expect(all.length).toBeGreaterThan(250); expect(new Set(all.map((f) => f.id)).size).toBe(all.length); });
  it('kcal spójne z makro (±25%, poza alkoholem i polialkoholami)', () => {
    const bad = all.filter((f) => !['x_beer', 'x_wine', 'x_erythritol', 'x_beer_0', 'x_coffee_black', 'x_cola_zero'].includes(f.id)).filter((f) => {
      const calc = f.per100.protein * 4 + f.per100.fat * 9 + f.per100.carbs * 4 + f.per100.fiber * 2;
      return Math.abs(calc - f.per100.kcal) > Math.max(15, f.per100.kcal * 0.25);
    }).map((f) => f.id);
    expect(bad).toEqual([]);
  });
});

