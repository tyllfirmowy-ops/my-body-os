import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BodyDB } from '../src/db/db';
import { exportAll, importAll } from '../src/db/backup';
import { backupReminder, classifyStorageError, clearStorageErrors, diagnose, logStorageError, readStorageErrors, LOG_MAX } from '../src/domain/storageDiag';
import { entryPortions, recipeEntry, rescaleRecipeEntry } from '../src/domain/recipes';
import { sumDay } from '../src/domain/intake';
import type { KV } from '../src/domain/offCache';
import type { FoodEntry, FoodProduct, Recipe } from '../src/domain/types';

const D = 864e5;
const mem = (): KV => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; };

describe('0.6.1 przypomnienie o kopii (co 7 dni od potwierdzenia)', () => {
  const c = Date.UTC(2026, 10, 1);
  it('przed upływem 7 dni od potwierdzenia: brak przypomnienia', () => {
    expect(backupReminder({ confirmedAt: c, now: c + 6.9 * D }).due).toBe(false);
  });
  it('po 7 dniach: jedno przypomnienie; „za tydzień” chowa je do następnego cyklu', () => {
    const r = backupReminder({ confirmedAt: c, now: c + 7 * D });
    expect(r.due).toBe(true);
    expect(backupReminder({ confirmedAt: c, now: c + 10 * D, dismissedKey: r.key }).due).toBe(false);
    expect(backupReminder({ confirmedAt: c, now: c + 14 * D, dismissedKey: r.key }).due).toBe(true);
  });
  it('nowe potwierdzenie zaczyna liczenie od nowa (odłożenie starego cyklu nie przeszkadza)', () => {
    const old = backupReminder({ confirmedAt: c, now: c + 7 * D }).key;
    expect(backupReminder({ confirmedAt: c + 8 * D, now: c + 9 * D, dismissedKey: old }).due).toBe(false);
    expect(backupReminder({ confirmedAt: c + 8 * D, now: c + 15 * D, dismissedKey: old }).due).toBe(true);
  });
  it('samo wygenerowanie pliku nie liczy się jako kopia (brak potwierdzenia = przypomnienie)', () => {
    const r = backupReminder({ now: c });
    expect(r.due).toBe(true);
    expect(backupReminder({ now: c + 3 * D, dismissedKey: r.key }).due).toBe(false);
    expect(backupReminder({ now: c + 7 * D, dismissedKey: r.key }).due).toBe(true);
  });
  it('ustawienie co ile dni jest respektowane', () => {
    expect(backupReminder({ confirmedAt: c, now: c + 3 * D, everyDays: 3 }).due).toBe(true);
  });
});

describe('0.6.1 diagnostyka pamięci', () => {
  it('klasyfikuje błędy bazy, ignoruje inne (np. przerwany fetch)', () => {
    expect(classifyStorageError({ name: 'QuotaExceededError' })).toEqual({ name: 'QuotaExceededError', quota: true });
    expect(classifyStorageError({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toEqual({ name: 'QuotaExceededError', quota: true });
    expect(classifyStorageError({ name: 'DatabaseClosedError' })?.quota).toBe(false);
    expect(classifyStorageError({ name: 'AbortError', message: 'The user aborted a request.' })).toBeNull();
    expect(classifyStorageError(new TypeError('x'))).toBeNull();
    expect(classifyStorageError(undefined)).toBeNull();
  });
  it('rejestr błędów: tylko nazwa i czas, limit wpisów, czyszczenie, odporność na śmieci', () => {
    const kv = mem();
    for (let i = 0; i < LOG_MAX + 5; i++) logStorageError(kv, { name: 'UnknownError', quota: false }, i);
    const log = readStorageErrors(kv);
    expect(log).toHaveLength(LOG_MAX);
    expect(log[0].t).toBe(LOG_MAX + 4);
    expect(Object.keys(log[0]).sort()).toEqual(['name', 'quota', 't']);
    clearStorageErrors(kv); expect(readStorageErrors(kv)).toEqual([]);
    kv.setItem('storage-errors', '{zepsute'); expect(readStorageErrors(kv)).toEqual([]);
  });
  it('ocena: brak IndexedDB, nieudany test zapisu, prawie pełny limit, brak miejsca w ostatnich 7 dniach', () => {
    const now = 100 * D;
    expect(diagnose({ supported: false, errors: [] }, now).level).toBe('danger');
    expect(diagnose({ supported: true, persisted: true, errors: [], writeTest: { ok: false, error: 'X' } }, now).level).toBe('danger');
    expect(diagnose({ supported: true, persisted: true, usage: 75, quota: 100, errors: [] }, now).level).toBe('warn');
    expect(diagnose({ supported: true, persisted: true, errors: [{ t: now - D, name: 'QuotaExceededError', quota: true }] }, now).level).toBe('danger');
    expect(diagnose({ supported: true, persisted: true, errors: [{ t: now - 30 * D, name: 'QuotaExceededError', quota: true }] }, now).level).toBe('ok');
    const ok = diagnose({ supported: true, persisted: true, usage: 1, quota: 100, errors: [], writeTest: { ok: true, ms: 3 } }, now);
    expect(ok.level).toBe('ok');
    expect(diagnose({ supported: true, errors: [] }, now).items[0].text).toMatch(/nie podaje/);
    expect(diagnose({ supported: true, persisted: false, standalone: false, errors: [] }, now).items[0].text).toMatch(/ekranu głównego/);
  });
});

describe('0.6.1 porcje przepisu w dzienniku', () => {
  const P = (id: string, per100: [number, number, number, number, number], unknown?: FoodProduct['unknown']): FoodProduct =>
    ({ id, name: id, per100: { kcal: per100[0], protein: per100[1], fat: per100[2], carbs: per100[3], fiber: per100[4] }, basis: 'raw', dairy: 'none', tolerance: 'unknown', source: 't', reliability: 'reference', updatedAt: 0, ...(unknown ? { unknown } : {}) });
  const products = new Map([P('chicken', [110, 23, 1.5, 0, 0]), P('rice', [350, 7, 1, 78, 1]), P('sauce', [120, 2, 5, 15, 0], ['fiber'])].map((p) => [p.id, p]));
  const recipe: Recipe = { id: 'r1', name: 'Kurczak z ryżem', servings: 2, createdAt: 0, updatedAt: 0, items: [{ productId: 'chicken', grams: 400 }, { productId: 'rice', grams: 150 }, { productId: 'sauce', grams: 100 }] };

  it('przeliczenie proporcjonalne: kcal, B/T/W, błonnik, gramy, nazwa', () => {
    const e = recipeEntry(recipe, products, 1, '2026-11-22', 2, 'e1', 1);
    expect(e.portions).toBe(1);
    const r = rescaleRecipeEntry(e, 1.5, 2);
    expect(r.snapshot.kcal).toBe(Math.round(e.snapshot.kcal * 1.5));
    expect(r.snapshot.protein).toBeCloseTo(e.snapshot.protein * 1.5, 0);
    expect(r.snapshot.carbs).toBeCloseTo(e.snapshot.carbs * 1.5, 0);
    expect(r.snapshot.fiber).toBeCloseTo(e.snapshot.fiber * 1.5, 0);
    expect(r.grams).toBe(Math.round(e.grams * 1.5));
    expect(r.snapshot.name).toBe('Kurczak z ryżem (1.5 porc.)');
    expect(r.id).toBe(e.id); expect(r.date).toBe(e.date); expect(r.meal).toBe(e.meal);
  });
  it('część z nieznanym makro skaluje się razem z porcją (pokrycie bez zmian)', () => {
    const e = recipeEntry(recipe, products, 1, 'd', 1, 'e', 1);
    const r = rescaleRecipeEntry(e, 2, 2);
    expect(r.unknownKcal?.fiber).toBeCloseTo(e.unknownKcal!.fiber! * 2);
    expect(sumDay([r])!.coverage.fiber).toBeCloseTo(sumDay([e])!.coverage.fiber, 2);
  });
  it('liczy z własnego snapshotu wpisu, nie z obecnej wersji przepisu', () => {
    const e = recipeEntry(recipe, products, 1, 'd', 1, 'e', 1);
    recipe.items[0].grams = 2000; // późniejsza edycja przepisu
    const r = rescaleRecipeEntry(e, 2, 2);
    expect(r.snapshot.kcal).toBe(Math.round(e.snapshot.kcal * 2));
    recipe.items[0].grams = 400;
  });
  it('wpis sprzed 0.6.1 bez pola portions: porcje z nazwy', () => {
    const old = { ...recipeEntry(recipe, products, 0.75, 'd', 1, 'e', 1), portions: undefined } as FoodEntry;
    expect(entryPortions(old)).toBe(0.75);
    expect(rescaleRecipeEntry(old, 1.5, 2).snapshot.kcal).toBe(Math.round(old.snapshot.kcal * 2));
  });
  it('odrzuca porcje poza zakresem i wpisy, które nie są przepisem', () => {
    const e = recipeEntry(recipe, products, 1, 'd', 1, 'e', 1);
    expect(() => rescaleRecipeEntry(e, 0, 2)).toThrow();
    expect(() => rescaleRecipeEntry(e, 21, 2)).toThrow();
    expect(entryPortions({ ...e, recipeId: undefined })).toBeUndefined();
    expect(() => rescaleRecipeEntry({ ...e, recipeId: undefined }, 2, 2)).toThrow();
  });
  it('zapis w bazie zmienia tylko edytowany wpis; reszta historii i kopia bez zmian', async () => {
    const db = new BodyDB('p-' + Math.random());
    const a = recipeEntry(recipe, products, 1, '2026-11-21', 1, 'a', 1);
    const b = recipeEntry(recipe, products, 1, '2026-11-22', 1, 'b', 1);
    await db.entries.bulkPut([a, b]);
    await db.recipes.put(recipe);
    await db.entries.put(rescaleRecipeEntry(b, 2, 5));
    expect(await db.entries.get('a')).toEqual(a);
    expect((await db.entries.get('b'))!.portions).toBe(2);
    expect((await db.recipes.get('r1'))!.items).toEqual(recipe.items);
    const target = new BodyDB('p2-' + Math.random());
    expect((await importAll(JSON.parse(JSON.stringify(await exportAll(db))), target)).ok).toBe(true);
    expect((await target.entries.get('b'))!.portions).toBe(2);
  });
});
