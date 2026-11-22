import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Star, Trash2 } from 'lucide-react';
import { db, now, uid } from '../db/db';
import type { AppData } from '../db/repo';
import { DAY_TEMPLATES, type DayTemplate } from '../data/foods';
import { fitDayToTargets, swapProduct, type ProductMap } from '../domain/nutrition';
import { copyRecipe, intoleranceSwaps, portionsForKcal, recipeEntry, recipeTotals, scaleRecipe, validateTemplate } from '../domain/recipes';
import type { DayTargets } from '../domain/targets';
import type { MealTemplateRec, Nutrients, Recipe, RecipeItem } from '../domain/types';
import { Badge, Btn, Card, cx, Field, inputCls, NumInput, Sheet, toast } from '../ui/kit';
import { FoodPicker } from './FoodPicker';

const MEALS = ['Posiłek 1', 'Posiłek 2', 'Posiłek 3', 'Posiłek 4', 'Przekąska'];
const fmt = (n: Nutrients) => `${Math.round(n.kcal)} kcal · B ${Math.round(n.protein)} · T ${Math.round(n.fat)} · W ${Math.round(n.carbs)} · Bł ${Math.round(n.fiber)}`;

export function safeFit(products: ProductMap, tpl: DayTemplate, t: DayTargets) {
  try { return fitDayToTargets(products, tpl, { kcal: t.kcal, proteinG: t.proteinG, fatG: t.fatG, carbsG: t.carbsG }); } catch { return null; }
}

function Coverage({ c }: { c: Record<string, number> }) {
  const low = Object.entries(c).filter(([, v]) => v < 1).map(([k]) => ({ protein: 'białko', fat: 'tłuszcz', carbs: 'węgle', fiber: 'błonnik' }[k]));
  return low.length ? <p className="text-xs text-warn">Niepełne dane: {low.join(', ')} (część składników bez pełnej etykiety; brak ≠ 0).</p> : null;
}

function ItemsEditor({ items, products, data, onChange, dairyFree }: { items: RecipeItem[]; products: ProductMap; data: AppData; onChange: (i: RecipeItem[]) => void; dairyFree: boolean }) {
  const [pick, setPick] = useState(false);
  const swaps = intoleranceSwaps(products, items, dairyFree);
  return (
    <div className="space-y-1">
      {items.map((it, i) => {
        const p = products.get(it.productId);
        const sw = swaps.find((s) => s.index === i);
        return (
          <div key={i} className="border-b border-line py-1.5">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm">{p?.name ?? 'Produkt spoza bazy'}{p?.tolerance === 'bad' && <Badge tone="danger">źle tolerowany</Badge>}{p?.dairy === 'contains' && <Badge tone="warn">mleko</Badge>}{p?.unknown?.length ? <Badge tone="warn">niepełne makro</Badge> : null}</span>
              <div className="w-20"><NumInput value={it.grams} onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, grams: v ?? 0 } : x)))} /></div>
              <span className="text-xs text-muted">g</span>
              <button aria-label="Usuń składnik" className="p-1 text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </div>
            {sw && sw.alternatives.length > 0 && <div className="text-xs text-muted mt-1">Zamień na: {sw.alternatives.map((a) => (
              <button key={a.id} className="underline text-accent mr-2" onClick={() => onChange(items.map((x, j) => (j === i ? { productId: a.id, grams: swapProduct(sw.product, x.grams, a).grams } : x)))}>{a.name}</button>
            ))}</div>}
          </div>
        );
      })}
      <Btn kind="soft" className="w-full text-sm" onClick={() => setPick(true)}><Plus size={14} className="inline -mt-0.5" /> Dodaj składnik</Btn>
      {pick && <FoodPicker title="Dodaj składnik" foods={data.foods} entries={data.entries} onClose={() => setPick(false)} onNew={() => toast('Dodaj produkt w Diecie → Dodaj → Z etykiety')}
        onAdd={async (p, g) => { onChange([...items, { productId: p.id, grams: g }]); }} />}
    </div>
  );
}

export function RecipesSheet({ data, date, t, mealsPerDay, onClose }: { data: AppData; date: string; t: DayTargets; mealsPerDay: number; onClose: () => void }) {
  const [open, setOpen] = useState<Recipe | 'new' | null>(null);
  const list = [...data.recipes].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || a.name.localeCompare(b.name, 'pl'));
  const products = useMemo(() => new Map(data.foods.map((f) => [f.id, f])), [data.foods]);
  if (open) return <RecipeEditor recipe={open === 'new' ? undefined : open} data={data} products={products} date={date} t={t} mealsPerDay={mealsPerDay} onClose={() => setOpen(null)} onLogged={onClose} />;
  return (
    <Sheet open onClose={onClose} title="Moje przepisy">
      <Btn className="w-full" onClick={() => setOpen('new')}><Plus size={16} className="inline -mt-0.5" /> Nowy przepis</Btn>
      {!list.length && <p className="text-sm text-muted">Brak przepisów. Dodaj składniki z gramaturami, a aplikacja policzy porcję.</p>}
      {list.map((r) => { const tot = recipeTotals(products, r.items, r.servings); return (
        <Card key={r.id} onClick={() => setOpen(r)}>
          <div className="font-semibold">{r.favorite && <Star size={12} className="inline text-accent mr-1" />}{r.name}</div>
          <div className="text-xs text-muted num">{r.servings} porc. · porcja: {fmt(tot.perServing)}</div>
        </Card>
      ); })}
    </Sheet>
  );
}

function RecipeEditor({ recipe, data, products, date, t, mealsPerDay, onClose, onLogged }: { recipe?: Recipe; data: AppData; products: ProductMap; date: string; t: DayTargets; mealsPerDay: number; onClose: () => void; onLogged: () => void }) {
  const [r, setR] = useState<Recipe>(() => recipe ? structuredClone(recipe) : { id: uid(), name: '', servings: 1, items: [], createdAt: now(), updatedAt: now() });
  const [meal, setMeal] = useState(1);
  const tot = recipeTotals(products, r.items, r.servings, { dairyFree: !!data.health?.dairyAvoid });
  const suggested = portionsForKcal(tot, t.kcal / Math.max(1, mealsPerDay));
  const [portions, setPortions] = useState<number>(1);
  const [confirmDel, setConfirmDel] = useState(false);
  const valid = r.name.trim() && r.items.length && r.items.every((i) => i.grams > 0);
  const dirty = !recipe || JSON.stringify(recipe) !== JSON.stringify(r);

  async function save(close = true) {
    if (!valid) return toast('Podaj nazwę i składniki z gramaturą');
    await db.recipes.put({ ...r, name: r.name.trim(), updatedAt: now() });
    toast('Przepis zapisany'); if (close) onClose();
  }
  async function addToLog() {
    if (!valid) return;
    if (dirty) await db.recipes.put({ ...r, updatedAt: now() });
    await db.entries.add(recipeEntry(r, products, portions, date, meal, uid(), now()));
    toast(`Dodano: ${r.name}, ${portions} porc.`); onLogged();
  }
  return (
    <Sheet open onClose={onClose} title={recipe ? 'Przepis' : 'Nowy przepis'}>
      <Field label="Nazwa"><input className={inputCls} value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="np. Kurczak curry meal prep" /></Field>
      <div className="flex items-center gap-2">
        <span className="text-sm flex-1">Liczba porcji (gramatury proporcjonalnie)</span>
        <button className="w-9 h-9 rounded-lg bg-card2" onClick={() => r.servings > 1 && setR(scaleRecipe(r, r.servings - 1))}>−</button>
        <span className="num font-semibold w-6 text-center">{r.servings}</span>
        <button className="w-9 h-9 rounded-lg bg-card2" onClick={() => setR(scaleRecipe(r, r.servings + 1))}>+</button>
      </div>
      <ItemsEditor items={r.items} products={products} data={data} onChange={(items) => setR({ ...r, items })} dairyFree={!!data.health?.dairyAvoid} />
      <div className="rounded-xl bg-card2 p-3 text-sm num">
        <div><b>Porcja:</b> {fmt(tot.perServing)}</div>
        <div className="text-xs text-muted">Całość ({tot.grams} g): {fmt(tot.total)}</div>
        <Coverage c={tot.coverage} />
        {tot.warnings.map((w) => <div key={w} className="text-xs text-warn">{w}</div>)}
      </div>
      <Field label="Notatka (opcjonalnie)"><input className={inputCls} value={r.notes ?? ''} onChange={(e) => setR({ ...r, notes: e.target.value })} /></Field>
      <div className="flex gap-2">
        <Btn className="flex-1" disabled={!valid} onClick={() => save()}>Zapisz</Btn>
        {recipe && <Btn kind="soft" aria-label="Kopiuj" onClick={async () => { await db.recipes.put(copyRecipe(r, uid(), now())); toast('Skopiowano przepis'); onClose(); }}><Copy size={16} /></Btn>}
        {recipe && <Btn kind="soft" aria-label="Ulubiony" onClick={() => setR({ ...r, favorite: !r.favorite })}><Star size={16} className={r.favorite ? 'text-accent' : ''} /></Btn>}
        {recipe && <Btn kind="danger" aria-label="Usuń przepis" onClick={async () => { if (!confirmDel) return setConfirmDel(true); await db.recipes.delete(r.id); toast('Usunięto przepis (wpisy w dzienniku zostają)'); onClose(); }}>{confirmDel ? 'Na pewno?' : <Trash2 size={16} />}</Btn>}
      </div>
      {valid && <div className="rounded-xl border border-line p-3 space-y-2">
        <div className="font-semibold text-sm">Dodaj do dziennika ({date})</div>
        <div className="flex gap-1 flex-wrap">{MEALS.map((m, i) => <button key={m} onClick={() => setMeal(i + 1)} className={cx('px-3 py-1.5 rounded-lg text-xs', meal === i + 1 ? 'bg-accent text-accent-ink' : 'bg-card2')}>{m}</button>)}</div>
        <div className="flex items-center gap-2">
          <span className="text-sm flex-1">Porcje: <b className="num">{portions}</b> · {Math.round(tot.perServing.kcal * portions)} kcal</span>
          <button className="w-9 h-9 rounded-lg bg-card2" onClick={() => setPortions(Math.max(0.25, portions - 0.25))}>−</button>
          <button className="w-9 h-9 rounded-lg bg-card2" onClick={() => setPortions(portions + 0.25)}>+</button>
        </div>
        <button className="text-xs text-accent underline" onClick={() => setPortions(suggested)}>Pod cel posiłku ({t.dayType === 'training' ? 'dzień treningowy' : t.dayType === 'rest' ? 'dzień bez treningu' : 'cel dnia'}, ~{Math.round(t.kcal / Math.max(1, mealsPerDay))} kcal): {suggested} porc.</button>
        <Btn className="w-full" onClick={addToLog}>Dodaj {portions} porc. do dziennika</Btn>
        <p className="text-xs text-muted">Wpis zapisuje wartości z tej chwili: późniejsza zmiana przepisu nie zmieni historii.</p>
      </div>}
    </Sheet>
  );
}

export function TemplateEditor({ tpl, data, products, tTrain, tRest, onClose }: {
  tpl: (DayTemplate & { edited: boolean; custom: boolean }) | 'new'; data: AppData; products: ProductMap; tTrain: DayTargets; tRest: DayTargets; onClose: () => void;
}) {
  const isNew = tpl === 'new';
  const [name, setName] = useState(isNew ? 'Mój wariant' : tpl.name ?? `Dzień ${tpl.id}`);
  const [meals, setMeals] = useState<MealTemplateRec[]>(() => structuredClone(isNew ? DAY_TEMPLATES[0].meals : tpl.meals));
  const [addRecipe, setAddRecipe] = useState<number | null>(null);
  const errors = validateTemplate({ name, meals }, products);
  const draft: DayTemplate = { id: isNew ? 'new' : tpl.id, meals };
  const ft = errors.length ? null : safeFit(products, draft, tTrain);
  const fr = errors.length ? null : safeFit(products, draft, tRest);
  const t0 = now();

  async function save(asNew: boolean) {
    if (errors.length) return toast(errors[0]);
    const id = asNew || isNew ? uid() : tpl.id;
    await db.mealTemplates.put({ id, name: name.trim(), meals, createdAt: t0, updatedAt: t0 });
    toast(asNew ? 'Zapisano nowy wariant' : 'Szablon zapisany'); onClose();
  }
  const move = (i: number, dir: -1 | 1) => { const m = [...meals]; const j = i + dir; if (j < 0 || j >= m.length) return; [m[i], m[j]] = [m[j], m[i]]; setMeals(m); };
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Nowy szablon dnia' : `Edytuj: ${name}`}>
      <Field label="Nazwa szablonu"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <p className="text-xs text-muted">Wpisz gramatury bazowe. Przy wstawianiu do dziennika źródła białka, tłuszczu i węgli są dopasowywane do celu danego dnia (treningowy lub bez treningu).</p>
      {meals.map((m, i) => (
        <div key={i} className="rounded-xl border border-line p-2 space-y-1">
          <div className="flex items-center gap-1">
            <input className={inputCls + ' flex-1'} value={m.name} onChange={(e) => setMeals(meals.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <button aria-label="W górę" className="p-1" onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
            <button aria-label="W dół" className="p-1" onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
            <button aria-label="Usuń posiłek" className="p-1 text-danger" onClick={() => setMeals(meals.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
          </div>
          <ItemsEditor items={m.items} products={products} data={data} dairyFree={!!data.health?.dairyAvoid} onChange={(items) => setMeals(meals.map((x, j) => (j === i ? { ...x, items } : x)))} />
          {data.recipes.length > 0 && <button className="text-xs text-accent underline" onClick={() => setAddRecipe(i)}>+ wstaw składniki z przepisu (1 porcja)</button>}
        </div>
      ))}
      {meals.length < 5 && <Btn kind="soft" className="w-full text-sm" onClick={() => setMeals([...meals, { name: `Posiłek ${meals.length + 1}`, items: [] }])}>+ Posiłek</Btn>}
      {errors.length > 0 ? <div className="text-xs text-warn">{errors.slice(0, 3).join(' ')}</div> : <div className="rounded-xl bg-card2 p-3 text-xs num space-y-1">
        {ft && <div><b>Dzień treningowy</b> (cel {tTrain.kcal} kcal): {fmt(ft.totals)} {!ft.ok && <Badge tone="warn">poza tolerancją</Badge>}</div>}
        {fr && <div><b>Dzień bez treningu</b> (cel {tRest.kcal} kcal): {fmt(fr.totals)} {!fr.ok && <Badge tone="warn">poza tolerancją</Badge>}</div>}
        {ft?.swapped.length ? <div className="text-muted">Zamiany źle tolerowanych: {ft.swapped.map((s) => `${s.from} → ${s.to}`).join(', ')}</div> : null}
      </div>}
      <div className="flex gap-2">
        <Btn className="flex-1" disabled={errors.length > 0} onClick={() => save(false)}>Zapisz</Btn>
        {!isNew && <Btn kind="soft" disabled={errors.length > 0} onClick={() => save(true)}>Jako nowy</Btn>}
      </div>
      {!isNew && tpl.edited && <Btn kind="ghost" className="w-full text-sm text-danger" onClick={async () => { await db.mealTemplates.delete(tpl.id); toast(tpl.custom ? 'Usunięto wariant' : 'Przywrócono domyślny szablon'); onClose(); }}>{tpl.custom ? 'Usuń wariant' : 'Przywróć domyślny'}</Btn>}
      {addRecipe !== null && <Sheet open onClose={() => setAddRecipe(null)} title="Wybierz przepis">
        {data.recipes.map((r) => <button key={r.id} className="w-full text-left py-2 border-b border-line text-sm" onClick={() => {
          const per = r.items.map((x) => ({ ...x, grams: Math.max(1, Math.round(x.grams / Math.max(1, r.servings))) }));
          setMeals(meals.map((m, j) => (j === addRecipe ? { ...m, items: [...m.items, ...per] } : m))); setAddRecipe(null);
        }}>{r.name}</button>)}
      </Sheet>}
    </Sheet>
  );
}
