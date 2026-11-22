import type { FoodProduct, MacroKey, Nutrients } from './types';

/**
 * Walidacja wartości z etykiety (na 100 g). Błędy = dane niemożliwe (produkt odrzucony), ostrzeżenia = dane podejrzane.
 * Makro z listy unknown nie jest sprawdzane (brak ≠ 0).
 */
export function validateNutrients(p: Nutrients, unknown: MacroKey[] = []): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const known = (k: MacroKey) => !unknown.includes(k);
  if (!(p.kcal >= 0 && p.kcal <= 950)) errors.push('kcal poza zakresem 0–950 na 100 g');
  for (const k of ['protein', 'fat', 'carbs', 'fiber'] as const) if (known(k) && !(p[k] >= 0 && p[k] <= 100)) errors.push(`${k} poza zakresem 0–100 g`);
  const sum = (['protein', 'fat', 'carbs'] as const).filter(known).reduce((a, k) => a + p[k], 0) + (known('fiber') ? p.fiber : 0);
  if (sum > 105) errors.push('suma makroskładników > 100 g na 100 g');
  if (p.sugar !== undefined && known('carbs') && p.sugar > p.carbs + 0.5) warnings.push('cukry większe niż węglowodany');
  if (p.satFat !== undefined && known('fat') && p.satFat > p.fat + 0.5) warnings.push('tłuszcze nasycone większe niż tłuszcz');
  if (unknown.every((k) => k === 'fiber')) {
    const est = p.protein * 4 + p.fat * 9 + p.carbs * 4 + (known('fiber') ? p.fiber * 2 : 0);
    if (Math.abs(est - p.kcal) > Math.max(25, p.kcal * 0.15)) warnings.push(`kcal z etykiety (${Math.round(p.kcal)}) nie zgadzają się z makro (~${Math.round(est)})`);
  }
  return { errors, warnings };
}

/** Mapowanie produktu z Open Food Facts na nasz format. Brak kcal = odrzucony; brak makro = oznaczony jako nieznany (nie zgadujemy i nie wpisujemy 0). */
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
  if (!Number.isFinite(kcal)) return null;
  const protein = n(nu['proteins_100g']), fat = n(nu['fat_100g']), carbs = n(nu['carbohydrates_100g']);
  const fiber = n(nu['fiber_100g']), sugar = n(nu['sugars_100g']), satFat = n(nu['saturated-fat_100g']), salt = n(nu['salt_100g']);
  const name = (p.product_name_pl || p.product_name || '').trim();
  if (!name) return null;
  const unknown = ([['protein', protein], ['fat', fat], ['carbs', carbs], ['fiber', fiber]] as [MacroKey, number][]).filter(([, v]) => !Number.isFinite(v)).map(([k]) => k);
  const ingredients = (p.ingredients_text_pl || p.ingredients_text || '').trim();
  const allergenMilk = [...(p.allergens_tags ?? []), ...(p.traces_tags ?? [])].some((t) => t.includes('milk'));
  const dairy: FoodProduct['dairy'] = (p.allergens_tags ?? []).some((t) => t.includes('milk')) || (ingredients && DAIRY_WORDS.test(ingredients))
    ? 'contains' : allergenMilk ? 'unknown' : ingredients ? 'none' : 'unknown';
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const v = (x: number) => (Number.isFinite(x) ? r1(x) : 0);
  const per100 = { kcal: Math.round(kcal), protein: v(protein), fat: v(fat), carbs: v(carbs), fiber: v(fiber),
    ...(Number.isFinite(sugar) ? { sugar: r1(sugar) } : {}), ...(Number.isFinite(satFat) ? { satFat: r1(satFat) } : {}), ...(Number.isFinite(salt) ? { salt: r1(salt) } : {}) };
  const check = validateNutrients(per100, unknown);
  if (check.errors.length) return null;
  const warnings = [...check.warnings, ...(ingredients ? [] : ['brak składu: nie wiadomo, czy zawiera mleko'])];
  const role: FoodProduct['role'] = unknown.some((k) => k !== 'fiber') ? 'mixed' : per100.protein * 4 >= per100.kcal * 0.3 ? 'protein' : per100.fat * 9 >= per100.kcal * 0.5 ? 'fat' : 'carb';
  const serving = parseServingGrams(p.serving_size);
  return {
    id: `off_${p.code ?? name.toLowerCase().replace(/\W+/g, '_')}`,
    name: p.brands ? `${name} (${p.brands.split(',')[0].trim()})` : name,
    brand: p.brands?.split(',')[0].trim(), barcode: p.code, ingredients: ingredients || undefined,
    per100, basis: 'as_sold', role, dairy, tolerance: 'unknown',
    source: `Open Food Facts${p.code ? `, kod ${p.code}` : ''} (dane z etykiety wprowadzone przez społeczność, sprawdź opakowanie)`,
    reliability: 'label', custom: true, updatedAt: Date.now(),
    ...(unknown.length ? { unknown } : {}), ...(warnings.length ? { labelWarnings: warnings } : {}),
    ...(serving ? { unit: { name: `porcja (${p.serving_size})`, grams: serving } } : {}),
  };
}

const FIELDS = 'code,product_name,product_name_pl,brands,quantity,serving_size,allergens_tags,traces_tags,ingredients_text_pl,ingredients_text,nutriments';
export const offUrls = {
  barcode: (code: string) => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
  search: (q: string, poland = true) => `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24${poland ? '&countries_tags_en=poland' : ''}&fields=${FIELDS}`,
};
