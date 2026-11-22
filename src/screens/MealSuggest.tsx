import { useMemo, useState } from 'react';
import { db, now, uid } from '../db/db';
import type { AppData } from '../db/repo';
import { DAY_TEMPLATES } from '../data/foods';
import { usageFrom } from '../domain/foodSearch';
import { sumDay } from '../domain/intake';
import { entriesFor, nextMealNumber, remainingFor, suggestMeals, type MealSuggestion } from '../domain/mealSuggest';
import { effectiveTemplates } from '../domain/recipes';
import type { DayTargets } from '../domain/targets';
import { Badge, Btn, cx, Sheet, toast } from '../ui/kit';

const MEALS = ['Posiłek 1', 'Posiłek 2', 'Posiłek 3', 'Posiłek 4', 'Przekąska'];
const r0 = (x: number) => Math.round(x);

/** Arkusz „Co mam teraz zjeść?”: pozostały bilans + 2–3 propozycje z dodaniem jednym dotknięciem. */
export function MealSuggestSheet({ data, date, t, mealsPerDay, onClose }: { data: AppData; date: string; t: DayTargets; mealsPerDay: number; onClose: () => void }) {
  const products = useMemo(() => new Map(data.foods.map((f) => [f.id, f])), [data.foods]);
  const dayEntries = data.entries.filter((e) => e.date === date);
  const rem = remainingFor(t, sumDay(dayEntries), mealsPerDay);
  const [meal, setMeal] = useState(() => nextMealNumber(dayEntries, mealsPerDay));
  const suggestions = suggestMeals({
    products, recipes: data.recipes, templates: effectiveTemplates(DAY_TEMPLATES, data.mealTemplates),
    favorites: data.foods.filter((f) => f.favorite), usage: usageFrom(data.entries), rem, t,
    todayProductIds: new Set(dayEntries.map((e) => e.productId)), dairyFree: !!data.health?.dairyAvoid,
  });

  async function add(s: MealSuggestion) {
    const rows = entriesFor(s, products, date, meal, uid, now());
    if (!rows.length) return toast('Brak produktów w bazie');
    await db.entries.bulkAdd(rows);
    toast(`Dodano do: ${MEALS[meal - 1]}`); onClose();
  }
  return (
    <Sheet open onClose={onClose} title="Co mam teraz zjeść?">
      <div className="rounded-xl bg-card2 p-3 text-sm num">
        <div>Zostało: <b>{r0(Math.max(0, rem.kcal))} kcal</b> · B {r0(Math.max(0, rem.protein))} · T {r0(Math.max(0, rem.fat))} · W {r0(Math.max(0, rem.carbs))} g</div>
        {rem.state === 'ok' && <div className="text-xs text-muted">Na ten posiłek ~{r0(rem.mealKcal)} kcal i ~{r0(rem.mealProtein)} g białka ({rem.mealsLeft} {rem.mealsLeft === 1 ? 'posiłek' : 'posiłki'} do końca dnia{t.dayType === 'training' ? ', dzień treningowy' : t.dayType === 'rest' ? ', dzień bez treningu' : ''}).</div>}
        {rem.notes.map((n) => <div key={n} className="text-xs text-warn mt-1">{n}</div>)}
      </div>
      {rem.state === 'ok' && <div className="flex gap-1 flex-wrap">{MEALS.map((m, i) => <button key={m} onClick={() => setMeal(i + 1)} className={cx('px-3 py-1.5 rounded-lg text-xs', meal === i + 1 ? 'bg-accent text-accent-ink' : 'bg-card2')}>{m}</button>)}</div>}
      {rem.state === 'ok' && !suggestions.length && <p className="text-sm text-muted">Brak pasujących propozycji. Dodaj przepisy, ulubione produkty albo szablony posiłków (bez produktów źle tolerowanych).</p>}
      {suggestions.map((s, i) => (
        <div key={s.id} className={cx('rounded-xl border p-3 space-y-1.5', i === 0 ? 'border-accent' : 'border-line')}>
          <div className="flex items-start justify-between gap-2">
            <div><div className="font-semibold">{s.title}</div><div className="text-xs text-muted">{s.portionLabel}{s.source.kind === 'template' ? ` · z szablonu ${s.source.templateName}` : s.source.kind === 'recipe' ? ' · przepis' : ' · produkt'}</div></div>
            {i === 0 && <Badge tone="accent">najlepiej pasuje</Badge>}
          </div>
          <div className="text-sm num">{r0(s.nutrients.kcal)} kcal · B {r0(s.nutrients.protein)} · T {r0(s.nutrients.fat)} · W {r0(s.nutrients.carbs)} · Bł {r0(s.nutrients.fiber)}</div>
          {s.source.kind === 'template' && <div className="text-xs text-muted">{s.source.items.map((it) => `${products.get(it.productId)?.name ?? '?'} ${it.grams} g`).join(' · ')}</div>}
          {s.reasons.slice(0, 3).map((x) => <div key={x} className="text-xs text-muted">✓ {x}</div>)}
          {s.warnings.map((x) => <div key={x} className="text-xs text-warn">! {x}</div>)}
          <Btn className="w-full mt-1" kind={i === 0 ? 'primary' : 'soft'} onClick={() => add(s)}>Dodaj do: {MEALS[meal - 1]}</Btn>
        </div>
      ))}
      <p className="text-xs text-muted">Propozycje z Twoich przepisów, szablonów i ulubionych produktów, liczone z ich wartości. Produkty źle tolerowane są pomijane.</p>
    </Sheet>
  );
}
