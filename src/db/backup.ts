import { z } from 'zod';
import { db, TABLES, type BodyDB, type TableName } from './db';

export const BACKUP_FORMAT = 'my-body-os-backup';
export const BACKUP_VERSION = 1;

const Backup = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: z.number(),
  encrypted: z.literal(false).optional(),
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

export async function exportAll(d: BodyDB = db) {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await d.table(t).toArray();
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), tables };
}

export type ImportResult = { ok: true; counts: Record<string, number> } | { ok: false; error: string };

export async function importAll(raw: unknown, d: BodyDB = db, mode: 'replace' | 'merge' = 'replace'): Promise<ImportResult> {
  const parsed = Backup.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Nieprawidłowy plik kopii zapasowej (format lub wersja).' };
  for (const [t, rows] of Object.entries(parsed.data.tables)) {
    if (!(TABLES as readonly string[]).includes(t)) return { ok: false, error: `Nieznana tabela: ${t}` };
    const check = keyCheck[t as TableName];
    if (check) for (const r of rows) if (!check.safeParse(r).success) return { ok: false, error: `Uszkodzony rekord w tabeli ${t}.` };
  }
  const counts: Record<string, number> = {};
  await d.transaction('rw', TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) {
      const rows = parsed.data.tables[t] ?? [];
      if (mode === 'replace') await d.table(t).clear();
      await d.table(t).bulkPut(rows);
      counts[t] = rows.length;
    }
  });
  return { ok: true, counts };
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
