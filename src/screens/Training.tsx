import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Info, Play, Repeat, SkipForward, Timer } from 'lucide-react';
import type { ScreenProps } from '../App';
import { db, now, uid } from '../db/db';
import { EXERCISES, exerciseById, WORKOUTS, type Equip, type ExerciseCard, type TemplateExercise } from '../data/exercises';
import { effectivePlan, sessionPlan } from '../domain/workoutEdit';
import { WorkoutEditor } from './WorkoutEditor';
import { Pencil } from 'lucide-react';
import { actualFor, historyFor, kneeBlocked, lastSetsFor, setsForSlot, swapExercise, swapOptions } from '../domain/workout';
import { rigFor } from '../data/rigs';
import { COOLDOWN, WARMUP, type PrepItem } from '../data/warmup';
import { weeklyReview } from '../domain/weeklyReview';
import { activeCheckin, checkinEffects } from '../domain/weeklyCheckin';
import { RigPlayer } from '../ui/RigView';
import { addDays, formatPl, mondayOf, range } from '../domain/dates';
import { weekSummary } from '../domain/schedule';
import { DEFAULT_STEPS, fmtWeight, fromDisplay, loadStepKg, plannedSetsFor, suggestProgression, toDisplay, type LoadEquip, type Suggestion, type WeightUnit } from '../domain/progression';
import type { WorkoutSession, WorkoutSet } from '../domain/types';
import type { AppData, Derived } from '../db/repo';
import { Badge, Btn, Card, cx, Field, inputCls, NumInput, Scale, Sheet, Stepper, Title, toast } from '../ui/kit';

export function Training({ data, d }: ScreenProps) {
  const [card, setCard] = useState<ExerciseCard | null>(null);
  const [active, setActive] = useState<string | null>(d.inProgress?.id ?? null);
  const session = data.sessions.find((s) => s.id === active && s.status === 'in_progress');
  const ov = data.settings?.perWeekOverride;
  const perWeek = ov && ov.weekStart === mondayOf(d.today) ? ov.n : data.settings?.trainingsPerWeek ?? 3;
  const sum = weekSummary(data.sessions, d.today, perWeek);
  const skip = new Set(data.settings?.trainingSkip ?? []);
  const win = data.settings?.trainingWindow ?? { from: '09:00', to: '15:00' };
  const [availOpen, setAvailOpen] = useState(false);
  async function toggleSkip(dt: string) {
    const next = skip.has(dt) ? [...skip].filter((x) => x !== dt) : [...skip, dt];
    await db.settings.update('settings', { trainingSkip: next.filter((x) => x >= addDays(d.today, -60)).sort() });
    toast(skip.has(dt) ? 'Dzień znów dostępny' : 'Dzień niedostępny: plan przesunięty');
  }
  const next = d.todayWorkout ?? d.upcoming[0];
  const plans = { A: effectivePlan('A', WORKOUTS, data.workoutTemplates, data.settings?.activeWorkouts), B: effectivePlan('B', WORKOUTS, data.workoutTemplates, data.settings?.activeWorkouts) };
  const [editSlot, setEditSlot] = useState<'A' | 'B' | null>(null);
  const [unitsOpen, setUnitsOpen] = useState(false);

  async function start(t: 'A' | 'B') {
    if (d.safety.level === 'urgent') return toast('Objaw alarmowy: dziś bez treningu');
    const id = uid();
    const pl = plans[t];
    await db.sessions.add({ id, createdAt: now(), updatedAt: now(), date: d.today, templateId: t, status: 'in_progress', order: pl.items.map((e) => e.exerciseId), plan: structuredClone(pl.items), planName: pl.name, skipped: [], technique: {}, painBefore: d.morningToday?.kneePain, startedAt: now(), source: 'manual' });
    setActive(id);
  }
  if (session) return <SessionView data={data} d={d} s={session} onExit={() => { setActive(null); window.scrollTo(0, 0); }} />;

  return (
    <>
      <header className="pt-2"><h1 className="text-2xl font-bold">Trening</h1><p className="text-sm text-muted">FBW A/B · cel {perWeek}/tydz.{perWeek > 2 ? ' (2 też jest OK)' : ''} · tydzień {d.weekIdx + 1}</p></header>
      {d.inProgress && <Card onClick={() => setActive(d.inProgress!.id)} className="border-accent"><div className="font-semibold">Wznów trening {d.inProgress.templateId}</div><div className="text-sm text-muted">Zapisane serie są bezpieczne.</div></Card>}
      <Card>
        <Title>Dziś</Title>
        {d.doneToday ? <p className="font-semibold">Trening {d.doneToday.templateId} zrobiony ✓</p>
          : d.todayWorkout ? (<>
            <p className="text-lg font-semibold">Trening {d.todayWorkout.templateId}{d.readiness.level === 'B' ? ' (skrócony: 2 serie)' : ''}</p>
            {d.readiness.level === 'C' && <p className="text-sm text-warn mt-1">Plan C: trening nieobowiązkowy. Kolejny termin znajdzie się automatycznie.</p>}
            <p className="text-xs text-muted mt-1">Kiedy pasuje (np. {win.from}–{win.to}); pora dnia nie zmienia efektów.</p>
            <div className="flex gap-2 mt-3">
              <Btn className="flex-1 min-h-16 text-xl" onClick={() => start(d.todayWorkout!.templateId)}><Play size={20} className="inline -mt-1" /> Start</Btn>
              <Btn kind="soft" className="min-h-16" onClick={() => toggleSkip(d.today)}>Przełóż</Btn>
            </div>
          </>) : (<>
            <p className="text-muted">{skip.has(d.today) ? 'Dziś oznaczone jako niedostępne.' : 'Dzień odpoczynku.'}</p>
            {next && <p className="text-sm mt-1">Następny: {formatPl(next.date)}, trening {next.templateId}</p>}
            <div className="flex gap-2 mt-3"><Btn kind="soft" className="flex-1" onClick={() => start(next?.templateId ?? 'A')}>Mimo to zacznij {next?.templateId ?? 'A'}</Btn></div>
          </>)}
      </Card>
      <WeekCard data={data} d={d} perWeek={perWeek} plans={plans} />
      <Card>
        <Title right={<span className="text-xs text-muted num">ten tydzień: {sum.done}/{sum.target}</span>}>Najbliższe 14 dni</Title>
        <div className="grid grid-cols-7 gap-1 text-center">
          {range(d.today, 14).map((dt) => {
            const pw = d.upcoming.find((u) => u.date === dt);
            const done = data.sessions.find((s) => s.date === dt && s.status === 'completed');
            const off = skip.has(dt);
            return (
              <button key={dt} aria-label={`${formatPl(dt)}: ${done ? 'zrobiony' : off ? 'niedostępny' : pw ? `trening ${pw.templateId}` : 'wolne'}`} onClick={() => !done && toggleSkip(dt)} className={cx('rounded-lg py-1.5 text-[11px] leading-tight', off ? 'bg-card2 opacity-50' : pw ? 'bg-accent/15' : 'bg-card2', dt === d.today && 'ring-2 ring-accent')}>
                <div className="text-muted">{formatPl(dt).split(' ')[0]}</div><div className="num">{Number(dt.slice(8))}</div>
                <div className="font-semibold h-4">{done ? '✓' : off ? '–' : pw ? pw.templateId : ''}</div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted mt-2">Stuknij dzień, gdy nie możesz ćwiczyć: plan sam się przesunie (min. 1 dzień przerwy między treningami). Pominięte treningi nie kumulują się i nie zwiększają obciążenia.</p>
        <button className="text-xs text-accent underline mt-1" onClick={() => setAvailOpen(true)}>Dostępność: {perWeek}×/tydz. · {win.from}–{win.to}</button>
      </Card>
      {(['A', 'B'] as const).map((t) => (
        <Card key={t}>
          <Title right={<button aria-label={`Edytuj plan ${t}`} className="text-xs text-accent flex items-center gap-1" onClick={() => setEditSlot(t)}><Pencil size={12} /> edytuj</button>}>{plans[t].name}{plans[t].custom ? ' (wariant)' : plans[t].edited ? ' (zmieniony)' : ''}</Title>
          {plans[t].items.map((te) => {
            const e = exerciseById(te.exerciseId);
            return (
              <button key={te.exerciseId} onClick={() => setCard(e)} className="w-full flex justify-between items-center py-2.5 border-b border-line last:border-0 text-left">
                <span className="text-sm">{e.namePl} {e.knee !== 'none' && <Badge tone={e.knee === 'moderate' ? 'warn' : 'muted'}>kolano</Badge>}</span>
                <span className="text-xs text-muted num text-right">{plannedSetsFor(te.sets, d.weekIdx)}×{te.repMin === te.repMax ? te.repMin : `${te.repMin}–${te.repMax}`}{e.perSide ? '/str.' : ''} · {te.restSec}s
                </span>
              </button>
            );
          })}
        </Card>
      ))}
      <button className="text-xs text-accent underline px-1" onClick={() => setUnitsOpen(true)}>Jednostki i skoki obciążenia ({unitOf(data)})</button>
      <Card><Title>Biblioteka ćwiczeń</Title><div className="flex flex-wrap gap-1.5">{EXERCISES.map((e) => <button key={e.id} onClick={() => setCard(e)} className="rounded-full bg-card2 px-3 py-2 text-sm">{e.namePl}</button>)}</div></Card>
      {card && <ExerciseSheet e={card} data={data} d={d} onClose={() => setCard(null)} onOpen={setCard} />}
      {editSlot && <WorkoutEditor slot={editSlot} data={data} onClose={() => setEditSlot(null)} />}
      {unitsOpen && <UnitsSheet data={data} onClose={() => setUnitsOpen(false)} />}
      {availOpen && <AvailabilitySheet data={data} onClose={() => setAvailOpen(false)} />}
    </>
  );
}

export function ExerciseSheet({ e, onClose, data, d, onOpen }: { e: ExerciseCard; onClose: () => void; data?: AppData; d?: Derived; onOpen?: (e: ExerciseCard) => void }) {
  const rig = rigFor(e.id);
  const recent = data ? recentResults(data, e.id, 3, unitOf(data)) : [];
  const kneeTxt = { none: 'Nie obciąża kolana.', low: 'Niewielkie obciążenie kolana.', moderate: 'Obciąża kolano: ostrożnie, do czasu oceny specjalisty bez dodatkowego ciężaru.' }[e.knee];
  const todayKnee = d && e.knee !== 'none' && (d.safety.level === 'stop_legs' || (d.safety.level === 'caution_legs' && e.knee === 'moderate'));
  const video = <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(e.nameEn + ' proper form')}`} target="_blank" rel="noreferrer" className="block text-center min-h-11 leading-[2.75rem] rounded-xl bg-card2 text-sm text-accent">Zobacz wideo (YouTube)</a>;
  return (
    <Sheet open onClose={onClose} title={e.namePl}>
      <div className="text-sm text-muted">{e.nameEn} · {e.muscles}</div>
      {rig ? <RigPlayer rig={rig} /> : <p className="rounded-xl bg-card2 p-3 text-sm text-muted">Dla tego ćwiczenia nie ma jeszcze animacji. Zamiast niedokładnej grafiki skorzystaj z wideo poniżej.</p>}
      {video}
      {(todayKnee || e.warnings || e.knee !== 'none') && <div className={cx('rounded-xl p-3 text-sm', todayKnee ? 'bg-danger/10 text-danger' : 'bg-warn/10')}>
        <b>Zdrowie:</b> {todayKnee ? 'Dziś aktywna blokada kolana: pomiń to ćwiczenie. ' : ''}{kneeTxt} {e.warnings}</div>}
      <Sec t="Ustawienie sprzętu">{e.equipment}{e.setup && `. ${e.setup}`}</Sec>
      <Sec t="Pozycja wyjściowa">{e.start}</Sec>
      <div><div className="text-xs uppercase text-muted mb-1">Wykonanie krok po kroku</div><ol className="list-decimal pl-5 text-sm space-y-1">{e.steps.map((x) => <li key={x}>{x}</li>)}</ol></div>
      <Sec t="Oddech">{e.breathing}</Sec>
      {!rig && <Sec t="3 najczęstsze błędy">{e.mistakes.slice(0, 3).join(' · ')}</Sec>}
      <Sec t="Dobór ciężaru">{e.loadTip}</Sec>
      {(e.swapTo?.length ?? 0) > 0 && <div><div className="text-xs uppercase text-muted mb-1">Alternatywy</div><div className="flex flex-wrap gap-1.5">
        {e.swapTo!.map((id) => <button key={id} onClick={() => onOpen?.(exerciseById(id))} className="rounded-full bg-card2 px-3 py-1.5 text-xs">{exerciseById(id).namePl}</button>)}</div></div>}
      <div><div className="text-xs uppercase text-muted mb-1">Ostatnie wyniki</div>
        {recent.length ? recent.map((r) => <div key={r.date + r.text} className="text-sm num">{formatPl(r.date)}: {r.text}</div>) : <p className="text-sm text-muted">Brak zapisanych serii tego ćwiczenia.</p>}</div>
      <p className="text-xs text-muted">Przy pierwszym treningu poproś trenera dyżurnego o pokazanie ustawienia maszyny. Wideo otwiera wyniki wyszukiwania: wybieraj kanały trenerów lub fizjoterapeutów.</p>
    </Sheet>
  );
}
function recentResults(data: AppData, exerciseId: string, n: number, unit: WeightUnit) {
  const done = data.sessions.filter((s) => s.status === 'completed').sort((a, b) => b.date.localeCompare(a.date));
  const out: { date: string; text: string }[] = [];
  for (const s of done) {
    const sets = data.sets.filter((x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.done).sort((a, b) => a.setIndex - b.setIndex);
    if (sets.length) out.push({ date: s.date, text: `${sets.map((x) => `${String(toDisplay(x.weightKg, unit)).replace('.', ',')}×${x.reps}`).join(', ')} (${unit})` });
    if (out.length >= n) break;
  }
  return out;
}
const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => <div><div className="text-xs uppercase text-muted mb-0.5">{t}</div><div className="text-sm">{children}</div></div>;

const lastSetsForData = (data: AppData, exerciseId: string, exclude: string) => lastSetsFor(data.sessions, data.sets, exerciseId, exclude);
const unitOf = (data: AppData): WeightUnit => data.settings?.weightUnit ?? 'kg';

/** Jedno źródło sugestii progresji (podgląd przed treningiem i sesja): reguły w domain/progression.ts. */
function progressFor(data: AppData, d: Derived, ex: ExerciseCard, te: { sets: number; repMin: number; repMax: number }, plannedSets: number, excludeSession?: string): Suggestion {
  const kneeBlock = kneeBlocked(d.safety.level, ex.knee);
  const kneePain = d.morningToday?.kneePain ?? 0;
  const kneeWeek = ex.knee !== 'none' && checkinEffects(activeCheckin(data.weeklyCheckins ?? [], d.today)).kneeCaution;
  const noIncrease = d.readiness.level === 'B' ? 'Gorszy dzień (plan B)' : ex.knee !== 'none' && kneePain >= 3 ? `Ból kolana ${kneePain}/10 w check-inie` : kneeWeek ? 'Kolano bolało w tym tygodniu (raport)' : undefined;
  return suggestProgression({
    history: historyFor(data.sessions, data.sets, ex.id, excludeSession), today: d.today, plannedSets, repMin: te.repMin, repMax: te.repMax,
    step: loadStepKg(ex, unitOf(data), data.settings?.loadSteps), safetyBlock: kneeBlock,
    kneeNoLoad: ex.knee === 'moderate' && !data.health?.kneeCleared && !kneeBlock, noIncrease, requirePainRecord: ex.knee !== 'none' && !data.health?.kneeCleared, unit: unitOf(data),
  });
}

/** Raz w tygodniu: ile treningów, gdzie lepiej niż tydzień temu i najwyżej 3 podpowiedzi ciężaru (bez decyzji w trakcie treningu). */
function WeekCard({ data, d, perWeek, plans }: { data: AppData; d: Derived; perWeek: number; plans: Record<'A' | 'B', { items: TemplateExercise[] }> }) {
  const r = weeklyReview(data.sessions, data.sets, d.today);
  const unit = unitOf(data);
  const fmtB = (b: { weightKg: number; reps: number }) => `${String(toDisplay(b.weightKg, unit)).replace('.', ',')}×${b.reps}`;
  const seen = new Set<string>();
  const hints = [...plans.A.items, ...plans.B.items].filter((te) => !seen.has(te.exerciseId) && seen.add(te.exerciseId)).map((te) => {
    const e = exerciseById(te.exerciseId);
    return { e, sg: progressFor(data, d, e, te, plannedSetsFor(te.sets, d.weekIdx)) };
  }).filter((x) => x.sg.action === 'increase' && x.sg.weightKg !== null).slice(0, 3);
  if (!r.done && !r.prevDone) return null;
  return (
    <Card>
      <Title right={<span className="text-xs text-muted num">{r.done}/{perWeek}</span>}>Ten tydzień</Title>
      {r.improved.length ? <div className="text-sm space-y-0.5"><p>Lepiej niż tydzień temu:</p>{r.improved.slice(0, 4).map((x) => <p key={x.exerciseId} className="num text-accent">{exerciseById(x.exerciseId).namePl}: {fmtB(x.before)} → {fmtB(x.after)} {unit}</p>)}</div>
        : <p className="text-sm text-muted">{r.compared ? 'Wyniki jak tydzień temu. Regularność to też postęp.' : r.done ? 'Porównanie pojawi się, gdy powtórzysz ćwiczenia w kolejnym tygodniu.' : 'W tym tygodniu jeszcze bez treningu.'}</p>}
      {hints.length > 0 && <div className="mt-2 text-sm"><p className="text-muted text-xs">Możesz spróbować (gdy czujesz się dobrze):</p>{hints.map((h) => <p key={h.e.id}>{h.e.namePl}: {fmtWeight(h.sg.weightKg!, unit)}</p>)}</div>}
    </Card>
  );
}

const PREP_STEP = { warmup: '__warmup', cooldown: '__cooldown' } as const;

function SessionView({ data, d, s, onExit }: { data: AppData; d: Derived; s: WorkoutSession; onExit: () => void }) {
  const tpl = sessionPlan(s, WORKOUTS);
  const order = s.order.filter((id) => tpl.some((t) => t.exerciseId === id));
  const steps = [PREP_STEP.warmup, ...order, PREP_STEP.cooldown];
  const [idx, setIdx] = useState(() => Math.min(steps.length - 1, Number(localStorage.getItem(`ws-step-${s.id}`) ?? 0)));
  const [finish, setFinish] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  useEffect(() => { localStorage.setItem(`ws-step-${s.id}`, String(idx)); window.scrollTo(0, 0); }, [idx, s.id]);
  // tryb skupienia: bez dolnej nawigacji
  useEffect(() => { document.body.dataset.focus = '1'; return () => { delete document.body.dataset.focus; }; }, []);
  const step = steps[idx];
  const allDone = data.sets.filter((x) => x.sessionId === s.id);
  const lvlB = d.readiness.level === 'B';
  const plannedOf = (sl: string) => { const t = tpl.find((x) => x.exerciseId === sl)!; return lvlB ? Math.min(2, t.sets) : plannedSetsFor(t.sets, d.weekIdx); };
  const doneCount = (sl: string) => setsForSlot(allDone, sl).filter((x) => x.done).length;
  const prep = new Set(s.prep ?? []);
  const isDone = (st: string) => st === PREP_STEP.warmup ? WARMUP.every((w) => prep.has(w.id)) || prep.has('warmup') : st === PREP_STEP.cooldown ? prep.has('cooldown') : doneCount(st) >= plannedOf(st);
  const label = (st: string) => st === PREP_STEP.warmup ? 'Rozgrzewka' : st === PREP_STEP.cooldown ? 'Rozciąganie' : exerciseById(actualFor(s, st)).namePl.split(' ').slice(0, 2).join(' ');
  const exCount = order.filter((o) => isDone(o)).length;
  async function markPrep(ids: string[], on = true) {
    const next = new Set(prep); ids.forEach((i) => (on ? next.add(i) : next.delete(i)));
    await db.sessions.update(s.id, { prep: [...next], updatedAt: now() });
  }
  const go = (i: number) => setIdx(Math.max(0, Math.min(steps.length - 1, i)));

  return (
    <div className="space-y-3 pb-28">
      <header className="flex items-center justify-between pt-2">
        <button onClick={onExit} className="min-h-11 text-sm text-accent flex items-center"><ChevronLeft size={18} />Wyjdź (zapisane)</button>
        <span className="text-sm text-muted num">Trening {s.templateId}{lvlB ? ' · skrócony' : ''} · {exCount}/{order.length} ✓</span>
      </header>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {steps.map((st, i) => (
          <button key={st} onClick={() => go(i)} className={cx('shrink-0 min-h-11 rounded-full px-3 text-xs', i === idx ? 'bg-accent text-accent-ink font-semibold' : s.skipped.includes(st) ? 'bg-card2 text-muted line-through' : isDone(st) ? 'bg-accent/20 text-accent' : 'bg-card2')}>
            {isDone(st) ? '✓ ' : st.startsWith('__') ? '' : `${order.indexOf(st) + 1}. `}{st.startsWith('__') ? '' : actualFor(s, st) !== st ? '↔ ' : ''}{label(st)}
          </button>
        ))}
      </div>
      <RestTimer />
      {step === PREP_STEP.warmup ? <PrepList title="Rozgrzewka" sub="ok. 7–8 min. Krótka i lekka: ma przygotować, nie zmęczyć." items={WARMUP} prep={prep} onToggle={(id) => markPrep([id], !prep.has(id))}
        note="Najlepiej udokumentowane są lekkie serie ćwiczenia, które zaraz robisz; marsz i ruchy bez ciężaru są dodatkiem. Bez przysiadów i wykroków, żeby oszczędzać kolano."
        footer={<><Btn className="w-full min-h-14 text-lg" onClick={async () => { await markPrep(['warmup']); go(1); }}>Gotowe: pierwsze ćwiczenie <ChevronRight size={18} className="inline" /></Btn>
          <button className="w-full min-h-11 text-sm text-muted" onClick={() => go(1)}>Pomiń rozgrzewkę</button></>} />
      : step === PREP_STEP.cooldown ? <PrepList title="Rozciąganie (nieobowiązkowe)" sub="ok. 3 min. Każde 20–30 s, spokojny oddech, bez bólu." items={COOLDOWN} prep={prep} onToggle={(id) => markPrep([id], !prep.has(id))}
        note="Rozciąganie po treningu nie zmniejsza zakwasów. Regularnie robione poprawia zakres ruchu i pomaga się wyciszyć."
        footer={<Btn className="w-full min-h-14 text-lg" onClick={async () => { await markPrep(['cooldown']); setFinish(true); }}>Zakończ trening</Btn>} />
      : <ExerciseStep key={step} data={data} d={d} s={s} slot={step} planned={plannedOf(step)} allDone={allDone} lvlB={lvlB} pos={order.indexOf(step)} onSwap={() => setSwapOpen(true)}
          onUnswap={async () => { const { [step]: _drop, ...rest } = s.substitutions ?? {}; void _drop; await db.sessions.update(s.id, { substitutions: rest, updatedAt: now() }); toast('Wrócono do ćwiczenia z planu'); }}
          onNext={() => go(idx + 1)} nextLabel={idx + 1 < steps.length - 1 ? label(steps[idx + 1]) : 'Rozciąganie'} onBack={() => go(idx - 1)}
          onSkip={async () => { await db.sessions.update(s.id, { skipped: [...new Set([...s.skipped, step])], updatedAt: now() }); go(idx + 1); }} />}
      {finish && <FinishSheet s={s} onClose={() => setFinish(false)} onDone={onExit} />}
      {swapOpen && !step.startsWith('__') && <SwapFor s={s} d={d} data={data} slot={step} onClose={() => setSwapOpen(false)} />}
    </div>
  );
}

function PrepList({ title, sub, items, prep, onToggle, note, footer }: { title: string; sub: string; items: PrepItem[]; prep: Set<string>; onToggle: (id: string) => void; note: string; footer: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <Card>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted">{sub}</p>
        <div className="mt-3 divide-y divide-line">
          {items.map((it) => (
            <div key={it.id} className="py-2">
              <div className="flex items-center gap-3">
                <button aria-label={`${prep.has(it.id) ? 'Odznacz' : 'Zrobione'}: ${it.name}`} aria-pressed={prep.has(it.id)} onClick={() => onToggle(it.id)} className={cx('w-11 h-11 shrink-0 rounded-full grid place-items-center border-2', prep.has(it.id) ? 'bg-accent border-accent text-accent-ink' : 'border-line')}>{prep.has(it.id) && <Check size={20} />}</button>
                <button className="flex-1 text-left min-h-11" onClick={() => setOpen(open === it.id ? null : it.id)}>
                  <div className={cx('text-sm font-semibold', prep.has(it.id) && 'text-muted line-through')}>{it.name}</div>
                  <div className="text-xs text-muted">{it.dose}</div>
                </button>
              </div>
              <p className="text-xs mt-1 pl-14"><b>Czucie:</b> {it.focus}</p>
              {open === it.id && <div className="pl-14 mt-1 space-y-1">
                <ol className="list-decimal pl-4 text-sm space-y-0.5">{it.steps.map((x) => <li key={x}>{x}</li>)}</ol>
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(it.video)}`} target="_blank" rel="noreferrer" className="inline-block min-h-11 leading-[2.75rem] text-sm text-accent">Zobacz wideo (YouTube)</a>
              </div>}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-2">{note} Stuknij nazwę, żeby zobaczyć opis.</p>
      </Card>
      {footer}
    </>
  );
}

function ExerciseStep({ data, d, s, slot, planned, allDone, lvlB, pos, onSwap, onUnswap, onNext, nextLabel, onBack, onSkip }: { data: AppData; d: Derived; s: WorkoutSession; slot: string; planned: number; allDone: WorkoutSet[]; lvlB: boolean; pos: number; onSwap: () => void; onUnswap: () => void; onNext: () => void; nextLabel: string; onBack: () => void; onSkip: () => void }) {
  const tpl = sessionPlan(s, WORKOUTS);
  const te = tpl.find((t) => t.exerciseId === slot)!;
  const exId = actualFor(s, slot);
  const ex = exerciseById(exId);
  const swapped = exId !== slot;
  const done = setsForSlot(allDone, slot);
  const mine = done.filter((x) => x.exerciseId === exId && x.done);
  const earlierInSlot = done.filter((x) => x.exerciseId !== exId && x.done);
  const kneeBlock = kneeBlocked(d.safety.level, ex.knee);
  const prev = lastSetsForData(data, exId, s.id);
  const sug = progressFor(data, d, ex, te, planned, s.id);
  const unit = unitOf(data);
  const lastW = prev?.sets[0]?.weightKg;
  /** ciężar podpowiadany: ostatni; lżej tylko gdy zasady bezpieczeństwa każą (przerwa, spadek wyników, kolano bez oceny); nigdy samo zwiększenie */
  const startKg = sug.action === 'decrease' || (sug.action === 'hold' && sug.weightKg === 0) ? sug.weightKg : lastW ?? null;
  const painNow = Math.max(0, ...mine.map((x) => x.pain ?? 0));
  const reps = te.repMin === te.repMax ? `${te.repMin}` : `${te.repMin}–${te.repMax}`;
  const rest = te.restSec >= 60 ? `${Math.round(te.restSec / 6) / 10} min`.replace('.', ',') : `${te.restSec} s`;
  const fmtSets = (xs: { weightKg: number; reps: number }[]) => `${xs.map((x) => `${String(toDisplay(x.weightKg, unit)).replace('.', ',')}×${x.reps}`).join(', ')} ${unit}`;
  const painButtons = <div className="grid grid-cols-2 gap-2"><Btn kind="soft" className="text-sm min-h-11" onClick={onSkip}>Pomiń ćwiczenie</Btn><Btn kind="soft" className="text-sm min-h-11" onClick={onSwap}>Zamień ćwiczenie</Btn></div>;
  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div><h2 className="text-xl font-bold leading-tight">{ex.namePl}{mine.length >= planned && ' ✓'}</h2>
            {swapped && <div className="text-xs text-muted">zamiast: {exerciseById(slot).namePl}</div>}
            <div className="text-sm text-muted mt-0.5">{planned} {planned === 1 ? 'seria' : planned < 5 ? 'serie' : 'serii'} × {reps} powt.{ex.perSide ? ' na stronę' : ''} · przerwa {rest}</div>
            <div className="text-xs text-muted">Kończ serię, gdy zostają ok. 2–3 powtórzenia w zapasie.</div></div>
          <div className="flex gap-1.5"><button aria-label="Zamień ćwiczenie" onClick={onSwap} className="w-11 h-11 grid place-items-center rounded-lg bg-card2"><Repeat size={18} /></button><InfoBtn e={ex} data={data} d={d} /></div>
        </div>
        {swapped && <button onClick={onUnswap} className="min-h-11 text-sm text-accent">↩ Wróć do: {exerciseById(slot).namePl}</button>}
        {earlierInSlot.length > 0 && <p className="mt-2 text-xs text-muted">Wcześniej w tym miejscu: {exerciseById(earlierInSlot[0].exerciseId).namePl}, {earlierInSlot.length} seria(e) zapisane.</p>}
        {kneeBlock ? <p className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">Blokada bezpieczeństwa: pomiń to ćwiczenie dziś (kolano).</p>
          : painNow >= 4 ? <div role="alert" className="mt-3 rounded-xl bg-warn/10 p-3 text-sm space-y-2"><div><b>Ból {painNow}/10 przy tym ćwiczeniu.</b> Przerwij je albo wybierz zamiennik. Nie dokładaj ciężaru. Zapisane serie zostają.</div>{painButtons}</div>
          : sug.action === 'pain' ? <div className="mt-3 rounded-xl bg-warn/10 p-3 text-sm space-y-2"><div>{sug.reason}</div>{painButtons}</div>
          : (sug.action === 'decrease' || (sug.action === 'hold' && sug.weightKg === 0)) ? <p className="mt-3 rounded-xl bg-warn/10 p-3 text-sm">{sug.reason}{sug.weightKg ? ` Wpisałem ${fmtWeight(sug.weightKg, unit)}; zmień, jeśli trzeba.` : ''}</p>
          : null}
        <p className="mt-2 text-sm text-muted">{prev ? `Ostatnio (${formatPl(prev.session.date)}): ${fmtSets(prev.sets)}` : 'Pierwszy raz: zacznij lżej, wpisz ciężar w serii 1.'}</p>
        {lvlB && pos >= 5 && <p className="text-xs text-warn mt-2">Plan B: to ćwiczenie jest opcjonalne.</p>}
      </Card>
      {Array.from({ length: Math.max(planned, mine.length) }, (_, i) => (
        <SetRow key={`${exId}-${i}`} s={s} te={te} ex={ex} slot={slot} index={i} existing={done.find((x) => x.exerciseId === exId && x.setIndex === i)} unit={unit} stepKg={loadStepKg(ex, unit, data.settings?.loadSteps)}
          defaultWeight={mine.at(-1)?.weightKg ?? startKg ?? 0} defaultReps={prev?.sets[i]?.reps ?? prev?.sets.at(-1)?.reps ?? te.repMin} disabled={kneeBlock} lastOfExercise={i === planned - 1} />
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Btn kind="soft" className="min-h-11 text-sm" onClick={onBack}><ChevronLeft size={16} className="inline -mt-0.5" /> Wstecz</Btn>
        <Btn kind="soft" className="min-h-11 text-sm" onClick={onSkip}><SkipForward size={16} className="inline -mt-0.5" /> Pomiń ćwiczenie</Btn>
      </div>
      <Btn className="w-full min-h-14 text-lg" onClick={onNext}>Dalej: {nextLabel} <ChevronRight size={18} className="inline" /></Btn>
    </>
  );
}

function SwapFor({ s, d, data, slot, onClose }: { s: WorkoutSession; d: Derived; data: AppData; slot: string; onClose: () => void }) {
  const exId = actualFor(s, slot);
  const opts = swapOptions(slot, (id) => exerciseById(id), { safety: d.safety.level, kneeCleared: !!data.health?.kneeCleared, inSession: s.order.filter((x) => x !== slot).map((x) => actualFor(s, x)) });
  async function doSwap(to: string) {
    try {
      const next = swapExercise(s, slot, to, opts);
      await db.sessions.update(s.id, { substitutions: next.substitutions, updatedAt: now() });
      onClose(); toast(to === slot ? 'Wrócono do ćwiczenia z planu' : `Zamieniono na: ${exerciseById(to).namePl}`);
    } catch (err) { toast((err as Error).message); }
  }
  return <SwapSheet slot={slot} current={exId} options={opts} onPick={doSwap} onClose={onClose} />;
}

function InfoBtn({ e, data, d }: { e: ExerciseCard; data: AppData; d: Derived }) {
  const [o, setO] = useState<ExerciseCard | null>(null);
  return <><button aria-label="Instrukcja" onClick={() => setO(e)} className="w-11 h-11 grid place-items-center rounded-lg bg-card2"><Info size={18} /></button>{o && <ExerciseSheet e={o} data={data} d={d} onOpen={setO} onClose={() => setO(null)} />}</>;
}

const EQUIP_PL: Record<Equip, string> = { machine: 'Maszyna', dumbbell: 'Hantle', cable: 'Wyciąg', bench: 'Ławka', bodyweight: 'Bez sprzętu' };
function SwapSheet({ slot, current, options, onPick, onClose }: { slot: string; current: string; options: ReturnType<typeof swapOptions>; onPick: (id: string) => void; onClose: () => void }) {
  const [eq, setEq] = useState<Equip | null>(null);
  const shown = options.filter((o) => !eq || exerciseById(o.id).equip?.includes(eq));
  return (
    <Sheet open onClose={onClose} title="Zamień ćwiczenie">
      <p className="text-sm text-muted">Ta sama grupa mięśni. Serie, powtórzenia i przerwy z planu zostają; ciężar i historia liczą się osobno dla każdego ćwiczenia. Zapisane serie się nie zmieniają.</p>
      <div className="flex flex-wrap gap-1.5">{(Object.keys(EQUIP_PL) as Equip[]).map((k) => <button key={k} onClick={() => setEq(eq === k ? null : k)} className={cx('rounded-full px-3 py-1.5 text-xs', eq === k ? 'bg-accent text-accent-ink' : 'bg-card2')}>{EQUIP_PL[k]}</button>)}</div>
      <div className="space-y-1.5">
        {shown.map((o) => { const e = exerciseById(o.id); return (
          <button key={o.id} disabled={!o.allowed || o.id === current} onClick={() => onPick(o.id)} className={cx('w-full text-left rounded-xl p-3', o.id === current ? 'bg-accent/15' : 'bg-card2', !o.allowed && 'opacity-50')}>
            <div className="text-sm font-semibold">{e.namePl}{o.original && <span className="text-xs text-muted font-normal"> · z planu</span>}{o.id === current && <span className="text-xs text-accent font-normal"> · teraz</span>}</div>
            <div className="text-xs text-muted">{e.equipment}{e.knee !== 'none' ? ` · kolano: ${e.knee === 'low' ? 'niskie obciążenie' : 'obciąża'}` : ''}</div>
            {o.reason && <div className="text-xs text-danger mt-0.5">{o.reason}</div>}
          </button>
        ); })}
        {!shown.length && <p className="text-sm text-muted">Brak zamienników z tym sprzętem.</p>}
      </div>
      <p className="text-xs text-muted">Zamienniki obciążające kolano bardziej niż ćwiczenie z planu są zablokowane, dopóki kolano nie zostanie ocenione przez specjalistę.</p>
      {slot !== current && <Btn kind="soft" className="w-full" onClick={() => onPick(slot)}>Wróć do ćwiczenia z planu</Btn>}
    </Sheet>
  );
}

function SetRow({ s, te, ex, slot, index, existing, defaultWeight, defaultReps, disabled, unit, stepKg, lastOfExercise }: { s: WorkoutSession; te: TemplateExercise; ex: ExerciseCard; slot: string; index: number; existing?: WorkoutSet; defaultWeight: number; defaultReps: number; disabled: boolean; unit: WeightUnit; stepKg: number; lastOfExercise?: boolean }) {
  const key = `ws-draft-${s.id}-${ex.id}-${index}`;
  const draft = existing ? null : JSON.parse(localStorage.getItem(key) ?? 'null');
  const [w, setWS] = useState<number>(() => existing?.weightKg ?? draft?.w ?? defaultWeight);
  const [r, setRS] = useState<number>(() => existing?.reps ?? draft?.r ?? defaultReps);
  /** dopóki seria nie była ruszana, ciężar podąża za poprzednią zapisaną serią (np. seria 2 po wpisaniu serii 1) */
  const [touched, setTouched] = useState(!!draft);
  useEffect(() => { if (!existing && !touched) { setWS(defaultWeight); setRS(defaultReps); } }, [defaultWeight, defaultReps, existing, touched]);
  const setW = (v: number) => { setTouched(true); setWS(v); };
  const setR = (v: number) => { setTouched(true); setRS(v); };
  const [rir, setRirS] = useState<number | undefined>(existing ? existing.rir : draft?.rir ?? undefined);
  const [pain, setPainS] = useState<number | undefined>(existing ? existing.pain : draft?.pain ?? undefined);
  const [more, setMore] = useState(pain !== undefined);
  useEffect(() => { if (!existing && touched) localStorage.setItem(key, JSON.stringify({ w, r, rir: rir ?? null, pain: pain ?? null })); }, [w, r, rir, pain, key, existing, touched]);
  /** w zapisanej serii zapas i ból zapisują się od razu (ból to informacja o bezpieczeństwie, nie może zginąć) */
  const setRir = (v: number | undefined) => { setTouched(true); setRirS(v); if (existing) void db.sets.update(existing.id, { rir: v, updatedAt: now() }); };
  const setPain = (v: number | undefined) => { setTouched(true); setPainS(v); if (existing) void db.sets.update(existing.id, { pain: v, updatedAt: now() }); };
  const isDone = !!existing?.done;
  async function save() {
    const t = now();
    await db.sets.put({ id: existing?.id ?? uid(), sessionId: s.id, exerciseId: ex.id, slot: existing?.slot ?? slot, setIndex: index, weightKg: w, reps: r, rir, pain, done: true, createdAt: existing?.createdAt ?? t, updatedAt: t });
    await db.sessions.update(s.id, { updatedAt: t });
    localStorage.removeItem(key);
    if (!isDone) { localStorage.setItem('restUntil', String(Date.now() + te.restSec * 1000)); window.dispatchEvent(new Event('rest')); }
    if ((pain ?? 0) >= 4) toast('Ból ≥4/10: przerwij to ćwiczenie i nie dokładaj ciężaru.');
    else if (!isDone && lastOfExercise) toast('Ćwiczenie zaliczone ✓');
  }
  return (
    <Card className={cx(isDone && 'border-accent/50')}>
      <div className="flex items-center justify-between mb-2"><span className="text-sm font-semibold">Seria {index + 1}</span>{isDone && <Badge tone="accent"><Check size={12} /> zapisana</Badge>}</div>
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <Stepper value={toDisplay(w, unit)} onChange={(v) => setW(fromDisplay(v, unit))} step={toDisplay(stepKg, unit) || 1} unit={unit} />
        <Stepper value={r} onChange={setR} step={1} unit={ex.perSide ? 'na str.' : 'powt.'} />
      </div>
      <div className="flex justify-end mt-1">
        <button aria-expanded={more} className="min-h-11 px-3 -mr-3 text-sm text-accent" onClick={() => setMore(!more)}>{pain !== undefined ? `Ból ${pain}/10` : 'Ból? / zapas'}</button>
      </div>
      {more && <div className="space-y-3">
        <Scale label="Ból podczas serii" min={0} max={10} value={pain} onChange={setPain} hint="0 = brak" />
        <div role="group" aria-label="Zapas powtórzeń, opcjonalnie">
          <div className="text-sm mb-1.5">Ile powtórzeń zostało w zapasie? <span className="text-muted text-xs">(opcjonalnie)</span></div>
          <div className="flex gap-1">{[0, 1, 2, 3, 4].map((v) => <button key={v} aria-pressed={rir === v} onClick={() => setRir(rir === v ? undefined : v)} className={cx('flex-1 min-h-11 rounded-lg text-sm num', rir === v ? 'bg-accent text-accent-ink font-semibold' : 'bg-card2')}>{v === 4 ? '4+' : v}</button>)}</div>
        </div>
      </div>}
      <Btn className="w-full mt-2 min-h-12" kind={isDone ? 'soft' : 'primary'} disabled={disabled} onClick={save}>{isDone ? 'Popraw serię' : 'Seria zrobiona'}</Btn>
    </Card>
  );
}

function RestTimer() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.round((Number(localStorage.getItem('restUntil') ?? 0) - Date.now()) / 1000)));
    tick(); const t = setInterval(tick, 500); window.addEventListener('rest', tick);
    return () => { clearInterval(t); window.removeEventListener('rest', tick); };
  }, []);
  if (!left) return null;
  return (
    <div className="sticky top-2 z-20 flex items-center justify-between rounded-2xl bg-accent text-accent-ink px-4 py-3 shadow-lg">
      <span className="flex items-center gap-2 font-semibold"><Timer size={18} /> Przerwa</span>
      <span className="num text-2xl font-bold">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
      <button className="min-h-11 px-2 -mr-2 text-sm underline" onClick={() => { localStorage.removeItem('restUntil'); setLeft(0); }}>pomiń</button>
    </div>
  );
}

function FinishSheet({ s, onClose, onDone }: { s: WorkoutSession; onClose: () => void; onDone: () => void }) {
  const [cardio, setCardio] = useState<number | undefined>(10);
  const [note, setNote] = useState('');
  const mins = useMemo(() => Math.round((now() - s.startedAt) / 60000), [s.startedAt]);
  async function done() {
    await db.sessions.update(s.id, { status: 'completed', cardioMin: cardio, note: note || undefined, finishedAt: now(), updatedAt: now() });
    Object.keys(localStorage).filter((k) => k.includes(s.id)).forEach((k) => localStorage.removeItem(k));
    toast('Trening zapisany'); onDone();
  }
  return (
    <Sheet open onClose={onClose} title="Zakończ trening">
      <p className="text-sm text-muted">Czas: {mins} min.</p>
      <Field label="Marsz na bieżni po treningu (min) · 3,5–4,5 km/h, 0%, tempo rozmowy"><NumInput value={cardio} onChange={setCardio} /></Field>
      <Field label="Notatka (opcjonalnie)"><input className="w-full min-h-12 rounded-xl bg-card2 border border-line px-3" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <p className="text-xs text-muted">Jutro w check-inie oceń kolano: ból następnego dnia ma znaczenie dla progresji.</p>
      <Btn className="w-full" onClick={done}>Zapisz trening</Btn>
      <Btn kind="ghost" className="w-full" onClick={async () => { await db.sessions.update(s.id, { status: 'abandoned', updatedAt: now() }); onDone(); }}>Porzuć (bez zaliczenia)</Btn>
    </Sheet>
  );
}


const EQ_PL: Record<LoadEquip, string> = { dumbbell: 'Hantle (na rękę)', machine: 'Maszyna', cable: 'Wyciąg', barbell: 'Sztanga' };
function UnitsSheet({ data, onClose }: { data: AppData; onClose: () => void }) {
  const [unit, setUnit] = useState<WeightUnit>(data.settings?.weightUnit ?? 'kg');
  const [steps, setSteps] = useState<Partial<Record<LoadEquip, number>>>(() => (data.settings?.weightUnit ?? 'kg') === unit ? data.settings?.loadSteps ?? {} : {});
  async function save() {
    await db.settings.update('settings', { weightUnit: unit, loadSteps: steps });
    toast('Zapisano'); onClose();
  }
  return (
    <Sheet open onClose={onClose} title="Jednostki i skoki obciążenia">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-card2 p-1 text-sm">{(['kg', 'lb'] as const).map((u) => <button key={u} onClick={() => { setUnit(u); setSteps({}); }} className={cx('rounded-lg py-2', unit === u ? 'bg-card font-semibold' : 'text-muted')}>{u}</button>)}</div>
      <p className="text-xs text-muted">Najmniejszy skok, jaki masz na siłowni. Aplikacja proponuje zwiększenie tylko o tyle. Puste pole = wartość domyślna.</p>
      {(Object.keys(EQ_PL) as LoadEquip[]).map((k) => (
        <Field key={k} label={`${EQ_PL[k]} (domyślnie: ${unit === 'kg' ? 'wg ćwiczenia' : `${DEFAULT_STEPS.lb[k]} lb`})`}><NumInput value={steps[k]} onChange={(v) => setSteps({ ...steps, [k]: v && v > 0 ? v : undefined })} placeholder={unit === 'kg' ? 'wg ćwiczenia' : String(DEFAULT_STEPS.lb[k])} /></Field>
      ))}
      <p className="text-xs text-muted">Zapisane serie zawsze są w kg; zmiana jednostki zmienia tylko wyświetlanie i skoki.</p>
      <Btn className="w-full" onClick={save}>Zapisz</Btn>
    </Sheet>
  );
}

function AvailabilitySheet({ data, onClose }: { data: AppData; onClose: () => void }) {
  const [per, setPer] = useState(data.settings?.trainingsPerWeek ?? 3);
  const [win, setWin] = useState(data.settings?.trainingWindow ?? { from: '09:00', to: '15:00' });
  async function save() {
    await db.settings.update('settings', { trainingsPerWeek: per, trainingWindow: win });
    toast('Zapisano dostępność'); onClose();
  }
  return (
    <Sheet open onClose={onClose} title="Dostępność treningowa">
      <div className="flex items-center justify-between rounded-xl bg-card2 p-3">
        <span className="text-sm">Treningi w tygodniu</span>
        <Stepper value={per} onChange={(v) => setPer(Math.max(2, Math.min(4, Math.round(v))))} step={1} min={2} />
      </div>
      <p className="text-xs text-muted">Domyślnie 3. Minimum zaleceń to trening siłowy w co najmniej 2 dni tygodnia, więc tydzień z 2 treningami też jest w porządku.</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Zwykle od"><input type="time" className={inputCls} value={win.from} onChange={(e) => setWin({ ...win, from: e.target.value })} /></Field>
        <Field label="do"><input type="time" className={inputCls} value={win.to} onChange={(e) => setWin({ ...win, to: e.target.value })} /></Field>
      </div>
      <p className="text-xs text-muted">Okno jest tylko podpowiedzią. Badania nie pokazują, że pora dnia zmienia efekty treningu; liczy się regularność.</p>
      <Btn className="w-full" onClick={save}>Zapisz</Btn>
    </Sheet>
  );
}
