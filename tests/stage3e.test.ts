import { describe, expect, it } from 'vitest';
import { rankLocal, matchScore, dedupeOnline, usageFrom } from '../src/domain/foodSearch';
import { cacheGet, cacheSet, MAX_ENTRIES, TTL, searchKey, type KV } from '../src/domain/offCache';
import { offToProduct, validateNutrients } from '../src/domain/off';
import { SEED_FOODS } from '../src/data/foods';
import { EXTRA_FOODS } from '../src/data/foodsExtra';
import type { FoodEntry, FoodProduct } from '../src/domain/types';

const ALL = [...SEED_FOODS, ...EXTRA_FOODS];
const mem = (): KV & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; };
const entry = (productId: string, createdAt: number): FoodEntry => ({ id: String(createdAt), createdAt, updatedAt: 0, date: '2026-11-01', meal: 1, productId, grams: 100, snapshot: { name: '', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } });

describe('3E wyszukiwanie lokalne', () => {
  it('„ryż” daje najpierw ryż, nie białko z ryżu', () => {
    expect(rankLocal(ALL, 'ryż', new Map())[0].name).toMatch(/^Ryż/);
  });
  it('„kurczak” daje produkt podstawowy przed daniem panierowanym', () => {
    const r = rankLocal(ALL, 'kurczak', new Map()).map((f) => f.name);
    const plain = r.findIndex((n) => /Pierś z kurczaka/.test(n));
    const breaded = r.findIndex((n) => /panierowan/i.test(n));
    expect(plain).toBeGreaterThanOrEqual(0);
    if (breaded >= 0) expect(plain).toBeLessThan(breaded);
  });
  it('dla jednego składnika produkt podstawowy przed daniem szacunkowym; pełna nazwa dania nadal je znajduje', () => {
    expect(rankLocal(ALL, 'kurczak', new Map())[0].reliability).not.toBe('estimate');
    expect(rankLocal(ALL, 'kurczak z ryżem', new Map())[0].name).toMatch(/Kurczak.*ryżem/);
  });
  it('polskie znaki i wielkość liter nie mają znaczenia', () => {
    expect(matchScore('Ryż biały, suchy', 'RYZ')).not.toBeNull();
    expect(matchScore('Pierś z kurczaka', 'piers kurczak')).not.toBeNull();
    expect(matchScore('Jabłko', 'banan')).toBeNull();
  });
  it('ulubione i często używane wyżej; bez zapytania ulubione i ostatnie na górze', () => {
    const fav = { ...ALL.find((f) => f.name.startsWith('Ryż basmati'))!, favorite: true };
    const foods = ALL.map((f) => (f.id === fav.id ? fav : f));
    expect(rankLocal(foods, 'ryż', new Map())[0].id).toBe(fav.id);
    const used = ALL.find((f) => f.name.startsWith('Ryż brązowy'))!;
    const usage = usageFrom([1, 2, 3, 4, 5].map((i) => entry(used.id, i)));
    expect(rankLocal(ALL, 'ryż', usage)[0].id).toBe(used.id);
    const empty = rankLocal(foods, '', usage).map((f) => f.id);
    expect(empty.slice(0, 2).sort()).toEqual([fav.id, used.id].sort());
  });
  it('szybkość: 1000 wyszukiwań w bazie ~280 produktów poniżej 1,5 s', () => {
    const t = performance.now();
    for (let i = 0; i < 1000; i++) rankLocal(ALL, ['kur', 'ryż', 'jogurt', 'chleb żytni'][i % 4], new Map());
    expect(performance.now() - t).toBeLessThan(1500);
  });
});

describe('3E Open Food Facts', () => {
  const off = (code: string, name: string, extra: Record<string, number> = {}) => offToProduct({ code, product_name: name, ingredients_text_pl: 'woda', nutriments: { 'energy-kcal_100g': 100, proteins_100g: 10, fat_100g: 2, carbohydrates_100g: 10, fiber_100g: 1, ...extra } })!;
  it('deduplikacja: pomija produkty z bazy i powtórzenia kodu/nazwy', () => {
    const local = [{ ...off('111', 'A'), id: 'off_111' }] as FoodProduct[];
    const online = [off('111', 'A'), off('222', 'B'), off('222', 'B kopia'), off('333', 'C'), { ...off('444', 'C'), barcode: undefined, id: 'off_x' }];
    expect(dedupeOnline(local, online).map((p) => p.barcode)).toEqual(['222', '333']);
  });
  it('brak błonnika = nieznany błonnik (nie 0), produkt zostaje', () => {
    const p = offToProduct({ code: '5', product_name: 'Baton', ingredients_text_pl: 'x', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 20, fat_100g: 15, carbohydrates_100g: 45 } })!;
    expect(p.unknown).toEqual(['fiber']);
    expect(p.role).toBe('carb');
  });
  it('walidacja: dane niemożliwe odrzucone, podejrzane z ostrzeżeniem, brak składu ostrzeżony', () => {
    expect(off('1', 'X', { proteins_100g: 120 })).toBeNull();
    expect(off('1', 'X', { 'energy-kcal_100g': 2000 })).toBeNull();
    expect(off('1', 'X', { 'energy-kcal_100g': 300 }).labelWarnings?.[0]).toMatch(/nie zgadzają/);
    expect(off('1', 'X', { sugars_100g: 20 }).labelWarnings?.join()).toMatch(/cukry/);
    expect(offToProduct({ code: '9', product_name: 'Y', nutriments: { 'energy-kcal_100g': 100, proteins_100g: 10, fat_100g: 2, carbohydrates_100g: 10 } })!.labelWarnings?.join()).toMatch(/brak składu/);
    expect(validateNutrients({ kcal: 100, protein: 10, fat: 2, carbs: 10, fiber: 1 }).errors).toEqual([]);
  });
});

describe('3E cache zapytań', () => {
  it('zwraca wynik w terminie, po terminie usuwa', () => {
    const kv = mem();
    cacheSet(kv, searchKey('Ryż  Basmati '), [1, 2], TTL.search, 0);
    expect(cacheGet(kv, searchKey('ryż basmati'), TTL.search - 1)).toEqual([1, 2]);
    expect(cacheGet(kv, searchKey('ryż basmati'), TTL.search + 1)).toBeUndefined();
  });
  it('limit wpisów: najstarsze wypadają', () => {
    const kv = mem();
    for (let i = 0; i < MAX_ENTRIES + 5; i++) cacheSet(kv, 'k' + i, i, TTL.search, i);
    expect(cacheGet(kv, 'k0', 100)).toBeUndefined();
    expect(cacheGet(kv, 'k' + (MAX_ENTRIES + 4), 100)).toBe(MAX_ENTRIES + 4);
    expect([...kv.m.keys()].filter((k) => k.startsWith('off-cache:')).length).toBe(MAX_ENTRIES);
  });
  it('uszkodzony wpis nie wywraca aplikacji', () => {
    const kv = mem(); kv.setItem('off-cache:x', '{zepsute');
    expect(cacheGet(kv, 'x', 0)).toBeUndefined();
  });
});
