/**
 * „Co mam teraz zjeść?” — propozycje 2–3 posiłków dopasowanych do pozostałego bilansu dnia.
 * Same reguły i matematyka; wartości liczą istniejące funkcje (recipeTotals, scaleNutrients), wpisy tworzą recipeEntry/productEntry.
 */
import { scaleNutrients, ZERO } from './calc';
import { COVERAGE_MIN, type DayIntake } from './intake';
import { adaptForProfile, recipeEntry, productEntry, recipeTotals } from './recipes';
import type { ProductMap } from './nutrition';
import type { DayTargets } from './targets';
import type { FoodEntry, FoodProduct, MacroKey, MealSlot, Nutrients, Recipe, RecipeItem } from './types';
import type { Usage } from './foodSearch';

const MACROS: MacroKey[] = ['protein', 'fat', 'carbs', 'fiber'];
const MACRO_PL: Record<MacroKey, string> = { protein: 'białko', fat: 'tłuszcz', carbs: 'węglowodany', fiber: 'błonnik' };

export interface Remaining {
  kcal: number; protein: number; fat: number; carbs: number; fiber: number;
  /** makro, których dzisiejsze spożycie nie jest znane w ≥80% (pozostała ilość niepewna) */
  uncertain: MacroKey[];
  mealsLeft: number;
  /** budżet na ten posiłek */
  mealKcal: number; mealProtein: number;
  state: 'ok' | 'almost_done' | 'over';
  notes: string[];
}

/** Pozostały bilans dnia i budżet następnego posiłku. Brak wpisów = nic nie zjedzone (z wyraźną informacją). */
export function remainingFor(t: DayTargets, eaten: DayIntake | undefined, mealsPerDay: number): Remaining {
  const e = eaten ?? { ...ZERO, meals: 0, entries: 0, coverage: { protein: 1, fat: 1, carbs: 1, fiber: 1 } };
  const uncertain = MACROS.filter((k) => e.coverage[k] < COVERAGE_MIN);
  const notes: string[] = [];
  if (!eaten || eaten.entries === 0) notes.push('Brak wpisów z tego dnia: liczę, jakby nic nie było zjedzone. Jeśli coś jadłeś, dodaj to najpierw.');
  if (uncertain.length) notes.push(`Dzisiejsze ${uncertain.map((k) => MACRO_PL[k]).join(', ')} znane tylko częściowo: pozostała ilość jest przybliżona.`);
  const rem = { kcal: t.kcal - e.kcal, protein: t.proteinG - e.protein, fat: t.fatG - e.fat, carbs: t.carbsG - e.carbs, fiber: t.fiberG - e.fiber };
  const mealsLeft = Math.max(1, mealsPerDay - e.meals);
  const state: Remaining['state'] = rem.kcal < 0 ? 'over' : rem.kcal < 150 ? 'almost_done' : 'ok';
  if (state === 'over') notes.push(`Cel kalorii przekroczony o ${Math.round(-rem.kcal)} kcal. Bez dodatkowego posiłku; jutro zwykły plan, bez odrabiania.`);
  if (state === 'almost_done') notes.push(`Zostało ${Math.round(rem.kcal)} kcal: cel praktycznie osiągnięty.`);
  const mealKcal = state === 'ok' ? Math.min(rem.kcal, Math.max(250, rem.kcal / mealsLeft)) : 0;
  const mealProtein = Math.max(0, rem.protein) / mealsLeft;
  return { ...rem, uncertain, mealsLeft, mealKcal, mealProtein, state, notes };
}

export type SuggestionSource =
  | { kind: 'recipe'; recipe: Recipe; portions: number }
  | { kind: 'template'; templateName: string; mealName: string; items: RecipeItem[] }
  | { kind: 'product'; product: FoodProduct; grams: number };

export interface MealSuggestion {
  id: string;
  title: string;
  portionLabel: string;
  source: SuggestionSource;
  nutrients: Nutrients;
  /** udział kcal ze znanym makro (0–1) */
  coverage: Record<MacroKey, number>;
  reasons: string[];
  warnings: string[];
  score: number;
}

export interface SuggestInput {
  products: ProductMap;
  recipes: Recipe[];
  templates: { name?: string; id: string; meals: { name: string; items: RecipeItem[] }[] }[];
  favorites: FoodProduct[];
  usage: Map<string, Usage>;
  rem: Remaining;
  t: DayTargets;
  todayProductIds: Set<string>;
  dairyFree: boolean;
  /** gotowe przepisy (biblioteka); własne przepisy użytkownika mają pierwszeństwo przy podobnym dopasowaniu */
  library?: Recipe[];
  /** pora posiłku: gotowe przepisy z pasującą porą wyżej */
  slot?: MealSlot;
  /** propozycje ukryte przez użytkownika („Nie proponuj”) */
  hidden?: string[];
  /** z raportu tygodnia: najpierw szybkie przepisy */
  preferQuick?: boolean;
}

interface Raw { id: string; title: string; meal?: MealSlot; minutes?: number; lib?: boolean; libChanges?: string[]; base: Nutrients; unknownKcal: Partial<Record<MacroKey, number>>; items: RecipeItem[]; missing: number; make: (f: number) => { source: SuggestionSource; portionLabel: string; factor: number }; usageKey: string[]; productIds: string[] }

/** Skala porcji do budżetu kcal, zaokrąglona do kroku i ograniczona. */
function fitFactor(baseKcal: number, kcal: number, step: number, min: number, max: number): number {
  if (baseKcal <= 0) return 1;
  return Math.min(max, Math.max(min, Math.round(kcal / baseKcal / step) * step));
}

/** Propozycje posiłków: przepisy (porcje), posiłki z szablonów (gramatury skalowane), przy małym budżecie także pojedyncze produkty. */
export function suggestMeals(i: SuggestInput, limit = 3): MealSuggestion[] {
  const { rem, products } = i;
  if (rem.state !== 'ok') return [];
  const raws: Raw[] = [];
  const own = new Set(i.recipes.map((r) => r.libraryId).filter(Boolean));
  const libs = (i.library ?? []).filter((r) => !own.has(r.id)).flatMap((r) => { const a = adaptForProfile(r, products, i.dairyFree); return a.ok ? [{ r: a.recipe, lib: true, changes: a.changes }] : []; });
  for (const { r, lib, changes } of [...i.recipes.map((r) => ({ r, lib: false, changes: [] as string[] })), ...libs]) {
    if (!r.items.length) continue;
    const tot = recipeTotals(products, r.items, r.servings);
    const per = tot.perServing;
    const s = Math.max(1, r.servings);
    raws.push({ id: `r:${r.id}`, title: r.name, meal: r.meal, minutes: r.minutes, lib, libChanges: changes, base: per, unknownKcal: Object.fromEntries(Object.entries(tot.unknownKcal).map(([k, v]) => [k, (v ?? 0) / s])), items: r.items, missing: tot.missing.length,
      make: (f) => ({ source: { kind: 'recipe', recipe: r, portions: f }, portionLabel: `${f} porc.`, factor: f }), usageKey: [`recipe:${r.id}`], productIds: r.items.map((x) => x.productId) });
  }
  const seenMeals = new Set<string>();
  for (const tpl of i.templates) for (const m of tpl.meals) {
    const key = m.items.map((x) => `${x.productId}:${x.grams}`).sort().join('|');
    if (!m.items.length || seenMeals.has(key)) continue;
    seenMeals.add(key);
    const tot = recipeTotals(products, m.items, 1);
    raws.push({ id: `t:${tpl.id}:${m.name}`, title: m.name, base: tot.total, unknownKcal: tot.unknownKcal, items: m.items, missing: tot.missing.length,
      make: (f) => ({ source: { kind: 'template', templateName: tpl.name ?? `Dzień ${tpl.id}`, mealName: m.name, items: m.items.map((x) => ({ ...x, grams: Math.max(1, Math.round(x.grams * f)) })) }, portionLabel: f === 1 ? 'jak w szablonie' : `${Math.round(f * 100)}% gramatur szablonu`, factor: f }),
      usageKey: m.items.map((x) => x.productId), productIds: m.items.map((x) => x.productId) });
  }
  if (rem.mealKcal <= 450) {
    const pool = [...i.favorites, ...[...i.usage.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15).map(([id]) => products.get(id)).filter((p): p is FoodProduct => !!p)];
    const seen = new Set<string>();
    for (const p of pool) {
      if (seen.has(p.id) || p.per100.kcal <= 0) continue;
      seen.add(p.id);
      const unit = p.unit?.grams ?? 100;
      raws.push({ id: `p:${p.id}`, title: p.name, base: scaleNutrients(p.per100, unit), unknownKcal: Object.fromEntries((p.unknown ?? []).map((k) => [k, scaleNutrients(p.per100, unit).kcal])), items: [{ productId: p.id, grams: unit }], missing: 0,
        make: (f) => { const g = Math.max(5, Math.round((unit * f) / 5) * 5); return { source: { kind: 'product', product: p, grams: g }, portionLabel: `${g} g`, factor: g / unit }; }, usageKey: [p.id], productIds: [p.id] });
    }
  }

  const out: MealSuggestion[] = [];
  for (const raw of raws) {
    if (i.hidden?.includes(raw.id)) continue;
    const prods = raw.productIds.map((id) => products.get(id)).filter((p): p is FoodProduct => !!p);
    if (prods.some((p) => p.tolerance === 'bad')) continue;                       // źle tolerowane: nie proponujemy
    if (i.dairyFree && prods.some((p) => p.dairy === 'contains')) continue;      // dieta bez nabiału
    const isRecipe = raw.id.startsWith('r:');
    const f0 = fitFactor(raw.base.kcal, i.rem.mealKcal, isRecipe ? 0.25 : 0.05, isRecipe ? 0.5 : 0.5, isRecipe ? 3 : 1.6);
    const { source, portionLabel, factor } = raw.make(f0);
    const n = scaleNutrients(raw.base, factor * 100);
    const coverage = Object.fromEntries(MACROS.map((k) => [k, n.kcal > 0 ? Math.max(0, 1 - ((raw.unknownKcal[k] ?? 0) * factor) / n.kcal) : 1])) as Record<MacroKey, number>;
    const reasons: string[] = [], warnings: string[] = [];
    let score = 0;
    // kcal: na tyle blisko budżetu posiłku i nie ponad pozostały bilans
    const kcalDev = Math.abs(n.kcal - rem.mealKcal) / Math.max(1, rem.mealKcal);
    score -= kcalDev * 40;
    if (n.kcal > rem.kcal * 1.05) { score -= 60; warnings.push(`Przekracza pozostałe ${Math.round(rem.kcal)} kcal.`); }
    // białko: najważniejsze, gdy zostało go dużo
    const pKnown = coverage.protein >= COVERAGE_MIN && !rem.uncertain.includes('protein');
    if (rem.protein > 0) {
      const share = Math.min(1.5, n.protein / Math.max(1, rem.mealProtein));
      score += Math.min(share, 1.2) * 45;
      if (n.protein >= rem.mealProtein * 0.8) reasons.push(`Uzupełnia białko: ${Math.round(n.protein)} g (zostało ${Math.round(rem.protein)} g${rem.mealsLeft > 1 ? ` na ${rem.mealsLeft} posiłki` : ''}).`);
    } else reasons.push('Białko na dziś już zrealizowane.');
    // tłuszcz i węglowodany: kara za przekroczenie pozostałych
    if (rem.fat >= 0 && n.fat > Math.max(10, rem.fat) * 1.15) { score -= 15; warnings.push(`Tłuszcz ${Math.round(n.fat)} g przy pozostałych ${Math.max(0, Math.round(rem.fat))} g.`); }
    if (n.carbs > Math.max(15, rem.carbs) * 1.15) { score -= 12; warnings.push(`Węglowodany ${Math.round(n.carbs)} g przy pozostałych ${Math.max(0, Math.round(rem.carbs))} g.`); }
    if (i.t.carbsPerMealMaxG && n.carbs > i.t.carbsPerMealMaxG) { score -= 15; warnings.push(`Więcej niż ${i.t.carbsPerMealMaxG} g węglowodanów na posiłek (ustawienie insulinooporności).`); }
    if (i.preferQuick && raw.minutes !== undefined) { if (raw.minutes <= 15) { score += 10; reasons.push(`Szybkie: ok. ${raw.minutes} min.`); } else if (raw.minutes > 25) score -= 8; }
    if (i.t.dayType === 'training' && rem.carbs > 60 && n.carbs >= 40) { score += 6; reasons.push('Dzień treningowy: posiłek z węglowodanami.'); }
    if (rem.fiber > 5 && n.fiber >= 6 && coverage.fiber >= COVERAGE_MIN) { score += 6; reasons.push(`Błonnik ${Math.round(n.fiber)} g (zostało ${Math.round(rem.fiber)} g).`); }
    // znane, lubiane, ale bez powtarzania tego samego dnia
    const used = raw.usageKey.reduce((a, k) => a + (i.usage.get(k)?.count ?? 0), 0);
    if (used) { score += Math.min(10, used * 2); }
    if (isRecipe && !raw.lib) { score += 5; reasons.push('Twój przepis.'); }
    if (raw.lib) { reasons.push('Prosty przepis domowy.'); if (raw.libChanges?.length) reasons.push(`Dopasowany do Ciebie: ${raw.libChanges.join(', ')}.`); }
    if (i.slot && raw.meal) { if (raw.meal === i.slot) { score += 8; } else if (!(i.slot === 'dinner' && raw.meal === 'lunch')) score -= 12; }
    if (raw.id.startsWith('p:') && prods[0]?.favorite) { score += 6; reasons.push('Ulubiony produkt.'); }
    if (raw.productIds.some((id) => i.todayProductIds.has(id)) && raw.id.startsWith('p:')) score -= 8;
    if (raw.usageKey.some((k) => i.todayProductIds.has(k))) { score -= 10; warnings.push('Było już dziś.'); }
    // niepełne dane: informacja i niższa pozycja, nie fałszywa dokładność
    const low = MACROS.filter((k) => coverage[k] < 1);
    if (raw.missing) { score -= 25; warnings.push('Część składników nie jest w bazie: wartości niepełne.'); }
    if (low.length) { score -= low.filter((k) => k !== 'fiber').length * 8 + (low.includes('fiber') ? 2 : 0); warnings.push(`Niepełne dane: ${low.map((k) => MACRO_PL[k]).join(', ')}.`); }
    if (prods.some((p) => p.reliability === 'estimate')) warnings.push('Wartości szacunkowe.');
    if (i.dairyFree && prods.some((p) => p.dairy === 'unknown')) warnings.push('Skład niepewny pod kątem mleka.');
    if (!pKnown && rem.protein > 0) reasons.push('Białko przybliżone.');
    if (kcalDev <= 0.15 && n.kcal <= rem.kcal * 1.05) reasons.unshift(`Mieści się w budżecie posiłku (~${Math.round(rem.mealKcal)} kcal).`);
    out.push({ id: raw.id, title: raw.title, portionLabel, source, nutrients: n, coverage, reasons, warnings, score });
  }
  // najlepsze, z różnorodnością: najpierw maks. 2 z jednego typu źródła, wolne miejsca uzupełniane resztą
  const sorted = out.sort((a, b) => b.score - a.score);
  const picked: MealSuggestion[] = [];
  const perKind: Record<string, number> = {};
  for (const s of sorted) {
    if (picked.length >= limit) break;
    if ((perKind[s.source.kind] ?? 0) >= 2) continue;
    picked.push(s); perKind[s.source.kind] = (perKind[s.source.kind] ?? 0) + 1;
  }
  for (const s of sorted) { if (picked.length >= limit) break; if (!picked.includes(s)) picked.push(s); }
  return picked.sort((a, b) => b.score - a.score);
}

/** Wpisy do dziennika dla wybranej propozycji (istniejące funkcje tworzenia wpisów, snapshot wartości). */
export function entriesFor(s: MealSuggestion, products: ProductMap, date: string, meal: number, newId: () => string, t: number): FoodEntry[] {
  const src = s.source;
  if (src.kind === 'recipe') return [recipeEntry(src.recipe, products, src.portions, date, meal, newId(), t)];
  if (src.kind === 'product') return [productEntry(src.product, src.grams, date, meal, newId(), t)];
  return src.items.flatMap((it) => { const p = products.get(it.productId); return p ? [productEntry(p, it.grams, date, meal, newId(), t, 'template')] : []; });
}

/** Numer następnego posiłku: pierwszy wolny w zakresie planu, inaczej ostatni. */
export function nextMealNumber(entries: FoodEntry[], mealsPerDay: number): number {
  const used = new Set(entries.map((e) => e.meal));
  for (let m = 1; m <= Math.min(5, Math.max(1, mealsPerDay)); m++) if (!used.has(m)) return m;
  return Math.min(5, Math.max(1, mealsPerDay));
}

