import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BodyDB } from '../src/db/db';
import { exportAll, importAll } from '../src/db/backup';
import { suggestProgression, roundToStep, loadStepKg, toDisplay, fromDisplay, LB, type ProgressInput, type SetResult } from '../src/domain/progression';
import { historyFor } from '../src/domain/workout';

const S = (w: number, reps: number[], rir?: number, pain?: number): SetResult[] => reps.map((r) => ({ weightKg: w, reps: r, rir, pain, done: true }));
const base: Omit<ProgressInput, 'history'> = { today: '2026-11-22', plannedSets: 3, repMin: 8, repMax: 12, step: 2.5, safetyBlock: false };
const P = (history: ProgressInput['history'], over: Partial<ProgressInput> = {}) => suggestProgression({ ...base, history, ...over });

describe('W2 podwójna progresja', () => {
  it('najpierw powtórzenia w zakresie, ten sam ciężar', () => {
    const r = P([{ date: '2026-11-19', sets: S(40, [10, 9, 9]) }]);
    expect(r).toMatchObject({ action: 'reps', weightKg: 40 });
    expect(r.reason).toMatch(/dołóż 1 powtórzenie w każdej serii/);
  });
  it('jeden dobry trening na górze zakresu (bez RIR) nie wystarcza', () => {
    expect(P([{ date: '2026-11-19', sets: S(40, [12, 12, 12]) }])).toMatchObject({ action: 'hold', weightKg: 40 });
  });
  it('dwa kolejne treningi na górze zakresu → +najmniejszy skok, powtórzenia od dołu zakresu', () => {
    const r = P([{ date: '2026-11-19', sets: S(40, [12, 12, 12]) }, { date: '2026-11-15', sets: S(40, [12, 12, 12]) }]);
    expect(r).toMatchObject({ action: 'increase', weightKg: 42.5, targetReps: '8–12' });
    expect(r.basis?.join()).toMatch(/2 kolejnych/);
  });
  it('jeden trening na górze z zapasem RIR ≥ 2 w każdej serii → zwiększenie (RIR opcjonalne, ale gdy podane, pomaga)', () => {
    expect(P([{ date: '2026-11-19', sets: S(40, [12, 12, 12], 2) }]).action).toBe('increase');
    expect(P([{ date: '2026-11-19', sets: [...S(40, [12, 12], 2), ...S(40, [12])] }]).action).toBe('hold'); // RIR nie wszędzie
  });
  it('górny zakres bez zapasu (RIR 0) → bez zwiększenia mimo dwóch sesji', () => {
    expect(P([{ date: '2026-11-19', sets: S(40, [12, 12, 12], 0) }, { date: '2026-11-15', sets: S(40, [12, 12, 12]) }]).action).toBe('hold');
  });
  it('niepełna liczba serii → najpierw wszystkie serie', () => {
    expect(P([{ date: '2026-11-19', sets: S(40, [12, 12]) }]).reason).toMatch(/wszystkie 3 serie/);
  });
  it('zwiększenie po innym ciężarze w poprzedniej sesji wymaga powtórzenia na nowym ciężarze', () => {
    expect(P([{ date: '2026-11-19', sets: S(42.5, [12, 12, 12]) }, { date: '2026-11-15', sets: S(40, [12, 12, 12]) }]).action).toBe('hold');
  });
});

describe('W2 skoki obciążenia i jednostki', () => {
  it('najmniejszy skok sprzętu; duży skok procentowy z ostrzeżeniem (ACSM: zwykle 2–10%)', () => {
    const r = P([{ date: '2026-11-19', sets: S(4, [15, 15, 15]) }, { date: '2026-11-15', sets: S(4, [15, 15, 15]) }], { repMin: 12, repMax: 15, step: 1 });
    expect(r.weightKg).toBe(5);
    expect(r.reason).toMatch(/\+25%.*zacznij od 12/);
  });
  it('bez obciążenia (skok 0) → więcej serii albo trudniejszy wariant, bez ciężaru', () => {
    expect(P([{ date: '2026-11-19', sets: S(0, [12, 12, 12]) }, { date: '2026-11-15', sets: S(0, [12, 12, 12]) }], { step: 0 })).toMatchObject({ action: 'reps', weightKg: null });
  });
  it('jednostki: lb ↔ kg, zaokrąglenie do siatki skoku', () => {
    expect(toDisplay(fromDisplay(50, 'lb'), 'lb')).toBe(50);
    expect(fromDisplay(5, 'lb')).toBeCloseTo(5 * LB);
    expect(roundToStep(41.3, 2.5)).toBe(42.5);
    expect(roundToStep(41.2, 0)).toBe(41.2);
    const step = loadStepKg({ increment: 2, equip: ['dumbbell'] }, 'lb');
    const r = P([{ date: '2026-11-19', sets: S(20 * LB * 2, [12, 12, 12]) }, { date: '2026-11-15', sets: S(20 * LB * 2, [12, 12, 12]) }], { step });
    expect(toDisplay(r.weightKg!, 'lb')).toBe(45);
  });
  it('skok z ustawień użytkownika ma pierwszeństwo; ćwiczenie bez obciążenia zostaje bez skoku', () => {
    expect(loadStepKg({ increment: 2.5, equip: ['machine'] }, 'kg', { machine: 5 })).toBe(5);
    expect(loadStepKg({ increment: 2.5, equip: ['machine'] }, 'kg')).toBe(2.5);
    expect(loadStepKg({ increment: 0, equip: ['bodyweight'] }, 'kg', { machine: 5 })).toBe(0);
  });
});

describe('W2 ochrona przed nieuzasadnioną progresją', () => {
  const top2 = [{ date: '2026-11-19', sets: S(40, [12, 12, 12]) }, { date: '2026-11-15', sets: S(40, [12, 12, 12]) }];
  it('blokada bezpieczeństwa → pominięcie; kolano bez oceny → bez obciążenia', () => {
    expect(P(top2, { safetyBlock: true }).action).toBe('skip');
    expect(P(top2, { kneeNoLoad: true })).toMatchObject({ action: 'hold', weightKg: 0 });
  });
  it('ból ≥ 4 → lżej o ~10% (w dół do siatki); ból 3 → bez zwiększenia', () => {
    expect(P([{ date: '2026-11-19', sets: S(40, [12, 12, 12], undefined, 5) }])).toMatchObject({ action: 'decrease', weightKg: 35 });
    expect(P([{ date: '2026-11-19', sets: S(40, [12, 12, 12], undefined, 3) }, top2[1]]).action).toBe('hold');
  });
  it('dłuższa przerwa: 14 dni bez zwiększania, 28 dni −10%, 56 dni −15%', () => {
    expect(P(top2, { today: '2026-12-03' }).action).toBe('hold');
    expect(P(top2, { today: '2026-12-17' })).toMatchObject({ action: 'decrease', weightKg: 35 });
    expect(P(top2, { today: '2027-01-14' })).toMatchObject({ action: 'decrease', weightKg: 32.5 });
  });
  it('duży spadek wydolności → bez zwiększania; dwa treningi poniżej zakresu → lżej', () => {
    expect(P([{ date: '2026-11-19', sets: S(40, [9, 8, 8]) }, { date: '2026-11-15', sets: S(40, [12, 11, 11]) }]).action).toBe('hold');
    expect(P([{ date: '2026-11-19', sets: S(40, [7, 6, 6]) }, { date: '2026-11-15', sets: S(40, [7, 7, 6]) }])).toMatchObject({ action: 'decrease', weightKg: 35 });
  });
  it('gorszy dzień / ból kolana w check-inie → bez zwiększania z podanym powodem', () => {
    expect(P(top2, { noIncrease: 'Gorszy dzień (plan B)' }).reason).toMatch(/plan B.*bez zwiększania/);
  });
  it('brak historii → bez sugestii ciężaru; słabsza technika → bez zwiększenia', () => {
    expect(P([])).toMatchObject({ action: 'no_data', weightKg: null });
    expect(P([{ ...top2[0], technique: 'bad' }, top2[1]]).action).toBe('hold');
  });
});

describe('W2 historia per ćwiczenie i zapis decyzji', () => {
  const sessions: { id: string; date: string; status: string; startedAt: number; technique?: Record<string, 'ok' | 'bad'> }[] = [
    { id: 's1', date: '2026-11-15', status: 'completed', startedAt: 1, technique: {} },
    { id: 's2', date: '2026-11-19', status: 'completed', startedAt: 2, technique: { flat_db_press: 'ok' as const } },
    { id: 's3', date: '2026-11-22', status: 'in_progress', startedAt: 3 },
  ];
  const set = (sessionId: string, exerciseId: string, w: number, reps: number, i: number) => ({ id: sessionId + exerciseId + i, sessionId, exerciseId, slot: 'machine_press', setIndex: i, weightKg: w, reps, done: true });
  const sets = [set('s1', 'machine_press', 40, 12, 0), set('s2', 'flat_db_press', 16, 10, 0), set('s2', 'machine_press', 42.5, 10, 1)];
  it('zamiennik w tym samym miejscu planu nie miesza się z ćwiczeniem z planu', () => {
    const h = historyFor(sessions, sets, 'flat_db_press');
    expect(h).toHaveLength(1);
    expect(h[0].sets.every((x) => x.exerciseId === 'flat_db_press')).toBe(true);
    expect(h[0].technique).toBe('ok');
    expect(historyFor(sessions, sets, 'machine_press').map((x) => x.date)).toEqual(['2026-11-19', '2026-11-15']);
  });
  it('decyzja zapisana w sesji, serie bez zmian, kopia zapasowa ją zachowuje; stare sesje bez decyzji działają', async () => {
    const db = new BodyDB('w2-' + Math.random());
    await db.sessions.bulkPut([{ id: 'old', createdAt: 0, updatedAt: 0, date: '2026-11-15', templateId: 'A', status: 'completed', order: [], skipped: [], technique: {}, startedAt: 0 },
      { id: 'now', createdAt: 0, updatedAt: 0, date: '2026-11-22', templateId: 'A', status: 'in_progress', order: [], skipped: [], technique: {}, startedAt: 1 }]);
    await db.sets.put({ id: 'x', sessionId: 'old', exerciseId: 'machine_press', setIndex: 0, weightKg: 40, reps: 12, done: true, createdAt: 0, updatedAt: 0 } as never);
    const before = await db.sets.toArray();
    await db.sessions.update('now', { progress: { machine_press: { action: 'increase', suggestedKg: 42.5, targetReps: '8–12', reason: 'test', decision: 'modified', chosenKg: 41, at: 5 } } });
    expect(await db.sets.toArray()).toEqual(before);
    expect((await db.sessions.get('old'))!.progress).toBeUndefined();
    const b = new BodyDB('w2b-' + Math.random());
    expect((await importAll(JSON.parse(JSON.stringify(await exportAll(db))), b)).ok).toBe(true);
    expect((await b.sessions.get('now'))!.progress!.machine_press).toMatchObject({ decision: 'modified', chosenKg: 41 });
  });
});
