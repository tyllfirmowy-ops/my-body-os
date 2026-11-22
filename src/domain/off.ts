import type { FoodProduct } from './types';

/** Mapowanie produktu z Open Food Facts na nasz format. Brak kcal lub makro = produkt odrzucony (nie zgadujemy). */
export interface OffProduct {
  code?: string; product_name?: string; product_name_pl?: string; brands?: string; quantity?: string; serving_size?: string;
  allergens_tags?: string[]; traces_tags?: string[]; ingredients_text_pl?: string; ingredients_text?: string;
  nutriments?: Record<string, number | string | undefined>;
}

const DAIRY_WORDS = /(mlek|mleczn|serwat|kazein|laktoz|maśl|masło|śmietan|jogurt|\bser\b|sery|twaróg|whey|casein|lactose|milk|butter|cream|cheese)/i;

const n = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN);

export function parseServingGrams(s?: string): number | undefined {
  if (!s) return undefined;
  const m = s.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  return m ? Math.round(Number(m[1])) : undefined;
}

export function offToProduct(p: OffProduct): FoodProduct | null {
  const nu = p.nutriments ?? {};
  let kcal = n(nu['energy-kcal_100g']);
  if (!Number.isFinite(kcal) && Number.isFinite(n(nu['energy_100g']))) kcal = n(nu['energy_100g']) / 4.184; // kJ → kcal
  const protein = n(nu['proteins_100g']), fat = n(nu['fat_100g']), carbs = n(nu['carbohydrates_100g']);
  if (![kcal, protein, fat, carbs].every(Number.isFinite)) return null;
  const fiber = n(nu['fiber_100g']), sugar = n(nu['sugars_100g']), satFat = n(nu['saturated-fat_100g']), salt = n(nu['salt_100g']);
  const name = (p.product_name_pl || p.product_name || '').trim();
  if (!name) return null;
  const ingredients = (p.ingredients_text_pl || p.ingredients_text || '').trim();
  const allergenMilk = [...(p.allergens_tags ?? []), ...(p.traces_tags ?? [])].some((t) => t.includes('milk'));
  const dairy: FoodProduct['dairy'] = (p.allergens_tags ?? []).some((t) => t.includes('milk')) || (ingredients && DAIRY_WORDS.test(ingredients))
    ? 'contains' : allergenMilk ? 'unknown' : ingredients ? 'none' : 'unknown';
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const per100 = { kcal: Math.round(kcal), protein: r1(protein), fat: r1(fat), carbs: r1(carbs), fiber: Number.isFinite(fiber) ? r1(fiber) : 0,
    ...(Number.isFinite(sugar) ? { sugar: r1(sugar) } : {}), ...(Number.isFinite(satFat) ? { satFat: r1(satFat) } : {}), ...(Number.isFinite(salt) ? { salt: r1(salt) } : {}) };
  const role: FoodProduct['role'] = per100.protein * 4 >= per100.kcal * 0.3 ? 'protein' : per100.fat * 9 >= per100.kcal * 0.5 ? 'fat' : 'carb';
  const serving = parseServingGrams(p.serving_size);
  return {
    id: `off_${p.code ?? name.toLowerCase().replace(/\W+/g, '_')}`,
    name: p.brands ? `${name} (${p.brands.split(',')[0].trim()})` : name,
    brand: p.brands?.split(',')[0].trim(), barcode: p.code, ingredients: ingredients || undefined,
    per100, basis: 'as_sold', role, dairy, tolerance: 'unknown',
    source: `Open Food Facts${p.code ? `, kod ${p.code}` : ''} (dane z etykiety wprowadzone przez społeczność, sprawdź opakowanie)`,
    reliability: 'label', custom: true, updatedAt: Date.now(),
    ...(serving ? { unit: { name: `porcja (${p.serving_size})`, grams: serving } } : {}),
  };
}

const FIELDS = 'code,product_name,product_name_pl,brands,quantity,serving_size,allergens_tags,traces_tags,ingredients_text_pl,ingredients_text,nutriments';
export const offUrls = {
  barcode: (code: string) => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
  search: (q: string, poland = true) => `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24${poland ? '&countries_tags_en=poland' : ''}&fields=${FIELDS}`,
};
