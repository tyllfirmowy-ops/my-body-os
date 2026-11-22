import { z } from 'zod';
import { db, migrateEntryV2, TABLES, CURRENT_SCHEMA, type BodyDB, type TableName } from './db';

export const BACKUP_FORMAT = 'my-body-os-backup';
export const BACKUP_VERSION = 2;
export const APP_VERSION = '0.6.0';

const Backup = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: z.number(),
  encrypted: z.literal(false).optional(),
  app: z.string().optional(),
  schema: z.number().optional(),
  counts: z.record(z.string(), z.number()).optional(),
  checksum: z.string().optional(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});
const Encrypted = z.object({ format: z.literal(BACKUP_FORMAT), encrypted: z.literal(true), salt: z.string(), iv: z.string(), data: z.string() });

// minimalna walidacja kluczowych rekordów
const keyCheck: Partial<Record<TableName, z.ZodType>> = {
  morning: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).loose(),
  entries: z.object({ id: z.string(), date: z.string(), grams: z.number().nonnegative() }).loose(),
  sets: z.object({ id: z.string(), sessionId: z.string(), weightKg: z.number(), reps: z.number() }).loose(),
  measurements: z.object({ id: z.string(), date: z.string() }).loose(),
};

/** SHA-256 (hex) z kanonicznego JSON tabel. Wykrywa ucięty lub ręcznie zmieniony plik. */
export async function checksumTables(tables: unknown): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(tables)));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function countAll(d: BodyDB = db): Promise<Record<string, number>> {
  const c: Record<string, number> = {};
  for (const t of TABLES) c[t] = await d.table(t).count();
  return c;
}

export async function exportAll(d: BodyDB = db) {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  await d.transaction('r', TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) { tables[t] = await d.table(t).toArray(); counts[t] = tables[t].length; }
  });
  // stringify→parse usuwa undefined, żeby suma kontrolna zgadzała się po zapisie do pliku
  const clean = JSON.parse(JSON.stringify(tables)) as Record<string, unknown[]>;
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), app: APP_VERSION, schema: d.verno, counts, checksum: await checksumTables(clean), tables: clean };
}

export type Inspect =
  | { ok: true; version: number; exportedAt: number; app?: string; schema?: number; counts: Record<string, number>; total: number; missing: string[]; integrity: 'verified' | 'not_available' }
  | { ok: false; error: string };

/** Sprawdza kopię bez zapisu do bazy: format, tabele, rekordy, liczby i sumę kontrolną (v2). */
export async function inspectBackup(raw: unknown): Promise<Inspect> {
  const parsed = Backup.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Nieprawidłowy plik kopii zapasowej (format lub wersja).' };
  const b = parsed.data;
  for (const [t, rows] of Object.entries(b.tables)) {
    if (!(TABLES as readonly string[]).includes(t)) return { ok: false, error: `Nieznana tabela: ${t}. Kopia może pochodzić z nowszej wersji aplikacji.` };
    const check = keyCheck[t as TableName];
    if (check) for (const r of rows) if (!check.safeParse(r).success) return { ok: false, error: `Uszkodzony rekord w tabeli ${t}.` };
  }
  const counts: Record<string, number> = {};
  for (const [t, rows] of Object.entries(b.tables)) counts[t] = rows.length;
  let integrity: 'verified' | 'not_available' = 'not_available';
  if (b.version >= 2) {
    if (!b.counts || !b.checksum) return { ok: false, error: 'Kopia v2 bez sumy kontrolnej: plik niekompletny.' };
    for (const t of Object.keys(b.counts)) if (b.counts[t] !== (counts[t] ?? 0)) return { ok: false, error: `Liczba rekordów w tabeli ${t} nie zgadza się (${counts[t] ?? 0} zamiast ${b.counts[t]}). Plik ucięty lub zmieniony.` };
    const rawTables = (raw as { tables: unknown }).tables;
    if ((await checksumTables(rawTables)) !== b.checksum) return { ok: false, error: 'Suma kontrolna się nie zgadza. Plik uszkodzony lub zmieniony.' };
    integrity = 'verified';
  }
  if (b.schema && b.schema > CURRENT_SCHEMA) return { ok: false, error: 'Kopia z nowszej wersji bazy. Zaktualizuj aplikację przed importem.' };
  return { ok: true, version: b.version, exportedAt: b.exportedAt, app: b.app, schema: b.schema, counts, total: Object.values(counts).reduce((a, x) => a + x, 0),
    missing: TABLES.filter((t) => !(t in b.tables)), integrity };
}

export type ImportResult = { ok: true; counts: Record<string, number>; untouched: string[] } | { ok: false; error: string };

/**
 * Import w jednej transakcji: błąd w dowolnym miejscu = rollback, obecne dane zostają.
 * Tabele nieobecne w kopii (starsza wersja) nie są czyszczone.
 */
export async function importAll(raw: unknown, d: BodyDB = db, mode: 'replace' | 'merge' = 'replace'): Promise<ImportResult> {
  const info = await inspectBackup(raw);
  if (!info.ok) return info;
  const tables = Backup.parse(raw).tables;
  const counts: Record<string, number> = {};
  try {
    await d.transaction('rw', TABLES.map((t) => d.table(t)), async () => {
      for (const t of TABLES) {
        if (!(t in tables)) continue;
        const rows = tables[t].map((r) => structuredClone(r));
        if (t === 'entries') rows.forEach((r) => migrateEntryV2(r as never)); // starsze kopie: ta sama migracja co Dexie v2
        if (mode === 'replace') await d.table(t).clear();
        await d.table(t).bulkPut(rows);
        counts[t] = rows.length;
      }
    });
  } catch (e) {
    const name = (e as { name?: string })?.name ?? '';
    const quota = name === 'QuotaExceededError' || (e as { inner?: { name?: string } })?.inner?.name === 'QuotaExceededError';
    return { ok: false, error: quota ? 'Brak miejsca na urządzeniu. Import przerwany, obecne dane bez zmian.' : 'Import przerwany (błędny rekord). Obecne dane bez zmian.' };
  }
  return { ok: true, counts, untouched: info.missing };
}

export type Verify = { ok: true; total: number; counts: Record<string, number>; bytes: number } | { ok: false; error: string };

/** Weryfikacja pliku po wygenerowaniu: odczyt tekstu (z odszyfrowaniem), sprawdzenie sumy i porównanie z bazą. */
export async function verifyBackupText(text: string, pass: string, d: BodyDB = db): Promise<Verify> {
  try {
    let json: unknown = JSON.parse(text);
    if (isEncrypted(json)) json = await decryptBackup(json, pass);
    const info = await inspectBackup(json);
    if (!info.ok) return info;
    if (info.integrity !== 'verified') return { ok: false, error: 'Brak sumy kontrolnej.' };
    const live = await countAll(d);
    for (const t of TABLES) if ((info.counts[t] ?? 0) !== live[t]) return { ok: false, error: `Tabela ${t}: w pliku ${info.counts[t] ?? 0}, w aplikacji ${live[t]}. Wygeneruj kopię ponownie.` };
    return { ok: true, total: info.total, counts: info.counts, bytes: new Blob([text]).size };
  } catch {
    return { ok: false, error: 'Nie udało się odczytać wygenerowanego pliku.' };
  }
}

/** Pamięć przeglądarki: trwałość i zajętość (Safari może nie podawać wszystkiego). */
export async function storageStatus(): Promise<{ persisted?: boolean; usage?: number; quota?: number }> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!s) return {};
  const out: { persisted?: boolean; usage?: number; quota?: number } = {};
  try { out.persisted = s.persisted ? await s.persisted() : undefined; } catch { /* brak wsparcia */ }
  try { const e = s.estimate ? await s.estimate() : undefined; out.usage = e?.usage; out.quota = e?.quota; } catch { /* brak wsparcia */ }
  return out;
}
export async function requestPersist(): Promise<boolean | undefined> {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : undefined; } catch { return undefined; }
}

// --- opcjonalne szyfrowanie hasłem (AES-GCM + PBKDF2) ---
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function key(pass: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptBackup(obj: unknown, pass: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pass, salt), new TextEncoder().encode(JSON.stringify(obj)));
  return { format: BACKUP_FORMAT, encrypted: true, salt: b64(salt), iv: b64(iv), data: chunkedB64(new Uint8Array(data)) };
}
function chunkedB64(u: Uint8Array) {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function isEncrypted(raw: unknown): boolean { return Encrypted.safeParse(raw).success; }
export async function decryptBackup(raw: unknown, pass: string): Promise<unknown> {
  const e = Encrypted.parse(raw);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, await key(pass, unb64(e.salt)), unb64(e.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

export async function wipeAll(d: BodyDB = db) {
  await d.transaction('rw', TABLES.map((t) => d.table(t)), async () => { for (const t of TABLES) await d.table(t).clear(); });
}
