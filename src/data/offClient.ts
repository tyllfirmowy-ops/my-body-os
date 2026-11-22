import { offToProduct, offUrls, type OffProduct } from '../domain/off';
import type { FoodProduct } from '../domain/types';

async function get(url: string, ms = 9000): Promise<unknown> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function offByBarcode(code: string): Promise<FoodProduct | null> {
  const j = (await get(offUrls.barcode(code))) as { status?: number; product?: OffProduct };
  return j.status === 1 && j.product ? offToProduct({ ...j.product, code }) : null;
}

export async function offSearch(q: string): Promise<FoodProduct[]> {
  const seen = new Set<string>();
  const map = (j: { products?: OffProduct[] }) => (j.products ?? []).map(offToProduct).filter((p): p is FoodProduct => !!p && !seen.has(p.id) && !!seen.add(p.id));
  const pl = map((await get(offUrls.search(q), 12000)) as { products?: OffProduct[] });
  if (pl.length >= 5) return pl;
  try { return [...pl, ...map((await get(offUrls.search(q, false), 12000)) as { products?: OffProduct[] })]; } catch { return pl; }
}
