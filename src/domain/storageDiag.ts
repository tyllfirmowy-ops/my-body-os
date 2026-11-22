/** Diagnostyka pamięci przeglądarki (IndexedDB) i przypomnienie o kopii. Czyste funkcje; magazyn logu wstrzykiwany. */
import type { KV } from './offCache';

export interface StorageError { t: number; name: string; quota: boolean }
const LOG_KEY = 'storage-errors';
export const LOG_MAX = 20;

const STORAGE_ERRORS = new Set(['QuotaExceededError', 'DatabaseClosedError', 'OpenFailedError', 'InvalidStateError', 'UnknownError', 'VersionError', 'AbortError', 'DataError', 'ConstraintError', 'ReadOnlyError', 'TransactionInactiveError', 'MissingAPIError']);

/** Czy błąd dotyczy zapisu/odczytu bazy; zwraca tylko nazwę (bez treści danych). */
export function classifyStorageError(e: unknown): Omit<StorageError, 't'> | null {
  const x = e as { name?: string; inner?: { name?: string } } | null;
  const name = x?.inner?.name && STORAGE_ERRORS.has(x.inner.name) ? x.inner.name : x?.name;
  if (!name || !STORAGE_ERRORS.has(name)) return null;
  // AbortError bez kontekstu Dexie (np. przerwany fetch) nie jest błędem bazy
  if (name === 'AbortError' && !x?.inner && !(x as { message?: string })?.message?.toLowerCase().includes('transaction')) return null;
  return { name, quota: name === 'QuotaExceededError' };
}

export function logStorageError(kv: KV, err: Omit<StorageError, 't'>, t: number): void {
  try {
    const list = readStorageErrors(kv);
    kv.setItem(LOG_KEY, JSON.stringify([{ ...err, t }, ...list].slice(0, LOG_MAX)));
  } catch { /* przy pełnej pamięci log też może się nie zapisać */ }
}
export function readStorageErrors(kv: KV): StorageError[] {
  try { const v = JSON.parse(kv.getItem(LOG_KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function clearStorageErrors(kv: KV): void { try { kv.removeItem(LOG_KEY); } catch { /* brak */ } }

export interface StorageInfo {
  supported: boolean;      // jest IndexedDB
  persisted?: boolean;     // undefined = przeglądarka nie podaje
  usage?: number; quota?: number;
  standalone?: boolean;    // uruchomiona z ekranu głównego
  errors: StorageError[];
  writeTest?: { ok: boolean; ms?: number; error?: string };
}
export interface Diagnosis { level: 'ok' | 'info' | 'warn' | 'danger'; items: { level: 'ok' | 'info' | 'warn' | 'danger'; text: string }[] }

/** Ocena stanu pamięci z konkretnymi zaleceniami. Nie zgaduje wartości, których przeglądarka nie podaje. */
export function diagnose(s: StorageInfo, now: number): Diagnosis {
  const items: Diagnosis['items'] = [];
  if (!s.supported) items.push({ level: 'danger', text: 'IndexedDB niedostępne (np. tryb prywatny). Dane nie zostaną zapisane.' });
  if (s.writeTest && !s.writeTest.ok) items.push({ level: 'danger', text: `Test zapisu nieudany (${s.writeTest.error ?? 'błąd'}). Zrób kopię i nie wprowadzaj nowych danych do czasu wyjaśnienia.` });
  else if (s.writeTest?.ok) items.push({ level: 'ok', text: `Test zapisu udany (${s.writeTest.ms} ms).` });
  if (s.persisted === true) items.push({ level: 'ok', text: 'Pamięć oznaczona jako trwała: system nie powinien jej czyścić przy braku miejsca.' });
  else if (s.persisted === false) items.push({ level: 'info', text: s.standalone ? 'Pamięć nieoznaczona jako trwała. Przy braku miejsca system może usunąć dane: regularna kopia jest jedynym zabezpieczeniem.' : 'Pamięć nieoznaczona jako trwała, aplikacja otwarta w przeglądarce. Dodaj ją do ekranu głównego; Safari może usuwać dane stron nieużywanych przez 7 dni.' });
  else items.push({ level: 'info', text: 'Przeglądarka nie podaje, czy pamięć jest trwała.' });
  if (s.usage !== undefined && s.quota) {
    const pct = s.usage / s.quota;
    if (pct >= 0.9) items.push({ level: 'danger', text: `Zajęte ${Math.round(pct * 100)}% dostępnego limitu. Zrób kopię i zwolnij miejsce na telefonie.` });
    else if (pct >= 0.7) items.push({ level: 'warn', text: `Zajęte ${Math.round(pct * 100)}% dostępnego limitu.` });
  }
  const recent = s.errors.filter((e) => now - e.t < 7 * 864e5);
  if (recent.some((e) => e.quota)) items.push({ level: 'danger', text: 'W ostatnich 7 dniach zabrakło miejsca przy zapisie. Część zmian mogła się nie zapisać.' });
  else if (recent.length) items.push({ level: 'warn', text: `Błędy zapisu w ostatnich 7 dniach: ${recent.length} (${[...new Set(recent.map((e) => e.name))].join(', ')}).` });
  const order = ['ok', 'info', 'warn', 'danger'] as const;
  const level = items.reduce<Diagnosis['level']>((a, i) => (order.indexOf(i.level) > order.indexOf(a) ? i.level : a), 'ok');
  return { level, items };
}

/**
 * Przypomnienie o kopii w porannym check-inie: raz na każdy pełny cykl (domyślnie 7 dni) od ostatniego POTWIERDZONEGO zapisu.
 * „Za tydzień” chowa je do następnego cyklu; potwierdzenie kopii zaczyna liczenie od nowa.
 * Bez żadnej potwierdzonej kopii: od razu, a po odłożeniu znowu po 7 dniach.
 */
export function backupReminder(o: { confirmedAt?: number; dismissedKey?: string; now: number; everyDays?: number }): { due: boolean; key?: string; days?: number } {
  const every = Math.max(1, o.everyDays ?? 7);
  const day = 864e5;
  if (o.confirmedAt) {
    const days = Math.floor((o.now - o.confirmedAt) / day);
    if (days < every) return { due: false, days };
    const key = `c${o.confirmedAt}:${Math.floor(days / every)}`;
    return { due: key !== o.dismissedKey, key, days };
  }
  const m = o.dismissedKey?.match(/^n@(\d+)$/);
  const due = !m || o.now - Number(m[1]) >= every * day;
  return { due, key: `n@${o.now}` };
}
