import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { BodyDB, CURRENT_SCHEMA } from '../src/db/db';
import { WORKOUTS, ALL_EXERCISES } from '../src/data/exercises';
import { effectivePlan, variantsFor, sessionPlan, validatePlan, moveItem, newItem } from '../src/domain/workoutEdit';
import { kneeBlocked, lastSetsFor } from '../src/domain/workout';
import type { WorkoutTemplateRec } from '../src/domain/types';

const rec = (id: string, slot: 'A' | 'B', name: string, ex = 'db_rdl', t = 1): WorkoutTemplateRec => ({ id, slot, name, items: [{ exerciseId: ex, sets: 3, repMin: 8, repMax: 10, restSec: 120 }], createdAt: t, updatedAt: t });
const lib = (id: string) => ALL_EXERCISES.find((e) => e.id === id);
const defaultIds = [...WORKOUTS.A, ...WORKOUTS.B].map((i) => i.exerciseId);

describe('3C plany treningowe', () => {
  it('kolejność pierwszeństwa: aktywny wariant → edytowany A → domyślny', () => {
    expect(effectivePlan('A', WORKOUTS, []).items).toBe(WORKOUTS.A);
    const recs = [rec('A', 'A', 'Mój A'), rec('v1', 'A', 'Wariant', 'machine_press', 2), rec('v2', 'B', 'B-wariant')];
    expect(effectivePlan('A', WORKOUTS, recs).name).toBe('Mój A');
    expect(effectivePlan('A', WORKOUTS, recs, { A: 'v1' }).name).toBe('Wariant');
    expect(effectivePlan('A', WORKOUTS, recs, { A: 'v2' }).name).toBe('Mój A'); // wariant innego slotu ignorowany
    expect(effectivePlan('A', WORKOUTS, recs, { A: 'usuniety' }).name).toBe('Mój A');
    expect(variantsFor('A', WORKOUTS, recs).map((v) => v.id)).toEqual(['A', 'v1']);
  });
  it('walidacja: zakresy serii, powtórzeń, przerw, duplikaty, puste', () => {
    const ok = [newItem('db_rdl')];
    expect(validatePlan('x', ok, lib, { kneeCleared: false, defaultIds })).toEqual([]);
    expect(validatePlan('', [], lib, { kneeCleared: false, defaultIds }).length).toBe(2);
    expect(validatePlan('x', [{ ...newItem('db_rdl'), sets: 7 }], lib, { kneeCleared: false, defaultIds }).join()).toMatch(/serie/);
    expect(validatePlan('x', [{ ...newItem('db_rdl'), repMin: 12, repMax: 8 }], lib, { kneeCleared: false, defaultIds }).join()).toMatch(/powtórzenia/);
    expect(validatePlan('x', [{ ...newItem('db_rdl'), restSec: 10 }], lib, { kneeCleared: false, defaultIds }).join()).toMatch(/przerwa/);
    expect(validatePlan('x', [newItem('db_rdl'), newItem('db_rdl')], lib, { kneeCleared: false, defaultIds }).join()).toMatch(/powtórzone/);
    expect(validatePlan('x', [newItem('nie_ma')], lib, { kneeCleared: false, defaultIds }).join()).toMatch(/Nieznane/);
  });
  it('zdrowie ma pierwszeństwo: bez oceny kolana nie można dodać nowego ćwiczenia mocno obciążającego kolano', () => {
    const fakeLib = (id: string) => (id === 'lunge' ? { id, knee: 'moderate' as const, namePl: 'Wykrok' } : lib(id));
    expect(validatePlan('x', [newItem('lunge')], fakeLib, { kneeCleared: false, defaultIds }).join()).toMatch(/kolano/);
    expect(validatePlan('x', [newItem('lunge')], fakeLib, { kneeCleared: true, defaultIds })).toEqual([]);
    expect(validatePlan('x', [newItem('box_step_up')], lib, { kneeCleared: false, defaultIds })).toEqual([]); // był w planie domyślnym
  });
  it('blokady kolana w trakcie treningu działają po ćwiczeniu, niezależnie od planu', () => {
    expect(kneeBlocked('stop_legs', 'low')).toBe(true);
    expect(kneeBlocked('stop_legs', 'none')).toBe(false);
    expect(kneeBlocked('caution_legs', 'moderate')).toBe(true);
    expect(kneeBlocked('caution_legs', 'low')).toBe(false);
    expect(kneeBlocked('urgent', 'none')).toBe(true);
    expect(kneeBlocked('ok', 'moderate')).toBe(false);
  });
  it('zmiana kolejności', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
  it('sesja używa snapshotu planu; starsza sesja bez snapshotu → plan domyślny', () => {
    const snap = [{ exerciseId: 'machine_press', sets: 4, repMin: 6, repMax: 8, restSec: 150 }];
    expect(sessionPlan({ templateId: 'A', plan: snap }, WORKOUTS)).toBe(snap);
    expect(sessionPlan({ templateId: 'B' }, WORKOUTS)).toBe(WORKOUTS.B);
  });
});

describe('3C dane w bazie', () => {
  it('edycja szablonu po treningu nie zmienia sesji, serii ani historii progresji', async () => {
    const db = new BodyDB('w-' + Math.random());
    const plan = effectivePlan('A', WORKOUTS, []).items;
    await db.sessions.add({ id: 's1', createdAt: 0, updatedAt: 0, date: '2026-11-20', templateId: 'A', status: 'completed', order: plan.map((p) => p.exerciseId), plan: structuredClone(plan), planName: 'Trening A', skipped: [], technique: {}, startedAt: 0 });
    await db.sets.add({ id: 'x1', sessionId: 's1', exerciseId: 'machine_press', slot: 'machine_press', setIndex: 0, weightKg: 40, reps: 12, done: true, createdAt: 0, updatedAt: 0 } as never);
    await db.workoutTemplates.put({ ...rec('A', 'A', 'Nowy A', 'incline_db_press'), items: [{ exerciseId: 'incline_db_press', sets: 4, repMin: 6, repMax: 8, restSec: 180 }] });
    const s = (await db.sessions.get('s1'))!;
    expect(sessionPlan(s, WORKOUTS)[0]).toMatchObject({ exerciseId: 'machine_press', sets: 3 });
    expect((await db.sets.get('x1'))!.weightKg).toBe(40);
    const last = lastSetsFor(await db.sessions.toArray(), await db.sets.toArray(), 'machine_press');
    expect(last?.sets[0].weightKg).toBe(40);
    const recs = await db.workoutTemplates.toArray();
    expect(effectivePlan('A', WORKOUTS, recs).items[0].exerciseId).toBe('incline_db_press');
    db.close();
  });
  it('migracja Dexie v3 → v4: nowa tabela pusta, dane zostają', async () => {
    const name = 'v3-' + Math.random();
    const v3 = new Dexie(name);
    const stores = { profile: 'id', health: 'id', plans: 'id, validFrom', morning: 'date', evening: 'date', measurements: 'id, date', foods: 'id, name, favorite', entries: 'id, date, productId', water: 'date', sessions: 'id, date, status', sets: 'id, sessionId, exerciseId, [sessionId+exerciseId]', custody: 'id', overrides: 'date', symptoms: 'id, date', labs: 'id, date', feedback: 'id, date', settings: 'id' };
    v3.version(1).stores(stores); v3.version(2).stores({}); v3.version(3).stores({ recipes: 'id, name', mealTemplates: 'id' });
    await v3.table('recipes').add({ id: 'r', name: 'x', servings: 1, items: [], createdAt: 0, updatedAt: 0 });
    v3.close();
    const db = new BodyDB(name); await db.open();
    expect(db.verno).toBe(CURRENT_SCHEMA);
    expect(await db.workoutTemplates.count()).toBe(0);
    expect(await db.recipes.count()).toBe(1);
    db.close();
  });
});
