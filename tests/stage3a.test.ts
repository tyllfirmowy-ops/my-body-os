import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { BodyDB, TABLES } from '../src/db/db';
import { exportAll, importAll, inspectBackup, verifyBackupText, encryptBackup, decryptBackup, countAll } from '../src/db/backup';

// Fikcyjne dane testowe (żadnych prawdziwych danych zdrowotnych).
const T = { createdAt: 1, updatedAt: 1 };
async function seed(d: BodyDB) {
  await d.profile.put({ id: 'me', name: 'Test', sex: 'male', heightCm: 180, ageYears: 30, ageRefDate: '2026-01-01', goals: [{ kg: 80, label: 'c' }], ...T } as never);
  await d.health.put({ id: 'me', conditions: ['x'], kneeCleared: false, ...T } as never);
  await d.plans.put({ id: 'p1', validFrom: '2026-11-01', kcal: 2400, proteinG: 180, fatG: 70, carbsG: 250, reason: 'start', ...T } as never);
  await d.morning.put({ date: '2026-11-20', weightKg: 90.4, symptoms: [], ...T } as never);
  await d.evening.put({ date: '2026-11-20', dietOk: true, ...T } as never);
  await d.measurements.put({ id: 'm1', date: '2026-11-20', waistCm: 95, ...T } as never);
  await d.foods.put({ id: 'f1', name: 'Ryż', per100: { kcal: 350, protein: 7, fat: 1, carbs: 78, fiber: 1 }, ...T } as never);
  await d.entries.bulkPut([
    { id: 'e1', date: '2026-11-20', productId: 'f1', grams: 100, meal: 'obiad', snapshot: { name: 'Ryż', kcal: 350, protein: 7, fat: 1, carbs: 78, fiber: 1 }, ...T },
    { id: 'e2', date: '2026-11-20', productId: 'quick', grams: 0, meal: 'kolacja', unknown: ['fat'], snapshot: { name: 'q', kcal: 500, protein: 20, fat: 0, carbs: 50, fiber: 2 }, ...T },
  ] as never);
  await d.water.put({ date: '2026-11-20', ml: 2500, ...T } as never);
  await d.sessions.put({ id: 's1', date: '2026-11-20', templateId: 'A', status: 'completed', order: ['machine_press'], skipped: [], technique: {}, startedAt: 1, substitutions: { machine_press: 'flat_db_press' }, ...T } as never);
  await d.sets.put({ id: 'x1', sessionId: 's1', exerciseId: 'flat_db_press', slot: 'machine_press', weightKg: 16, reps: 10, ...T } as never);
  await d.custody.put({ id: 'c', anchor: '2026-11-02', ...T } as never);
  await d.overrides.put({ date: '2026-11-21', withDaughter: true, ...T } as never);
  await d.symptoms.put({ id: 'y1', date: '2026-11-20', time: '12:00', products: 'mleko', ...T } as never);
  await d.labs.put({ id: 'l1', date: '2026-10-01', name: 'Testowy', value: 1, unit: 'u', ...T } as never);
  await d.feedback.put({ id: 'fb1', date: '2026-11-20', ruleId: 'r', value: 'not_helpful', ...T } as never);
  await d.settings.put({ id: 'settings', theme: 'dark', onboarded: true, backupReminderDays: 7, aiIncludeHealth: false });
}
const fresh = () => new BodyDB('t3a-' + Math.random());
async function dumpAll(d: BodyDB) {
  const o: Record<string, unknown[]> = {};
  for (const t of TABLES) o[t] = await d.table(t).toArray();
  return o;
}

describe('3A kopia zapasowa', () => {
  it('pełny cykl: baza → plik JSON → nowa baza = identyczna zawartość każdej tabeli', async () => {
    const a = fresh(); await seed(a);
    const text = JSON.stringify(await exportAll(a));
    const b = fresh();
    const r = await importAll(JSON.parse(text), b);
    expect(r.ok).toBe(true);
    for (const t of TABLES) expect((await countAll(b))[t]).toBeGreaterThan(0);
    expect(await dumpAll(b)).toEqual(await dumpAll(a));
  });

  it('kopia zaszyfrowana: weryfikacja, złe hasło, odtworzenie', async () => {
    const a = fresh(); await seed(a);
    const text = JSON.stringify(await encryptBackup(await exportAll(a), 'tajne'));
    const v = await verifyBackupText(text, 'tajne', a);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.total).toBe(Object.values(await countAll(a)).reduce((x, y) => x + y, 0));
    expect((await verifyBackupText(text, 'zle', a)).ok).toBe(false);
    const b = fresh();
    expect((await importAll(await decryptBackup(JSON.parse(text), 'tajne'), b)).ok).toBe(true);
    expect(await dumpAll(b)).toEqual(await dumpAll(a));
  });

  it('weryfikacja wykrywa rozjazd z bazą (nowy wpis po wygenerowaniu pliku)', async () => {
    const a = fresh(); await seed(a);
    const text = JSON.stringify(await exportAll(a));
    await a.water.put({ date: '2026-11-21', ml: 1000, createdAt: 1, updatedAt: 1 } as never);
    const v = await verifyBackupText(text, '', a);
    expect(v.ok).toBe(false);
  });

  it('zmieniony lub ucięty plik jest odrzucany, a obecne dane zostają', async () => {
    const a = fresh(); await seed(a);
    const dump = await exportAll(a);
    const b = fresh(); await b.water.put({ date: '2000-01-01', ml: 1, createdAt: 1, updatedAt: 1 } as never);
    const tampered = JSON.parse(JSON.stringify(dump)); tampered.tables.morning[0].weightKg = 70;
    expect(await importAll(tampered, b)).toMatchObject({ ok: false });
    const cut = JSON.parse(JSON.stringify(dump)); cut.tables.entries.pop();
    expect(await importAll(cut, b)).toMatchObject({ ok: false });
    expect(await b.water.toArray()).toHaveLength(1);
  });

  it('błąd zapisu w środku importu = rollback, nic nie zostaje nadpisane', async () => {
    const b = fresh(); await seed(b);
    const before = await dumpAll(b);
    // rekord profilu bez klucza głównego przechodzi walidację formatu, ale Dexie go odrzuci
    const bad = { format: 'my-body-os-backup', version: 1, exportedAt: 0, tables: { morning: [{ date: '2026-01-01', symptoms: [], createdAt: 0, updatedAt: 0 }], water: [], profile: [{ name: 'bez id' }] } };
    const r = await importAll(bad, b);
    expect(r.ok).toBe(false);
    expect(await dumpAll(b)).toEqual(before);
  });

  it('tabele nieobecne w kopii nie są czyszczone', async () => {
    const b = fresh(); await seed(b);
    const partial = { format: 'my-body-os-backup', version: 1, exportedAt: 0, tables: { water: [{ date: '2026-01-01', ml: 1, createdAt: 0, updatedAt: 0 }] } };
    const r = await importAll(partial, b);
    expect(r.ok && r.untouched).toContain('sets');
    expect(await b.water.count()).toBe(1);
    expect(await b.sets.count()).toBe(1);
    expect(await b.morning.count()).toBe(1);
  });

  it('podgląd kopii: liczby rekordów, integralność, kopia z nowszej bazy i nieznana tabela', async () => {
    const a = fresh(); await seed(a);
    const dump = await exportAll(a);
    const i = await inspectBackup(JSON.parse(JSON.stringify(dump)));
    expect(i.ok && i.integrity).toBe('verified');
    expect(i.ok && i.counts.entries).toBe(2);
    expect((await inspectBackup({ ...dump, schema: 99 })).ok).toBe(false);
    expect((await inspectBackup({ format: 'my-body-os-backup', version: 1, exportedAt: 0, tables: { cos: [] } })).ok).toBe(false);
    const old = await inspectBackup({ format: 'my-body-os-backup', version: 1, exportedAt: 0, tables: { water: [] } });
    expect(old.ok && old.integrity).toBe('not_available');
  });

  it('baza ze schematu Dexie v1 → upgrade → eksport → import zachowuje dane i migrację', async () => {
    const name = 'old-' + Math.random();
    const v1 = new Dexie(name);
    v1.version(1).stores({ profile: 'id', health: 'id', plans: 'id, validFrom', morning: 'date', evening: 'date', measurements: 'id, date', foods: 'id, name, favorite', entries: 'id, date, productId', water: 'date', sessions: 'id, date, status', sets: 'id, sessionId, exerciseId, [sessionId+exerciseId]', custody: 'id', overrides: 'date', symptoms: 'id, date', labs: 'id, date', feedback: 'id, date', settings: 'id' });
    await v1.table('entries').add({ id: 'q', date: '2026-11-01', productId: 'quick', grams: 0, meal: 'x', snapshot: { name: 'q', kcal: 600, protein: 0, fat: 0, carbs: 0, fiber: 0 }, createdAt: 0, updatedAt: 0 });
    await v1.table('sets').add({ id: 's', sessionId: 'w', exerciseId: 'db_rdl', weightKg: 20, reps: 10, createdAt: 0, updatedAt: 0 });
    v1.close();
    const up = new BodyDB(name); await up.open();
    const dump = await exportAll(up);
    expect(dump.schema).toBe(2);
    const b = fresh();
    expect((await importAll(JSON.parse(JSON.stringify(dump)), b)).ok).toBe(true);
    expect((await b.entries.get('q'))!.unknown).toEqual(['protein', 'fat', 'carbs', 'fiber']);
    expect((await b.sets.get('s'))!.slot).toBeUndefined();
    up.close();
  });
});
