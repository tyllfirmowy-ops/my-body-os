import { describe, expect, it } from 'vitest';
import { defaultMeal } from '../src/domain/mealSlot';

describe('domyślny posiłek', () => {
  it('pora dnia przy 4 posiłkach', () => {
    expect(defaultMeal({ hour: 5 }, 4)).toBe(1);
    expect(defaultMeal({ hour: 8 }, 4)).toBe(1);
    expect(defaultMeal({ hour: 12 }, 4)).toBe(2);
    expect(defaultMeal({ hour: 15, minute: 30 }, 4)).toBe(3);
    expect(defaultMeal({ hour: 19 }, 4)).toBe(4);
    expect(defaultMeal({ hour: 23 }, 4)).toBe(4);
  });
  it('3 posiłki i nietypowe wartości planu', () => {
    expect(defaultMeal({ hour: 12 }, 3)).toBe(2);
    expect(defaultMeal({ hour: 20 }, 3)).toBe(3);
    expect(defaultMeal({ hour: 20 }, 7)).toBe(4); // więcej niż 4 posiłki główne w dzienniku nie ma
  });
  it('dokładanie do ostatniego posiłku w ciągu 90 min, potem pora dnia', () => {
    const now = 1_000_000_000;
    expect(defaultMeal({ hour: 12 }, 4, { meal: 1, createdAt: now - 30 * 60e3 }, now)).toBe(1);
    expect(defaultMeal({ hour: 12 }, 4, { meal: 5, createdAt: now - 10 * 60e3 }, now)).toBe(5);
    expect(defaultMeal({ hour: 12 }, 4, { meal: 1, createdAt: now - 120 * 60e3 }, now)).toBe(2);
  });
});
