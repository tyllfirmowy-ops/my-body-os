import type { FoodProduct, Nutrients } from '../domain/types';

const REF = 'Wartość referencyjna (USDA FoodData Central / typowa etykieta PL, węglowodany bez błonnika). Sprawdź etykietę swojego produktu.';
const EST = 'Szacunek dla mieszanki warzyw (brokuł, papryka, cukinia, pomidor). Niska precyzja.';

type Seed = [id: string, name: string, n: [number, number, number, number, number], basis: FoodProduct['basis'], role: FoodProduct['role'], extra?: Partial<FoodProduct>];
const n = (a: [number, number, number, number, number]): Nutrients => ({ kcal: a[0], protein: a[1], fat: a[2], carbs: a[3], fiber: a[4] });

const seeds: Seed[] = [
  ['oats', 'Płatki owsiane', [372, 13.5, 7, 58.7, 10], 'dry', 'carb'],
  ['soy_drink', 'Napój sojowy niesłodzony z wapniem', [39, 3.3, 1.8, 0.7, 0.6], 'as_sold', 'protein', { unit: { name: 'szklanka 250 ml', grams: 250 } }],
  ['blueberries', 'Borówki', [57, 0.7, 0.3, 12.1, 2.4], 'raw', 'fruit'],
  ['peanut_butter', 'Masło orzechowe 100%', [600, 25, 50, 12, 6], 'as_sold', 'fat'],
  ['egg', 'Jajko kurze (L)', [140, 12.5, 9.7, 0.7, 0], 'raw', 'protein', { unit: { name: 'szt. (bez skorupki)', grams: 55 } }],
  ['chicken_raw', 'Pierś z kurczaka, surowa', [114, 23, 2, 0, 0], 'raw', 'protein'],
  ['chicken_cooked', 'Pierś z kurczaka, pieczona', [165, 31, 3.6, 0, 0], 'cooked', 'protein'],
  ['rice', 'Ryż biały, suchy', [350, 7, 0.6, 78, 1], 'dry', 'carb'],
  ['veg_mix', 'Warzywa (mieszanka)', [30, 1.5, 0.3, 4.5, 2.5], 'raw', 'veg', { source: EST, reliability: 'estimate' }],
  ['olive_oil', 'Oliwa z oliwek', [900, 0, 100, 0, 0], 'as_sold', 'fat', { unit: { name: 'łyżka', grams: 10 } }],
  ['rye_bread', 'Chleb żytni razowy', [220, 6, 1.5, 40, 8], 'as_sold', 'carb', { unit: { name: 'kromka', grams: 40 } }],
  ['turkey_ham', 'Pieczona pierś z indyka (wędlina)', [100, 20, 1.5, 1.5, 0], 'as_sold', 'protein', { dairy: 'unknown' }],
  ['hummus', 'Hummus', [290, 7, 23, 11, 5], 'as_sold', 'fat'],
  ['apple', 'Jabłko', [52, 0.3, 0.2, 12, 2.4], 'raw', 'fruit', { unit: { name: 'szt.', grams: 180 } }],
  ['salmon', 'Łosoś atlantycki, surowy', [208, 20, 13.4, 0, 0], 'raw', 'protein'],
  ['potato', 'Ziemniaki, surowe', [77, 2, 0.1, 15.7, 2.2], 'raw', 'carb'],
  ['avocado', 'Awokado', [160, 2, 14.7, 1.8, 6.7], 'raw', 'fat'],
  ['beef_5', 'Wołowina mielona 5%, surowa', [137, 21.4, 5, 0, 0], 'raw', 'protein'],
  ['ww_pasta', 'Makaron pełnoziarnisty, suchy', [350, 13, 2.5, 64, 8], 'dry', 'carb'],
  ['passata', 'Passata pomidorowa', [30, 1.5, 0.2, 5, 1.2], 'as_sold', 'veg'],
  ['tofu', 'Tofu naturalne', [130, 14, 7.5, 1.5, 0.5], 'as_sold', 'protein'],
  ['banana', 'Banan', [89, 1.1, 0.3, 20.2, 2.6], 'raw', 'fruit', { unit: { name: 'szt.', grams: 120 } }],
  ['walnuts', 'Orzechy włoskie', [654, 15, 65, 7, 6.7], 'as_sold', 'fat'],
  ['tuna', 'Tuńczyk w sosie własnym, po odsączeniu', [116, 25.5, 0.8, 0, 0], 'drained', 'protein'],
  ['chickpeas', 'Ciecierzyca z puszki, po odsączeniu', [120, 7, 2.5, 13.5, 6], 'drained', 'carb'],
  ['pork_tenderloin', 'Polędwiczka wieprzowa, surowa', [120, 21, 3.5, 0, 0], 'raw', 'protein'],
  ['buckwheat', 'Kasza gryczana, sucha', [343, 12.6, 3.1, 62, 6], 'dry', 'carb'],
  ['orange', 'Pomarańcza', [47, 0.9, 0.1, 9.4, 2.4], 'raw', 'fruit'],
  ['cocoa', 'Kakao naturalne', [350, 20, 11, 15, 30], 'as_sold', 'mixed', { unit: { name: 'łyżeczka', grams: 5 } }],
  ['dark_chocolate', 'Czekolada gorzka 70% (sprawdź skład: mleko)', [580, 9, 42, 34, 11], 'as_sold', 'mixed', { dairy: 'unknown' }],
  ['pea_protein', 'Białko roślinne (groch/ryż), proszek', [380, 78, 6, 4, 2], 'as_sold', 'protein', { unit: { name: 'miarka', grams: 30 } }],
];

export const SEED_FOODS: FoodProduct[] = seeds.map(([id, name, vals, basis, role, extra]) => ({
  id, name, per100: n(vals), basis, role,
  dairy: 'none', tolerance: 'unknown', source: REF, reliability: 'reference', updatedAt: 0, ...extra,
}));

export interface TemplateItem { productId: string; grams: number }
export interface MealTemplate { name: string; items: TemplateItem[] }
export interface DayTemplate { id: 'A' | 'B' | 'C'; meals: MealTemplate[] }

// Gramatury po przeliczeniu do ~2450 kcal / ≥165 g białka (patrz tests/nutrition.test.ts).
export const DAY_TEMPLATES: DayTemplate[] = [
  { id: 'A', meals: [
    { name: 'Owsianka', items: [{ productId: 'oats', grams: 65 }, { productId: 'soy_drink', grams: 250 }, { productId: 'blueberries', grams: 150 }, { productId: 'peanut_butter', grams: 15 }, { productId: 'egg', grams: 110 }] },
    { name: 'Kurczak z ryżem', items: [{ productId: 'chicken_raw', grams: 220 }, { productId: 'rice', grams: 75 }, { productId: 'veg_mix', grams: 250 }, { productId: 'olive_oil', grams: 5 }] },
    { name: 'Kanapki z indykiem', items: [{ productId: 'rye_bread', grams: 90 }, { productId: 'turkey_ham', grams: 130 }, { productId: 'hummus', grams: 40 }, { productId: 'apple', grams: 180 }, { productId: 'veg_mix', grams: 100 }] },
    { name: 'Łosoś z ziemniakami', items: [{ productId: 'salmon', grams: 140 }, { productId: 'potato', grams: 250 }, { productId: 'veg_mix', grams: 200 }, { productId: 'olive_oil', grams: 5 }] },
  ] },
  { id: 'B', meals: [
    { name: 'Jajka z pieczywem', items: [{ productId: 'egg', grams: 110 }, { productId: 'rye_bread', grams: 100 }, { productId: 'avocado', grams: 50 }, { productId: 'veg_mix', grams: 200 }, { productId: 'soy_drink', grams: 250 }] },
    { name: 'Spaghetti z wołowiną', items: [{ productId: 'beef_5', grams: 170 }, { productId: 'ww_pasta', grams: 90 }, { productId: 'passata', grams: 200 }, { productId: 'veg_mix', grams: 150 }, { productId: 'olive_oil', grams: 10 }] },
    { name: 'Słodki krem z tofu', items: [{ productId: 'tofu', grams: 200 }, { productId: 'banana', grams: 150 }, { productId: 'blueberries', grams: 100 }, { productId: 'walnuts', grams: 10 }] },
    { name: 'Sałatka z tuńczykiem', items: [{ productId: 'tuna', grams: 140 }, { productId: 'chickpeas', grams: 120 }, { productId: 'rye_bread', grams: 70 }, { productId: 'veg_mix', grams: 250 }, { productId: 'olive_oil', grams: 5 }] },
  ] },
  { id: 'C', meals: [
    { name: 'Owsianka z bananem', items: [{ productId: 'oats', grams: 65 }, { productId: 'soy_drink', grams: 250 }, { productId: 'banana', grams: 120 }, { productId: 'peanut_butter', grams: 15 }, { productId: 'egg', grams: 110 }] },
    { name: 'Polędwiczka z kaszą', items: [{ productId: 'pork_tenderloin', grams: 180 }, { productId: 'buckwheat', grams: 75 }, { productId: 'veg_mix', grams: 250 }, { productId: 'olive_oil', grams: 10 }] },
    { name: 'Kanapki z kurczakiem', items: [{ productId: 'rye_bread', grams: 80 }, { productId: 'chicken_cooked', grams: 120 }, { productId: 'hummus', grams: 30 }, { productId: 'veg_mix', grams: 150 }, { productId: 'orange', grams: 200 }] },
    { name: 'Tofu z ziemniakami', items: [{ productId: 'tofu', grams: 180 }, { productId: 'potato', grams: 230 }, { productId: 'veg_mix', grams: 250 }, { productId: 'olive_oil', grams: 5 }] },
  ] },
];

export const EMERGENCY_MEALS = [
  { where: 'Żabka / sklep', text: 'Kanapka lub wrap z kurczakiem bez sera i sosów na bazie jogurtu/majonezu, do tego banan i woda. Sprawdź skład pod kątem mleka i serwatki.' },
  { where: 'Stacja paliw', text: 'Hot dog bez sosów serowych lub wrap z kurczakiem; dołóż wodę i owoc. Unikaj sosów śmietanowych.' },
  { where: 'Restauracja', text: 'Grillowane mięso lub ryba + ryż/ziemniaki + warzywa. Poproś o sos osobno i bez masła/śmietany.' },
  { where: 'Samochód (przygotuj wcześniej)', text: 'Pojemnik z kurczakiem i ryżem z meal prepu albo 2 kanapki z indykiem + jabłko.' },
];
