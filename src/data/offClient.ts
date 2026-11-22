import { offToProduct, offUrls, type OffProduct } from '../domain/off';
import { barcodeKey, cacheGet, cacheSet, searchKey, TTL, type KV } from '../domain/offCache';
import type { FoodProduct } from '../domain/types';

export type OffErrorKind = 'offline' | 'rate_limit' | 'timeout' | 'server' | 'network' | 'too_short';
export class OffError extends Error {
  constructor(public kind: OffErrorKind, public retryAt?: number) { super(kind); }
}
export const OFF_MESSAGES: Record<OffErrorKind, string> = {
  offline: 'Brak internetu. Szukaj w swojej bazie albo dodaj produkt z etykiety.',
  rate_limit: 'Open Food Facts ogranicza liczbę zapytań. Spróbuj za minutę.',
  timeout: 'Open Food Facts nie odpowiada. Spróbuj ponownie lub dodaj produkt z etykiety.',
  server: 'Błąd po stronie Open Food Facts. Spróbuj później.',
  network: 'Nie udało się połączyć z Open Food Facts.',
  too_short: 'Wpisz co najmniej 3 litery.',
};

const kv = (): KV | undefined => { try { return typeof localStorage !== 'undefined' ? localStorage : undefined; } catch { return undefined; } };
let cooldownUntil = 0;
const COOLDOWN_MS = 60_000;

async function get(url: string, ms = 9000): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OffError('offline');
  if (Date.now() < cooldownUntil) throw new OffError('rate_limit', cooldownUntil);
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
    if (r.status === 429) { cooldownUntil = Date.now() + COOLDOWN_MS; throw new OffError('rate_limit', cooldownUntil); }
    if (r.status >= 500) throw new OffError('server');
    if (!r.ok) throw new OffError('network');
    return await r.json();
  } catch (e) {
    if (e instanceof OffError) throw e;
    if ((e as Error).name === 'AbortError') throw new OffError('timeout');
    throw new OffError('network');
  } finally { clearTimeout(t); }
}

export async function offByBarcode(code: string): Promise<FoodProduct | null> {
  const store = kv(); const key = barcodeKey(code);
  const hit = store && cacheGet<FoodProduct | null>(store, key, Date.now());
  if (hit !== undefined && store) return hit;
  const j = (await get(offUrls.barcode(code))) as { status?: number; product?: OffProduct };
  const p = j.status === 1 && j.product ? offToProduct({ ...j.product, code }) : null;
  if (store) cacheSet(store, key, p, p ? TTL.barcode : TTL.miss, Date.now());
  return p;
}

/** Wyszukiwanie online (najpierw Polska, potem świat). Wynik w cache na 3 dni; całej bazy nie pobieramy. */
export async function offSearch(q: string): Promise<{ products: FoodProduct[]; cached: boolean }> {
  const query = q.trim();
  if (query.length < 3) throw new OffError('too_short');
  const store = kv(); const key = searchKey(query);
  const hit = store && cacheGet<FoodProduct[]>(store, key, Date.now());
  if (hit) return { products: hit, cached: true };
  const map = (j: { products?: OffProduct[] }) => (j.products ?? []).map(offToProduct).filter((p): p is FoodProduct => !!p);
  let out = map((await get(offUrls.search(query), 12000)) as { products?: OffProduct[] });
  if (out.length < 5) { try { out = [...out, ...map((await get(offUrls.search(query, false), 12000)) as { products?: OffProduct[] })]; } catch { /* zostają wyniki z PL */ } }
  if (store) cacheSet(store, key, out, TTL.search, Date.now());
  return { products: out, cached: false };
}
