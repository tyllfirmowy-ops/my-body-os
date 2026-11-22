import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BONES, dist, fk, fromVertical, jointAngle, sampleAt, totalDuration, type Skeleton } from '../src/domain/rig';
import { RIGS } from '../src/data/rigs';
import { WORKOUTS, exerciseById, ALL_EXERCISES } from '../src/data/exercises';
import { actualFor, lastSetsFor, setsForSlot, swapExercise, swapOptions } from '../src/domain/workout';
import { suggestNext } from '../src/domain/progression';
import { BodyDB } from '../src/db/db';
import { exportAll, importAll } from '../src/db/backup';

const lib = (id: string) => exerciseById(id);
const samples = (id: string, n = 240) => { const r = RIGS[id]; const T = totalDuration(r.timeline); return Array.from({ length: n + 1 }, (_, i) => fk(sampleAt(r.keys, r.timeline, (T * i) / n).key)); };
const ALL = Object.keys(RIGS);

describe('silnik animacji: geometria', () => {
  it.each(ALL)('%s: stałe długości segmentów w całym cyklu', (id) => {
    for (const s of samples(id)) {
      expect(dist(s.hip, s.knee)).toBeCloseTo(BONES.thigh, 6);
      expect(dist(s.knee, s.ankle)).toBeCloseTo(BONES.shin, 6);
      expect(dist(s.hip, s.shoulder)).toBeCloseTo(BONES.trunk, 6);
      expect(dist(s.shoulder, s.elbow)).toBeCloseTo(BONES.upperArm, 6);
      expect(dist(s.elbow, s.hand)).toBeCloseTo(BONES.forearm, 6);
      expect(dist(s.ankle, s.toe)).toBeCloseTo(BONES.foot, 6);
    }
  });
  it.each(ALL)('%s: brak NaN/Infinity i współrzędne w kadrze', (id) => {
    for (const s of samples(id)) for (const [k, v] of Object.entries(s)) {
      if (k === 'curve') continue;
      const [x, y] = v as [number, number];
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThan(-5); expect(x).toBeLessThan(205); expect(y).toBeGreaterThan(-5); expect(y).toBeLessThan(152);
    }
  });
  it.each(ALL)('%s: ciągłość ruchu (60 kl./s, także na przejściu pętli)', (id) => {
    const r = RIGS[id]; const T = totalDuration(r.timeline); const dt = 1 / 60;
    let prev: Skeleton | null = null;
    for (let t = 0; t <= T + dt; t += dt) {
      const s = fk(sampleAt(r.keys, r.timeline, t).key);
      if (prev) for (const k of ['hip', 'knee', 'ankle', 'shoulder', 'elbow', 'hand', 'head'] as const) expect(dist(prev[k], s[k])).toBeLessThan(3.5);
      prev = s;
    }
  });
  it('każde ćwiczenie FBW A/B ma animację; trzy wzorce oznaczone', () => {
    for (const t of [...WORKOUTS.A, ...WORKOUTS.B]) expect(RIGS[t.exerciseId], t.exerciseId).toBeDefined();
    expect(Object.entries(RIGS).filter(([, r]) => r.reference).map(([k]) => k).sort()).toEqual(['box_step_up', 'db_rdl', 'incline_db_press']);
  });
  it('stopy na podłodze w ćwiczeniach stojących (IK bez prostowania na siłę)', () => {
    for (const id of ['db_rdl', 'box_step_up', 'db_curl', 'triceps_pushdown', 'pallof_press']) for (const s of samples(id, 60)) {
      expect(s.ankle[1]).toBeCloseTo(146, 3);
    }
  });
});

describe('wzorce: kluczowe pozycje', () => {
  const at = (id: string, key: string) => fk(RIGS[id].keys[key]);
  it('RDL: zawias w biodrach, stałe lekkie ugięcie kolan, pionowe golenie, hantle nad stopą i przy nogach', () => {
    const top = at('db_rdl', 'top'), bot = at('db_rdl', 'bottom');
    expect(bot.hip[0]).toBeLessThan(top.hip[0] - 8);                 // biodra w tył
    expect(fromVertical(bot.hip, bot.shoulder)).toBeGreaterThan(45);  // tułów wyraźnie pochylony
    const kTop = jointAngle(top.hip, top.knee, top.ankle), kBot = jointAngle(bot.hip, bot.knee, bot.ankle);
    expect(kTop).toBeGreaterThan(160); expect(kTop).toBeLessThan(178); // kolana odblokowane
    expect(kTop - kBot).toBeLessThan(35);                              // bez przechodzenia w przysiad
    expect(fromVertical(bot.knee, bot.ankle)).toBeLessThan(8);         // golenie ~pionowo
    expect(bot.knee[0]).toBeGreaterThan(bot.hip[0]);                   // kolano zgina się do przodu
    expect(bot.hand[0]).toBeGreaterThan(bot.ankle[0] - 2); expect(bot.hand[0]).toBeLessThan(bot.toe[0]); // nad stopą
    expect(bot.hand[1]).toBeGreaterThan(bot.knee[1]);                   // poniżej kolana
    expect(bot.hand[1]).toBeLessThan(bot.ankle[1] - 10);                // nie do podłogi
  });
  it('Siad na wysoką ławkę: biodra na ławce, kąt kolana > 90°, golenie bliskie pionu', () => {
    const bot = at('box_step_up', 'bottom'); const box = RIGS.box_step_up.props[0] as { x: number; y: number; w: number };
    expect(bot.hip[0]).toBeGreaterThan(box.x); expect(bot.hip[0]).toBeLessThan(box.x + box.w);
    expect(box.y - bot.hip[1]).toBeGreaterThanOrEqual(0); expect(box.y - bot.hip[1]).toBeLessThan(7);
    expect(jointAngle(bot.hip, bot.knee, bot.ankle)).toBeGreaterThan(95);
    expect(fromVertical(bot.knee, bot.ankle)).toBeLessThan(25);
    expect(bot.knee[0]).toBeGreaterThan(bot.ankle[0] - 1);
  });
  it('Wyciskanie skośne: ławka 30°, przedramiona ~pionowo na dole, wyprost nad barkiem, biodro na siedzisku', () => {
    for (const k of ['top', 'bottom']) expect(RIGS.incline_db_press.keys[k].trunk).toBe(210);
    const bot = at('incline_db_press', 'bottom'), top = at('incline_db_press', 'top');
    expect(fromVertical(bot.elbow, bot.hand)).toBeLessThan(15);
    expect(bot.elbow[1]).toBeGreaterThan(bot.shoulder[1]);              // łokieć poniżej barku na dole
    expect(Math.abs(top.hand[0] - top.shoulder[0])).toBeLessThan(6);
    expect(top.shoulder[1] - top.hand[1]).toBeGreaterThan(35);
    expect(jointAngle(top.shoulder, top.elbow, top.hand)).toBeGreaterThan(150); // prawie wyprost, bez blokowania
  });
});

describe('zamiana ćwiczenia', () => {
  const base = { safety: 'none' as const, kneeCleared: false };
  it('alternatywy z tej samej grupy, pierwsza opcja = ćwiczenie z planu', () => {
    const o = swapOptions('machine_press', lib, base);
    expect(o[0]).toMatchObject({ id: 'machine_press', original: true, allowed: true });
    expect(o.map((x) => x.id)).toContain('flat_db_press');
    for (const x of o) expect(exerciseById(x.id).group).toBe('chest');
  });
  it('blokady kolana nie dają się obejść zamianą', () => {
    expect(swapOptions('box_step_up', lib, { ...base, safety: 'stop_legs' }).every((x) => !x.allowed)).toBe(true);
    const caution = swapOptions('box_step_up', lib, { ...base, safety: 'caution_legs' });
    expect(caution.find((x) => x.id === 'box_step_up')!.allowed).toBe(false);
    expect(caution.find((x) => x.id === 'hip_thrust')!.allowed).toBe(true);
    // bez oceny kolana: zamiennik nie może obciążać kolana bardziej niż ćwiczenie z planu
    expect(swapOptions('seated_row', lib, base).find((x) => x.id === 'db_row')!.allowed).toBe(false);
    expect(swapOptions('seated_row', lib, { ...base, kneeCleared: true }).find((x) => x.id === 'db_row')!.allowed).toBe(true);
    expect(swapOptions('seated_row', lib, { ...base, safety: 'urgent' }).every((x) => !x.allowed)).toBe(true);
  });
  it('filtr sprzętu i brak dubli w treningu', () => {
    expect(swapOptions('machine_press', lib, { ...base, equipment: ['dumbbell'] }).find((x) => x.id === 'incline_machine_press')!.allowed).toBe(false);
    expect(swapOptions('machine_press', lib, { ...base, inSession: ['incline_db_press'] }).find((x) => x.id === 'incline_db_press')!.allowed).toBe(false);
  });
  it('zamiana jest niemutująca, odwracalna i odrzuca niedozwolone', () => {
    const s = { order: ['machine_press', 'lat_pulldown'], substitutions: {} as Record<string, string> };
    const o = swapOptions('machine_press', lib, base);
    const s2 = swapExercise(s, 'machine_press', 'flat_db_press', o);
    expect(actualFor(s2, 'machine_press')).toBe('flat_db_press'); expect(s.substitutions).toEqual({}); expect(s2.order).toEqual(s.order);
    expect(actualFor(swapExercise(s2, 'machine_press', 'machine_press', o), 'machine_press')).toBe('machine_press');
    expect(() => swapExercise(s, 'machine_press', 'leg_curl', o)).toThrow();
    expect(() => swapExercise(s, 'db_curl', 'cable_curl', swapOptions('db_curl', lib, base))).toThrow();
  });
  it('serie w slocie: wykonane zostają, nowe przypisane do faktycznego ćwiczenia, stare dane bez pola slot', () => {
    const sets = [
      { exerciseId: 'machine_press', done: true }, // dane sprzed v0.5 (bez slot)
      { exerciseId: 'flat_db_press', slot: 'machine_press', done: true },
      { exerciseId: 'lat_pulldown', done: true },
    ];
    const inSlot = setsForSlot(sets, 'machine_press');
    expect(inSlot.map((x) => x.exerciseId)).toEqual(['machine_press', 'flat_db_press']);
  });
  it('progresja po zamianie: osobna historia i przyrost właściwy dla wykonanego ćwiczenia', () => {
    const sessions = [{ id: 's1', date: '2026-11-10', status: 'completed', startedAt: 1 }, { id: 's2', date: '2026-11-14', status: 'completed', startedAt: 2 }];
    const sets = [
      ...[0, 1, 2].map((i) => ({ sessionId: 's1', exerciseId: 'machine_press', setIndex: i, weightKg: 40, reps: 12, rir: 2, done: true })),
      ...[0, 1, 2].map((i) => ({ sessionId: 's2', exerciseId: 'flat_db_press', slot: 'machine_press', setIndex: i, weightKg: 14, reps: 12, rir: 2, done: true })),
    ];
    const lastFlat = lastSetsFor(sessions, sets, 'flat_db_press')!;
    const lastMachine = lastSetsFor(sessions, sets, 'machine_press')!;
    expect(lastFlat.session.id).toBe('s2'); expect(lastMachine.session.id).toBe('s1');
    const tpl = WORKOUTS.A.find((t) => t.exerciseId === 'machine_press')!;
    const sug = suggestNext({ last: lastFlat.sets, plannedSets: tpl.sets, repMin: tpl.repMin, repMax: tpl.repMax, increment: exerciseById('flat_db_press').increment, technique: 'ok', safetyBlock: false });
    expect(sug).toMatchObject({ action: 'increase', weightKg: 16 });
    expect(suggestNext({ last: lastMachine.sets, plannedSets: 3, repMin: 10, repMax: 12, increment: exerciseById('machine_press').increment, technique: 'ok', safetyBlock: false }).weightKg).toBe(42.5);
  });
  it('wszystkie zamienniki istnieją w bibliotece i mają grupę mięśni', () => {
    for (const e of ALL_EXERCISES) { expect(e.group, e.id).toBeDefined(); for (const id of e.swapTo ?? []) expect(exerciseById(id), id).toBeDefined(); }
    expect(exerciseById('box_step_up').namePl).toBe('Siad na wysoką ławkę i wstawanie');
  });
});

describe('wznowienie i kopie', () => {
  it('sesja z zamianą przetrwa ponowne otwarcie bazy', async () => {
    const name = 'resume-' + Math.random();
    const db1 = new BodyDB(name);
    await db1.sessions.add({ id: 'w1', createdAt: 0, updatedAt: 0, date: '2026-11-22', templateId: 'A', status: 'in_progress', order: WORKOUTS.A.map((t) => t.exerciseId), skipped: [], technique: {}, startedAt: 0, substitutions: { machine_press: 'flat_db_press' } });
    await db1.sets.add({ id: 'x1', sessionId: 'w1', exerciseId: 'flat_db_press', slot: 'machine_press', setIndex: 0, weightKg: 14, reps: 10, done: true, createdAt: 0, updatedAt: 0 });
    db1.close();
    const db2 = new BodyDB(name); await db2.open();
    const s = (await db2.sessions.get('w1'))!;
    expect(actualFor(s, 'machine_press')).toBe('flat_db_press');
    expect(setsForSlot(await db2.sets.where('sessionId').equals('w1').toArray(), 'machine_press')).toHaveLength(1);
    db2.close();
  });
  it('kopia zapasowa zachowuje zamiany; starsza kopia bez nich działa', async () => {
    const a = new BodyDB('bk-' + Math.random());
    await a.sessions.add({ id: 'w2', createdAt: 0, updatedAt: 0, date: '2026-11-22', templateId: 'B', status: 'completed', order: ['seated_row'], skipped: [], technique: {}, startedAt: 0, substitutions: { seated_row: 'machine_row' } });
    const dump = await exportAll(a);
    const b = new BodyDB('bk2-' + Math.random());
    expect((await importAll(dump, b)).ok).toBe(true);
    expect((await b.sessions.get('w2'))!.substitutions).toEqual({ seated_row: 'machine_row' });
    const old = { format: 'my-body-os-backup', version: 1, exportedAt: 0, tables: { sessions: [{ id: 'w3', createdAt: 0, updatedAt: 0, date: '2026-11-01', templateId: 'A', status: 'completed', order: ['machine_press'], skipped: [], technique: {}, startedAt: 0 }] } };
    expect((await importAll(old, b)).ok).toBe(true);
    expect(actualFor((await b.sessions.get('w3'))!, 'machine_press')).toBe('machine_press');
  });
});
