/** Prosty cache z terminem ważności i limitem wpisów (LRU po czasie zapisu). Magazyn wstrzykiwany (localStorage w aplikacji, mapa w testach). */
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
const PREFIX = 'off-cache:';
const INDEX = 'off-cache-index';
export const TTL = { search: 3 * 864e5, barcode: 30 * 864e5, miss: 864e5 } as const;
export const MAX_ENTRIES = 60;

export function cacheGet<T>(kv: KV, key: string, now: number): T | undefined {
  try {
    const raw = kv.getItem(PREFIX + key);
    if (!raw) return undefined;
    const e = JSON.parse(raw) as { t: number; ttl: number; v: T };
    if (now - e.t > e.ttl) { kv.removeItem(PREFIX + key); return undefined; }
    return e.v;
  } catch { return undefined; }
}

export function cacheSet<T>(kv: KV, key: string, v: T, ttl: number, now: number): void {
  try {
    let idx: string[] = JSON.parse(kv.getItem(INDEX) ?? '[]');
    idx = [key, ...idx.filter((k) => k !== key)];
    for (const old of idx.slice(MAX_ENTRIES)) kv.removeItem(PREFIX + old);
    idx = idx.slice(0, MAX_ENTRIES);
    kv.setItem(PREFIX + key, JSON.stringify({ t: now, ttl, v }));
    kv.setItem(INDEX, JSON.stringify(idx));
  } catch { /* pełny magazyn: cache jest opcjonalny */ }
}

export const searchKey = (q: string) => 's:' + q.trim().toLowerCase().replace(/\s+/g, ' ');
export const barcodeKey = (c: string) => 'b:' + c;
