import type { FoodEntry, FoodProduct } from './types';

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

export interface Usage { count: number; rank: number }
/** Użycie produktów z ostatnich wpisów: liczba użyć i pozycja (0 = najnowszy). */
export function usageFrom(entries: FoodEntry[], window = 300): Map<string, Usage> {
  const m = new Map<string, Usage>();
  [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, window).forEach((e) => {
    const u = m.get(e.productId);
    if (u) u.count++; else m.set(e.productId, { count: 1, rank: m.size });
  });
  return m;
}

/** Wynik dopasowania nazwy do zapytania; null = brak dopasowania. */
export function matchScore(name: string, q: string): number | null {
  const qw = words(q);
  if (!qw.length) return 0;
  const nw = words(name);
  const n = norm(name);
  let score = 0;
  for (const w of qw) {
    if (nw.some((x) => x === w)) score += 30;
    else if (nw.some((x) => x.startsWith(w))) score += 20;
    else if (n.includes(w)) score += 5;
    else return null;
  }
  if (nw[0]?.startsWith(qw[0])) score += 20;
  return score;
}

/** Ranking lokalny: trafność nazwy + ulubione + częstość/świeżość użycia; szacunki i niepełne makro niżej. */
export function rankLocal(foods: FoodProduct[], q: string, usage: Map<string, Usage>, limit = 60): FoodProduct[] {
  const scored: { f: FoodProduct; s: number }[] = [];
  const empty = !q.trim();
  for (const f of foods) {
    const m = matchScore(f.name, q);
    if (m === null) continue;
    const u = usage.get(f.id);
    let s = m + (f.favorite ? 35 : 0) + (u ? Math.min(30, u.count * 4) + Math.max(0, 20 - u.rank) : 0);
    if (f.reliability === 'estimate') s -= 45; // dania szacunkowe za produktami podstawowymi, chyba że zapytanie pasuje dokładniej
    if (f.unknown?.length) s -= 8;
    s -= f.name.length * 0.25;
    if (empty && !f.favorite && !u) s -= 1000; // bez zapytania: najpierw ulubione i ostatnie
    scored.push({ f, s });
  }
  return scored.sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name, 'pl')).slice(0, empty ? 30 : limit).map((x) => x.f);
}

/** Wyniki online bez duplikatów: pomija produkty już w bazie (ten sam kod lub id) i powtórzenia (kod, potem nazwa+marka). */
export function dedupeOnline(local: FoodProduct[], online: FoodProduct[]): FoodProduct[] {
  const codes = new Set(local.map((f) => f.barcode).filter(Boolean));
  const ids = new Set(local.map((f) => f.id));
  const seenCode = new Set<string>(), seenName = new Set<string>();
  return online.filter((p) => {
    if (ids.has(p.id) || (p.barcode && codes.has(p.barcode))) return false;
    if (p.barcode) { if (seenCode.has(p.barcode)) return false; seenCode.add(p.barcode); }
    const key = norm(p.name);
    if (seenName.has(key)) return false;
    seenName.add(key);
    return true;
  });
}
