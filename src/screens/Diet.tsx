import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, ListChecks, Plus, Star, Trash2, Siren, Repeat } from 'lucide-react';
import type { ScreenProps } from '../App';
import { db, now, uid } from '../db/db';
import { dayIntake, targetFor } from '../db/repo';
import { DAY_TEMPLATES, EMERGENCY_MEALS, type DayTemplate } from '../data/foods';
import { addDays, formatPl } from '../domain/dates';
import { scaleNutrients } from '../domain/calc';
import { candidatesForSwap, fitDayToTargets, shoppingList, swapProduct, type ProductMap } from '../domain/nutrition';
import type { FoodEntry, FoodProduct } from '../domain/types';
import { Badge, Bar, Btn, Card, cx, Field, inputCls, NumInput, Sheet, Title, toast } from '../ui/kit';
import { FoodPicker, addQuickEntry, basisLabel } from './FoodPicker';
import { dayTargets, ruleWarnings, type DayTargets } from '../domain/targets';
import { PlanSettingsSheet } from './Energy';
import { Settings2 } from 'lucide-react';

const MEALS = ['Posiłek 1', 'Posiłek 2', 'Posiłek 3', 'Posiłek 4', 'Przekąska / słodycze'];

export function Diet({ data, d }: ScreenProps) {
  const [date, setDate] = useState(d.today);
  const [addMeal, setAddMeal] = useState<number | null>(null);
  const [edit, setEdit] = useState<FoodEntry | null>(null);
  const [sheet, setSheet] = useState<'template' | 'shop' | 'sos' | 'product' | 'plan' | null>(null);
  const products = useMemo(() => new Map(data.foods.map((f) => [f.id, f])), [data.foods]);
  const entries = data.entries.filter((e) => e.date === date);
  const tot = dayIntake(data, date);
  const hist = targetFor(data, date, d.plannedDays);
  const basePlan = hist?.plan ?? d.plan!;
  const t = hist?.t ?? dayTargets(basePlan, false);
  const plan = { ...basePlan, kcal: t.kcal, proteinG: t.proteinG, fatG: t.fatG, carbsG: t.carbsG, fiberG: [t.fiberG, Math.max(t.fiberG, basePlan.fiberG[1])] as [number, number] };
  const mealCarbs = [1, 2, 3, 4, 5].map((m) => entries.filter((e) => e.meal === m).reduce((a, e) => a + e.snapshot.carbs, 0));
  const warnings = tot ? ruleWarnings(t, tot, mealCarbs) : [];

  async function addEntry(meal: number, p: FoodProduct, grams: number) {
    const n = scaleNutrients(p.per100, grams);
    await db.entries.add({ id: uid(), createdAt: now(), updatedAt: now(), date, meal, productId: p.id, grams, snapshot: { ...n, name: p.name }, source: 'manual' });
  }
  async function copyFrom(src: string, meal?: number) {
    const e = data.entries.filter((x) => x.date === src && (meal === undefined || x.meal === meal));
    if (!e.length) return toast('Brak wpisów do skopiowania');
    await db.entries.bulkAdd(e.map((x) => ({ ...x, id: uid(), date, createdAt: now(), updatedAt: now(), source: 'template' as const })));
    toast(`Skopiowano ${e.length} pozycji`);
  }
  async function applyTemplate(tpl: DayTemplate) {
    const fit = fitDayToTargets(products, tpl, { kcal: t.kcal, proteinG: t.proteinG, fatG: t.fatG, carbsG: t.carbsG });
    const fitted = fit.day;
    const rows: FoodEntry[] = fitted.meals.flatMap((m, i) => m.items.map((it) => {
      const p = products.get(it.productId)!;
      return { id: uid(), createdAt: now(), updatedAt: now(), date, meal: i + 1, productId: p.id, grams: it.grams, snapshot: { ...scaleNutrients(p.per100, it.grams), name: p.name }, source: 'template' as const };
    }));
    await db.entries.bulkAdd(rows); setSheet(null);
    toast(`Dzień ${tpl.id}: ${Math.round(fit.totals.kcal)} kcal, B ${Math.round(fit.totals.protein)} g${fit.swapped.length ? `, zamieniono ${fit.swapped.length} źle tolerowane` : ''}${fit.ok ? '' : ' (poza tolerancją)'}`);
  }
  const fiberLow = plan.fiberG[0];

  return (
    <>
      <header className="flex items-center justify-between pt-2">
        <button aria-label="Poprzedni dzień" className="p-2" onClick={() => setDate(addDays(date, -1))}><ChevronLeft /></button>
        <div className="text-center"><h1 className="text-xl font-bold">Dieta</h1><div className="text-sm text-muted">{date === d.today ? 'Dziś' : formatPl(date)}</div></div>
        <div className="flex"><button aria-label="Ustawienia planu" className="p-2" onClick={() => setSheet('plan')}><Settings2 size={20} /></button>
        <button aria-label="Następny dzień" className="p-2 disabled:opacity-30" disabled={date >= d.today} onClick={() => setDate(addDays(date, 1))}><ChevronRight /></button></div>
      </header>

      <Card>
        <div className="flex items-end justify-between">
          <div><div className="text-xs text-muted flex items-center gap-1.5">Zjedzone {t.dayType !== 'flat' && <Badge tone={t.dayType === 'training' ? 'accent' : 'muted'}>{t.dayType === 'training' ? 'dzień treningowy' : 'dzień bez treningu'}</Badge>}</div><div className="num text-4xl font-bold">{Math.round(tot?.kcal ?? 0)}<span className="text-base font-normal text-muted"> / {plan.kcal} kcal</span></div></div>
          <div className="text-right text-sm"><div className="num font-semibold">{Math.round(plan.kcal - (tot?.kcal ?? 0))}</div><div className="text-xs text-muted">zostało</div></div>
        </div>
        <div className="mt-2"><Bar value={tot?.kcal ?? 0} max={plan.kcal} tone={(tot?.kcal ?? 0) > plan.kcal * 1.1 ? 'warn' : 'accent'} /></div>
        <div className="grid grid-cols-4 gap-3 mt-4 text-sm">
          {([['Białko', tot?.protein, plan.proteinG], ['Tłuszcz', tot?.fat, plan.fatG], ['Węgle', tot?.carbs, plan.carbsG], ['Błonnik', tot?.fiber, plan.fiberG[1]]] as const).map(([l, v, t]) => (
            <div key={l}><div className="text-xs text-muted">{l}</div><div className="num font-semibold">{Math.round(v ?? 0)}<span className="text-muted font-normal">/{t}</span></div><div className="mt-1"><Bar value={v ?? 0} max={t} /></div></div>
          ))}
        </div>
        {tot && (tot.sugar !== undefined || tot.satFat !== undefined || tot.salt !== undefined) && <p className="text-xs text-muted mt-3 num">Z etykiet (gdy dostępne): cukry {tot.sugar?.toFixed(0) ?? '—'} g{t.sugarMaxG ? ` / ${t.sugarMaxG}` : ''} · nasycone {tot.satFat?.toFixed(0) ?? '—'} g · sól {tot.salt?.toFixed(1) ?? '—'} g</p>}
        {tot && (['protein', 'fat', 'carbs'] as const).some((k) => tot.coverage[k] < 1) && <p className="text-xs text-warn mt-2">Część wpisów to szacunki bez makro: znane białko dla {Math.round(tot.coverage.protein * 100)}% kcal, tłuszcz i węgle dla {Math.round(tot.coverage.carbs * 100)}% kcal. Liczby makro są zaniżone; analizy pomijają makro, gdy pokrycie &lt; 80%.</p>}
        {t.notes.map((n) => <p key={n} className="text-xs text-muted mt-1">{n}</p>)}
        {warnings.map((w) => <p key={w} className="text-xs text-warn mt-1">{w}</p>)}
        {(tot?.kcal ?? 0) > plan.kcal * 1.1 && <p className="text-sm text-muted mt-3">Powyżej celu: wracasz do zwykłego planu od następnego posiłku. Bez odrabiania.</p>}
        {tot && tot.fiber > fiberLow + 10 && <p className="text-xs text-muted mt-2">Błonnik {Math.round(tot.fiber)} g. Jeśli to dużo więcej niż zwykle, zwiększaj stopniowo (np. połowa porcji warzyw i strączków przez 1–2 tyg.), żeby nie obciążać jelit.</p>}
      </Card>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <QuickBtn icon={<ListChecks size={18} />} label="Szablon A/B/C" onClick={() => setSheet('template')} />
        <QuickBtn icon={<Copy size={18} />} label="Kopiuj wczoraj" onClick={() => copyFrom(addDays(date, -1))} />
        <QuickBtn icon={<Plus size={18} />} label="Lista zakupów" onClick={() => setSheet('shop')} />
        <QuickBtn icon={<Siren size={18} />} label="Awaryjnie" onClick={() => setSheet('sos')} />
      </div>

      {MEALS.map((name, i) => {
        const me = entries.filter((e) => e.meal === i + 1);
        const kcal = me.reduce((a, e) => a + e.snapshot.kcal, 0);
        return (
          <Card key={i}>
            <Title right={<span className="num text-xs text-muted">{Math.round(kcal)} kcal · {Math.round(me.reduce((a, e) => a + e.snapshot.protein, 0))} g B</span>}>{name}</Title>
            {me.map((e) => {
              const p = products.get(e.productId);
              return (
                <button key={e.id} onClick={() => setEdit(e)} className="w-full flex justify-between py-2 border-b border-line last:border-0 text-left">
                  <span className="text-sm">{e.snapshot.name} <span className="text-muted">{e.grams} g</span>{p?.dairy !== 'none' && p && <Badge tone="warn">nabiał?</Badge>}{p?.tolerance === 'bad' && <Badge tone="danger">źle tolerowany</Badge>}</span>
                  <span className="num text-sm text-muted">{Math.round(e.snapshot.kcal)}</span>
                </button>
              );
            })}
            <div className="flex gap-2 mt-2">
              <Btn kind="soft" className="flex-1 text-sm" onClick={() => setAddMeal(i + 1)}><Plus size={16} className="inline -mt-0.5" /> Dodaj</Btn>
              {date !== addDays(d.today, -1) && <Btn kind="ghost" className="text-sm" onClick={() => copyFrom(addDays(date, -1), i + 1)}>z wczoraj</Btn>}
            </div>
            {i === 4 && <p className="text-xs text-muted mt-2">Możesz zaplanować 150–200 kcal słodyczy w ramach dziennego limitu.</p>}
          </Card>
        );
      })}

      {addMeal !== null && <FoodPicker foods={data.foods} entries={data.entries} onClose={() => setAddMeal(null)} onAdd={async (p, g) => { await addEntry(addMeal, p, g); toast(`Dodano: ${p.name}`); }}
        onQuick={async (name, kcal, protein) => { await addQuickEntry(date, addMeal, name, kcal, protein, uid()); toast('Dodano szacunek'); }} onNew={() => setSheet('product')} />}
      {sheet === 'plan' && <PlanSettingsSheet plan={basePlan} today={d.today} onClose={() => setSheet(null)} />}
      {edit && <EditEntry entry={edit} product={products.get(edit.productId)} foods={data.foods} onClose={() => setEdit(null)} />}
      <Sheet open={sheet === 'template'} onClose={() => setSheet(null)} title="Wstaw dzień z szablonu">
        <p className="text-sm text-muted">Gramatury źródeł białka, tłuszczu i węglowodanów zostaną dopasowane do celu tego dnia ({t.kcal} kcal, B {t.proteinG}, T {t.fatG}, W {t.carbsG}); produkty źle tolerowane zostaną zamienione. Wartości referencyjne: sprawdź etykiety.</p>
        {DAY_TEMPLATES.map((tpl) => { const fit = fitDayToTargets(products, tpl, { kcal: t.kcal, proteinG: t.proteinG, fatG: t.fatG, carbsG: t.carbsG }); return (
          <Card key={tpl.id} onClick={() => applyTemplate(tpl)}><div className="font-semibold">Dzień {tpl.id} {!fit.ok && <Badge tone="warn">poza tolerancją</Badge>}</div><div className="text-sm text-muted">{tpl.meals.map((m) => m.name).join(' · ')}</div>
            <div className="text-xs text-muted num mt-1">Po dopasowaniu: {Math.round(fit.totals.kcal)} kcal · B {Math.round(fit.totals.protein)} · T {Math.round(fit.totals.fat)} · W {Math.round(fit.totals.carbs)}{fit.swapped.length ? ` · zamiany: ${fit.swapped.map((x) => `${x.from} → ${x.to}`).join(', ')}` : ''}</div></Card>
        ); })}
      </Sheet>
      {sheet === 'shop' && <Shopping open onClose={() => setSheet(null)} products={products} t={t} />}
      <Sheet open={sheet === 'sos'} onClose={() => setSheet(null)} title="Posiłki awaryjne">
        {EMERGENCY_MEALS.map((m) => <div key={m.where}><div className="font-semibold">{m.where}</div><p className="text-sm text-muted">{m.text}</p></div>)}
        <p className="text-xs text-muted">Wpisz potem produkt jako własny (kcal z etykiety lub szacunek oznaczony jako szacunek).</p>
      </Sheet>
      {sheet === 'product' && <ProductForm open onClose={() => setSheet(null)} />}
    </>
  );
}

function QuickBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl bg-card border border-line py-3 active:opacity-70">{icon}<span>{label}</span></button>;
}

function EditEntry({ entry, product, foods, onClose }: { entry: FoodEntry; product?: FoodProduct; foods: FoodProduct[]; onClose: () => void }) {
  const [g, setG] = useState<number | undefined>(entry.grams);
  const [swap, setSwap] = useState(false);
  async function save() {
    if (!product || !g) return;
    await db.entries.update(entry.id, { grams: g, snapshot: { ...scaleNutrients(product.per100, g), name: product.name }, updatedAt: now() }); onClose();
  }
  async function doSwap(to: FoodProduct) {
    if (!product) return;
    const s = swapProduct(product, entry.grams, to);
    await db.entries.update(entry.id, { productId: to.id, grams: s.grams, snapshot: { ...scaleNutrients(to.per100, s.grams), name: to.name }, updatedAt: now() });
    toast(`Zamieniono (dopasowano ${s.matchedOn === 'protein' ? 'białko' : 'kcal'})`); onClose();
  }
  async function toggle(field: 'favorite' | 'tolerance') {
    if (!product) return;
    if (field === 'favorite') await db.foods.update(product.id, { favorite: !product.favorite });
    else await db.foods.update(product.id, { tolerance: product.tolerance === 'bad' ? 'good' : product.tolerance === 'good' ? 'unknown' : 'bad' });
  }
  return (
    <Sheet open onClose={onClose} title={entry.snapshot.name}>
      {!product ? <p className="text-sm text-muted">Szybki wpis: {Math.round(entry.snapshot.kcal)} kcal, {Math.round(entry.snapshot.protein)} g białka (szacunek).</p> : <>
      <Field label="Gramatura (g)"><NumInput value={g} onChange={setG} /></Field>
      <div className="flex gap-2">
        <Btn kind="soft" className="flex-1 text-sm" onClick={() => toggle('favorite')}><Star size={14} className="inline" /> {product?.favorite ? 'Usuń z ulubionych' : 'Ulubiony'}</Btn>
        <Btn kind="soft" className="flex-1 text-sm" onClick={() => toggle('tolerance')}>Tolerancja: {product?.tolerance === 'bad' ? 'źle' : product?.tolerance === 'good' ? 'dobrze' : '?'}</Btn>
      </div>
      <Btn kind="soft" className="w-full text-sm" onClick={() => setSwap(!swap)}><Repeat size={14} className="inline" /> Zamień na podobny</Btn>
      {swap && product && candidatesForSwap(foods, product).slice(0, 25).map((c) => {
        const s = swapProduct(product, entry.grams, c);
        return <button key={c.id} onClick={() => doSwap(c)} className="w-full text-left py-2 border-b border-line text-sm">{c.name} {s.grams} g <span className="text-muted num">({s.diff.kcal >= 0 ? '+' : ''}{Math.round(s.diff.kcal)} kcal, B {s.diff.protein >= 0 ? '+' : ''}{s.diff.protein.toFixed(0)} g, Bł {s.diff.fiber >= 0 ? '+' : ''}{s.diff.fiber.toFixed(0)} g)</span>{s.dairyWarning && <Badge tone="warn">nabiał?</Badge>}</button>;
      })}
      </>}
      <div className="flex gap-2"><Btn kind="danger" onClick={async () => { await db.entries.delete(entry.id); onClose(); }}><Trash2 size={16} /></Btn>{product && <Btn className="flex-1" onClick={save}>Zapisz</Btn>}</div>
    </Sheet>
  );
}

function Shopping({ open, onClose, products, t }: { open: boolean; onClose: () => void; products: ProductMap; t: DayTargets }) {
  const [counts, setCounts] = useState<Record<string, number>>({ A: 1, B: 1, C: 1 });
  const days = DAY_TEMPLATES.flatMap((tpl) => Array(counts[tpl.id] ?? 0).fill(fitDayToTargets(products, tpl, { kcal: t.kcal, proteinG: t.proteinG, fatG: t.fatG, carbsG: t.carbsG }).day));
  const list = shoppingList(products, days);
  return (
    <Sheet open={open} onClose={onClose} title="Lista zakupów / meal prep">
      <div className="grid grid-cols-3 gap-2">
        {DAY_TEMPLATES.map((t) => (
          <div key={t.id} className="rounded-xl bg-card2 p-2 text-center"><div className="text-xs text-muted">Dzień {t.id}</div>
            <div className="flex items-center justify-center gap-2 mt-1"><button className="w-8 h-8 rounded-lg bg-card" onClick={() => setCounts({ ...counts, [t.id]: Math.max(0, counts[t.id] - 1) })}>−</button><span className="num font-semibold">{counts[t.id]}</span><button className="w-8 h-8 rounded-lg bg-card" onClick={() => setCounts({ ...counts, [t.id]: counts[t.id] + 1 })}>+</button></div></div>
        ))}
      </div>
      <div className="divide-y divide-line">{list.map((i) => <div key={i.productId} className="flex justify-between py-2 text-sm"><span>{i.name}</span><span className="num text-muted">{i.grams >= 1000 ? `${(i.grams / 1000).toFixed(2)} kg` : `${i.grams} g`}</span></div>)}</div>
      <p className="text-xs text-muted">Gramatury dla produktów suchych/surowych zgodnie z opisem produktu.</p>
    </Sheet>
  );
}

function ProductForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ name: '', kcal: undefined as number | undefined, protein: undefined as number | undefined, fat: undefined as number | undefined, carbs: undefined as number | undefined, fiber: 0 as number | undefined, sugar: undefined as number | undefined, satFat: undefined as number | undefined, salt: undefined as number | undefined, barcode: '', basis: 'as_sold' as FoodProduct['basis'], dairy: 'none' as FoodProduct['dairy'], fromLabel: true });
  const valid = f.name && f.kcal !== undefined && f.protein !== undefined && f.fat !== undefined && f.carbs !== undefined;
  async function save() {
    if (!valid) return;
    await db.foods.add({ id: uid(), name: f.name, per100: { kcal: f.kcal!, protein: f.protein!, fat: f.fat!, carbs: f.carbs!, fiber: f.fiber ?? 0, ...(f.sugar !== undefined ? { sugar: f.sugar } : {}), ...(f.satFat !== undefined ? { satFat: f.satFat } : {}), ...(f.salt !== undefined ? { salt: f.salt } : {}) }, ...(f.barcode ? { barcode: f.barcode } : {}), basis: f.basis, dairy: f.dairy, tolerance: 'unknown', role: f.protein! * 4 > f.kcal! * 0.3 ? 'protein' : f.fat! * 9 > f.kcal! * 0.5 ? 'fat' : 'carb', source: f.fromLabel ? 'Etykieta produktu (wpis użytkownika)' : 'Szacunek użytkownika', reliability: f.fromLabel ? 'label' : 'estimate', custom: true, updatedAt: now() });
    toast('Produkt zapisany'); onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nowy produkt (na 100 g)">
      <Field label="Nazwa"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-2">
        {(['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'satFat', 'salt'] as const).map((k) => <Field key={k} label={{ kcal: 'kcal', protein: 'Białko', fat: 'Tłuszcz', carbs: 'Węgle', fiber: 'Błonnik', sugar: 'Cukry (opc.)', satFat: 'Nasycone (opc.)', salt: 'Sól (opc.)' }[k]}><NumInput value={f[k]} onChange={(v) => setF({ ...f, [k]: v })} /></Field>)}
      </div>
      <Field label="Kod kreskowy (opcjonalnie)"><input className={inputCls} inputMode="numeric" value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value.replace(/\D/g, '') })} /></Field>
      <Field label="Waga dotyczy"><select className={inputCls} value={f.basis} onChange={(e) => setF({ ...f, basis: e.target.value as FoodProduct['basis'] })}>{(['as_sold', 'raw', 'dry', 'cooked', 'drained'] as const).map((b) => <option key={b} value={b}>{basisLabel(b)}</option>)}</select></Field>
      <Field label="Składniki mleczne"><select className={inputCls} value={f.dairy} onChange={(e) => setF({ ...f, dairy: e.target.value as FoodProduct['dairy'] })}><option value="none">brak</option><option value="contains">zawiera</option><option value="unknown">nie wiem</option></select></Field>
      <div className="flex gap-2">{[true, false].map((v) => <button key={String(v)} onClick={() => setF({ ...f, fromLabel: v })} className={cx('flex-1 min-h-11 rounded-lg text-sm', f.fromLabel === v ? 'bg-accent text-accent-ink' : 'bg-card2')}>{v ? 'Z etykiety' : 'Szacunek'}</button>)}</div>
      <Btn className="w-full" disabled={!valid} onClick={save}>Zapisz</Btn>
    </Sheet>
  );
}
