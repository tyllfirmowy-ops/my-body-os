import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Info, Play, Repeat, SkipForward, Timer, Undo2 } from 'lucide-react';
import type { ScreenProps } from '../App';
import { db, now, uid } from '../db/db';
import { EXERCISES, exerciseById, WORKOUTS, type Equip, type ExerciseCard, type TemplateExercise } from '../data/exercises';
import { effectivePlan, sessionPlan } from '../domain/workoutEdit';
import { WorkoutEditor } from './WorkoutEditor';
import { Pencil } from 'lucide-react';
import { actualFor, historyFor, kneeBlocked, lastSetsFor, setsForSlot, swapExercise, swapOptions } from '../domain/workout';
import { rigFor } from '../data/rigs';
import { RigPlayer } from '../ui/RigView';
import { formatPl, range } from '../domain/dates';
import { withDaughter, cycleSummary } from '../domain/schedule';
import { DEFAULT_STEPS, fmtWeight, fromDisplay, loadStepKg, plannedSetsFor, suggestProgression, toDisplay, type LoadEquip, type Suggestion, type WeightUnit } from '../domain/progression';
import type { ProgressDecision, WorkoutSession, WorkoutSet } from '../domain/types';
import type { AppData, Derived } from '../db/repo';
import { Badge, Btn, Card, cx, Field, NumInput, Scale, Sheet, Stepper, Title, toast } from '../ui/kit';

export function Training({ data, d }: ScreenProps) {
  const [card, setCard] = useState<ExerciseCard | null>(null);
  const [active, setActive] = useState<string | null>(d.inProgress?.id ?? null);
  const session = data.sessions.find((s) => s.id === active && s.status === 'in_progress');
  const c = d.custody!;
  const sum = cycleSummary(c, data.sessions, d.today, d.plan!.workoutsPer14d);
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
  if (session) return <SessionView data={data} d={d} s={session} onExit={() => setActive(null)} />;

  return (
    <>
      <header className="pt-2"><h1 className="text-2xl font-bold">Trening</h1><p className="text-sm text-muted">FBW A/B · {d.plan!.workoutsPer14d} treningi na 14 dni · tydzień {d.weekIdx + 1}</p></header>
      {d.inProgress && <Card onClick={() => setActive(d.inProgress!.id)} className="border-accent"><div className="font-semibold">Wznów trening {d.inProgress.templateId}</div><div className="text-sm text-muted">Zapisane serie są bezpieczne.</div></Card>}
      <Card>
        <Title>Dziś</Title>
        {d.doneToday ? <p className="font-semibold">Trening {d.doneToday.templateId} zrobiony ✓</p>
          : d.todayWorkout ? (<>
            <p className="text-lg font-semibold">Trening {d.todayWorkout.templateId}{d.readiness.level === 'B' ? ' (skrócony: 2 serie)' : ''}</p>
            {d.readiness.level === 'C' && <p className="text-sm text-warn mt-1">Plan C: trening nieobowiązkowy. Kolejny termin znajdzie się automatycznie.</p>}
            <Btn className="w-full mt-3" onClick={() => start(d.todayWorkout!.templateId)}><Play size={16} className="inline -mt-0.5" /> Start</Btn>
          </>) : (<>
            <p className="text-muted">{d.withDaughterToday ? 'Dzień z córką. Opcjonalnie: spacer lub wspólna aktywność.' : 'Dzień odpoczynku.'}</p>
            {next && <p className="text-sm mt-1">Następny: {formatPl(next.date)}, trening {next.templateId}</p>}
            {!d.withDaughterToday && <div className="flex gap-2 mt-3"><Btn kind="soft" className="flex-1" onClick={() => start(next?.templateId ?? 'A')}>Mimo to zacznij {next?.templateId ?? 'A'}</Btn></div>}
          </>)}
      </Card>
      <Card>
        <Title right={<span className="text-xs text-muted num">cykl: {sum.done}/{sum.target}</span>}>Najbliższe 14 dni</Title>
        <div className="grid grid-cols-7 gap-1 text-center">
          {range(d.today, 14).map((dt) => {
            const pw = d.upcoming.find((u) => u.date === dt);
            const done = data.sessions.find((s) => s.date === dt && s.status === 'completed');
            const kid = withDaughter(c, dt);
            return (
              <div key={dt} className={cx('rounded-lg py-1.5 text-[11px] leading-tight', kid ? 'bg-accent/15' : 'bg-card2', dt === d.today && 'ring-2 ring-accent')}>
                <div className="text-muted">{formatPl(dt).split(' ')[0]}</div><div className="num">{Number(dt.slice(8))}</div>
                <div className="font-semibold h-4">{done ? '✓' : pw ? pw.templateId : kid ? '♥' : ''}</div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted mt-2">♥ dzień z córką (bez siłowni) · A/B plan · opuszczone treningi nie kumulują się.</p>
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
                  {(() => { const sg = progressFor(data, d, e, te, plannedSetsFor(te.sets, d.weekIdx)); return sg.action === 'no_data' ? null : <span className={cx('block', sg.action === 'increase' ? 'text-accent' : sg.action === 'decrease' || sg.action === 'skip' ? 'text-warn' : '')}>{ARROW[sg.action]} {sg.weightKg !== null ? fmtWeight(sg.weightKg, unitOf(data)) : ''}</span>; })()}
                </span>
              </button>
            );
          })}
        </Card>
      ))}
      <p className="text-xs text-muted px-1">↑ propozycja zwiększenia · ↓ lżej (ból, przerwa, słabszy wynik) · +1 powt. ten sam ciężar · = bez zmian. Zmiana ciężaru zawsze wymaga Twojej zgody na treningu.</p>
      <button className="text-xs text-accent underline px-1" onClick={() => setUnitsOpen(true)}>Jednostki i skoki obciążenia ({unitOf(data)})</button>
      <Card><Title>Biblioteka ćwiczeń</Title><div className="flex flex-wrap gap-1.5">{EXERCISES.map((e) => <button key={e.id} onClick={() => setCard(e)} className="rounded-full bg-card2 px-3 py-2 text-sm">{e.namePl}</button>)}</div></Card>
      {card && <ExerciseSheet e={card} data={data} d={d} onClose={() => setCard(null)} onOpen={setCard} />}
      {editSlot && <WorkoutEditor slot={editSlot} data={data} onClose={() => setEditSlot(null)} />}
      {unitsOpen && <UnitsSheet data={data} onClose={() => setUnitsOpen(false)} />}
    </>
  );
}

export function ExerciseSheet({ e, onClose, data, d, onOpen }: { e: ExerciseCard; onClose: () => void; data?: AppData; d?: Derived; onOpen?: (e: ExerciseCard) => void }) {
  const rig = rigFor(e.id);
  const recent = data ? recentResults(data, e.id, 3) : [];
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
function recentResults(data: AppData, exerciseId: string, n: number) {
  const done = data.sessions.filter((s) => s.status === 'completed').sort((a, b) => b.date.localeCompare(a.date));
  const out: { date: string; text: string }[] = [];
  for (const s of done) {
    const sets = data.sets.filter((x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.done).sort((a, b) => a.setIndex - b.setIndex);
    if (sets.length) out.push({ date: s.date, text: sets.map((x) => `${x.weightKg}×${x.reps}`).join(', ') });
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
  const noIncrease = d.readiness.level === 'B' ? 'Gorszy dzień (plan B)' : ex.knee !== 'none' && kneePain >= 3 ? `Ból kolana ${kneePain}/10 w check-inie` : undefined;
  return suggestProgression({
    history: historyFor(data.sessions, data.sets, ex.id, excludeSession), today: d.today, plannedSets, repMin: te.repMin, repMax: te.repMax,
    step: loadStepKg(ex, unitOf(data), data.settings?.loadSteps), safetyBlock: kneeBlock,
    kneeNoLoad: ex.knee === 'moderate' && !data.health?.kneeCleared && !kneeBlock, noIncrease,
  });
}
const ARROW: Record<Suggestion['action'], string> = { increase: '↑', decrease: '↓', reps: '+1 powt.', hold: '=', skip: 'pomiń', no_data: 'start' };

function SessionView({ data, d, s, onExit }: { data: AppData; d: Derived; s: WorkoutSession; onExit: () => void }) {
  const tpl = sessionPlan(s, WORKOUTS);
  const order = s.order.filter((id) => tpl.some((t) => t.exerciseId === id));
  const [idx, setIdx] = useState(() => Number(localStorage.getItem(`ws-idx-${s.id}`) ?? 0));
  const [finish, setFinish] = useState(false);
  useEffect(() => { localStorage.setItem(`ws-idx-${s.id}`, String(idx)); }, [idx, s.id]);
  const slot = order[Math.min(idx, order.length - 1)];
  const te = tpl.find((t) => t.exerciseId === slot)!;           // parametry serii/powtórzeń/przerw z planu
  const exId = actualFor(s, slot);                              // faktycznie wykonywane ćwiczenie
  const ex = exerciseById(exId);
  const swapped = exId !== slot;
  const [swapOpen, setSwapOpen] = useState(false);
  const allDone = data.sets.filter((x) => x.sessionId === s.id);
  const done = setsForSlot(allDone, slot);
  const earlierInSlot = setsForSlot(allDone, slot).filter((x) => x.exerciseId !== exId && x.done);
  const lvlB = d.readiness.level === 'B';
  const planned = lvlB ? Math.min(2, te.sets) : plannedSetsFor(te.sets, d.weekIdx);
  const kneeBlock = kneeBlocked(d.safety.level, ex.knee);
  const prev = lastSetsForData(data, exId, s.id);
  const sug = progressFor(data, d, ex, te, planned, s.id);
  const unit = unitOf(data);
  const dec = s.progress?.[exId];
  const lastW = prev?.sets[0]?.weightKg;
  const needsDecision = (sug.action === 'increase' || sug.action === 'decrease') && sug.weightKg !== null;
  /** ciężar domyślny serii: decyzja użytkownika; bez decyzji przy zmianie ciężaru = ostatni ciężar (nic nie zmienia się samo) */
  const plannedKg = dec ? dec.chosenKg : needsDecision ? (lastW ?? null) : sug.weightKg ?? lastW ?? null;
  const [customKg, setCustomKg] = useState<number | null>(null);
  async function decide(decision: ProgressDecision['decision'], chosenKg: number | null) {
    for (let i = 0; i < 10; i++) localStorage.removeItem(`ws-draft-${s.id}-${exId}-${i}`);
    const rec: ProgressDecision = { action: sug.action, suggestedKg: sug.weightKg, targetReps: sug.targetReps, reason: sug.reason, decision, chosenKg, at: now() };
    await db.sessions.update(s.id, { progress: { ...(s.progress ?? {}), [exId]: rec }, updatedAt: now() });
    setCustomKg(null);
    toast(decision === 'accepted' ? 'Przyjęte' : decision === 'rejected' ? 'Zostajesz przy dotychczasowym ciężarze' : 'Zapisano Twój ciężar');
  }

  async function move(dir: -1 | 1) {
    const o = [...s.order]; const i = o.indexOf(slot); const j = i + dir;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    await db.sessions.update(s.id, { order: o, updatedAt: now() }); setIdx(idx + dir);
  }
  async function skip() {
    await db.sessions.update(s.id, { skipped: [...new Set([...s.skipped, slot])], updatedAt: now() });
    if (idx < order.length - 1) setIdx(idx + 1);
  }
  const doneCount = (sl: string) => setsForSlot(allDone, sl).filter((x) => x.done).length;
  const opts = swapOptions(slot, (id) => exerciseById(id), { safety: d.safety.level, kneeCleared: !!data.health?.kneeCleared, inSession: s.order.filter((x) => x !== slot).map((x) => actualFor(s, x)) });
  async function doSwap(to: string) {
    try {
      const next = swapExercise(s, slot, to, opts);
      await db.sessions.update(s.id, { substitutions: next.substitutions, updatedAt: now() });
      setSwapOpen(false); toast(to === slot ? 'Wrócono do ćwiczenia z planu' : `Zamieniono na: ${exerciseById(to).namePl}`);
    } catch (err) { toast((err as Error).message); }
  }

  return (
    <div className="space-y-3 pb-4">
      <header className="flex items-center justify-between pt-2">
        <button onClick={onExit} className="text-sm text-accent flex items-center"><ChevronLeft size={18} />Wyjdź (zapisane)</button>
        <Badge tone="accent">Trening {s.templateId}{lvlB ? ' · skrócony' : ''}</Badge>
      </header>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {order.map((id, i) => (
          <button key={id} onClick={() => setIdx(i)} className={cx('shrink-0 rounded-full px-3 py-1.5 text-xs', i === idx ? 'bg-accent text-accent-ink font-semibold' : s.skipped.includes(id) ? 'bg-card2 text-muted line-through' : doneCount(id) ? 'bg-accent/20 text-accent' : 'bg-card2')}>
            {i + 1}. {actualFor(s, id) !== id && '↔ '}{exerciseById(actualFor(s, id)).namePl.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>
      <RestTimer />
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div><h2 className="text-xl font-bold leading-tight">{ex.namePl}</h2>
            {swapped && <div className="text-xs text-muted">zamiast: {exerciseById(slot).namePl}</div>}
            <div className="text-sm text-muted">{planned} × {te.repMin === te.repMax ? te.repMin : `${te.repMin}–${te.repMax}`}{ex.perSide ? ' na stronę' : ''} · przerwa {te.restSec}s · ~3 RIR</div></div>
          <div className="flex gap-1.5"><button aria-label="Zamień ćwiczenie" onClick={() => setSwapOpen(true)} className="p-2 rounded-lg bg-card2"><Repeat size={18} /></button><InfoBtn e={ex} data={data} d={d} /></div>
        </div>
        {swapped && <button onClick={() => doSwap(slot)} className="mt-2 flex items-center gap-1 text-xs text-accent"><Undo2 size={14} /> Wróć do: {exerciseById(slot).namePl}</button>}
        {earlierInSlot.length > 0 && <p className="mt-2 text-xs text-muted">Wcześniej w tym miejscu: {exerciseById(earlierInSlot[0].exerciseId).namePl}, {earlierInSlot.length} seria(e) zapisane.</p>}
        {kneeBlock ? <p className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">Blokada bezpieczeństwa: pomiń to ćwiczenie dziś (kolano).</p>
          : <div className={cx('mt-3 rounded-xl p-3 text-sm space-y-2', sug.action === 'increase' ? 'bg-accent/10' : sug.action === 'decrease' ? 'bg-warn/10' : 'bg-card2')}>
            <div><b>{sug.weightKg !== null ? fmtWeight(sug.weightKg, unit) : 'Dobierz ciężar'}</b> · {sug.targetReps} powt.{ex.perSide ? ' na stronę' : ''}</div>
            <div className="text-xs">{sug.reason}</div>
            {prev && <div className="text-xs text-muted">Ostatnio ({formatPl(prev.session.date)}): {prev.sets.map((x) => `${toDisplay(x.weightKg, unit)}×${x.reps}`).join(', ')}</div>}
            {dec ? <div className="text-xs flex items-center justify-between gap-2"><span>Decyzja: <b>{dec.decision === 'accepted' ? 'przyjęta' : dec.decision === 'rejected' ? 'zostaję przy ciężarze' : 'mój ciężar'}</b>{dec.chosenKg !== null ? ` · ${fmtWeight(dec.chosenKg, unit)}` : ''}</span>
                <button className="text-accent underline" onClick={async () => { const p = { ...(s.progress ?? {}) }; delete p[exId]; await db.sessions.update(s.id, { progress: p, updatedAt: now() }); }}>zmień</button></div>
              : needsDecision ? <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Btn className="text-sm min-h-11" onClick={() => decide('accepted', sug.weightKg)}>Przyjmij {fmtWeight(sug.weightKg!, unit)}</Btn>
                  <Btn kind="soft" className="text-sm min-h-11" onClick={() => decide('rejected', lastW ?? null)}>Zostań{lastW !== undefined ? ` przy ${fmtWeight(lastW, unit)}` : ''}</Btn>
                </div>
                {customKg === null ? <button className="text-xs text-accent underline" onClick={() => setCustomKg(toDisplay(sug.weightKg ?? lastW ?? 0, unit))}>Inny ciężar</button>
                  : <div className="flex items-center gap-2"><Stepper value={customKg} onChange={setCustomKg} step={toDisplay(loadStepKg(ex, unit, data.settings?.loadSteps), unit) || 1} unit={unit} /><Btn kind="soft" className="text-sm" onClick={() => decide('modified', fromDisplay(customKg, unit))}>Zapisz</Btn></div>}
              </div> : null}
          </div>}
        {lvlB && idx >= 5 && <p className="text-xs text-warn mt-2">Plan B: to ćwiczenie jest opcjonalne.</p>}
      </Card>
      {Array.from({ length: Math.max(planned, doneCount(exId)) }, (_, i) => (
        <SetRow key={`${exId}-${i}-${plannedKg ?? 'x'}`} s={s} te={te} ex={ex} slot={slot} index={i} existing={done.find((x) => x.exerciseId === exId && x.setIndex === i)} unit={unit} stepKg={loadStepKg(ex, unit, data.settings?.loadSteps)}
          defaultWeight={done.filter((x) => x.exerciseId === exId).at(-1)?.weightKg ?? plannedKg ?? 0} defaultReps={sug.action === 'reps' ? Math.min(te.repMax, (prev?.sets[i]?.reps ?? te.repMin - 1) + 1) : sug.action === 'hold' ? (prev?.sets[i]?.reps ?? te.repMin) : te.repMin} disabled={kneeBlock} />
      ))}
      <Card>
        <div className="text-sm mb-2">Technika w tym ćwiczeniu</div>
        <div className="grid grid-cols-2 gap-2">
          {(['ok', 'bad'] as const).map((t) => <button key={t} onClick={() => db.sessions.update(s.id, { technique: { ...s.technique, [exId]: t }, updatedAt: now() })} className={cx('min-h-11 rounded-lg text-sm', s.technique[exId] === t ? 'bg-accent text-accent-ink font-semibold' : 'bg-card2')}>{t === 'ok' ? 'Poprawna' : 'Słabsza / niepewna'}</button>)}
        </div>
      </Card>
      <div className="grid grid-cols-4 gap-2">
        <Btn kind="soft" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="px-0"><ChevronLeft className="mx-auto" /></Btn>
        <Btn kind="soft" onClick={() => move(-1)} className="px-0" disabled={idx === 0}><ArrowUp className="mx-auto" size={18} /></Btn>
        <Btn kind="soft" onClick={() => move(1)} className="px-0" disabled={idx >= order.length - 1}><ArrowDown className="mx-auto" size={18} /></Btn>
        <Btn kind="soft" onClick={skip} className="px-0"><SkipForward className="mx-auto" size={18} /></Btn>
      </div>
      {idx < order.length - 1 ? <Btn className="w-full" onClick={() => setIdx(idx + 1)}>Następne ćwiczenie <ChevronRight size={18} className="inline" /></Btn>
        : <Btn className="w-full" onClick={() => setFinish(true)}>Zakończ trening</Btn>}
      {finish && <FinishSheet s={s} onClose={() => setFinish(false)} onDone={onExit} />}
      {swapOpen && <SwapSheet slot={slot} current={exId} options={opts} onPick={doSwap} onClose={() => setSwapOpen(false)} />}
    </div>
  );
}

function InfoBtn({ e, data, d }: { e: ExerciseCard; data: AppData; d: Derived }) {
  const [o, setO] = useState<ExerciseCard | null>(null);
  return <><button aria-label="Instrukcja" onClick={() => setO(e)} className="p-2 rounded-lg bg-card2"><Info size={18} /></button>{o && <ExerciseSheet e={o} data={data} d={d} onOpen={setO} onClose={() => setO(null)} />}</>;
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

function SetRow({ s, te, ex, slot, index, existing, defaultWeight, defaultReps, disabled, unit, stepKg }: { s: WorkoutSession; te: TemplateExercise; ex: ExerciseCard; slot: string; index: number; existing?: WorkoutSet; defaultWeight: number; defaultReps: number; disabled: boolean; unit: WeightUnit; stepKg: number }) {
  const key = `ws-draft-${s.id}-${ex.id}-${index}`;
  const [w, setW] = useState<number>(() => existing?.weightKg ?? JSON.parse(localStorage.getItem(key) ?? 'null')?.w ?? defaultWeight);
  const [r, setR] = useState<number>(() => existing?.reps ?? JSON.parse(localStorage.getItem(key) ?? 'null')?.r ?? defaultReps);
  const [rir, setRir] = useState<number | undefined>(existing?.rir);
  const [pain, setPain] = useState<number | undefined>(existing?.pain);
  const [more, setMore] = useState(false);
  useEffect(() => { if (!existing) localStorage.setItem(key, JSON.stringify({ w, r })); }, [w, r, key, existing]);
  const isDone = !!existing?.done;
  async function save() {
    const t = now();
    await db.sets.put({ id: existing?.id ?? uid(), sessionId: s.id, exerciseId: ex.id, slot: existing?.slot ?? slot, setIndex: index, weightKg: w, reps: r, rir, pain, done: true, createdAt: existing?.createdAt ?? t, updatedAt: t });
    await db.sessions.update(s.id, { updatedAt: t });
    localStorage.removeItem(key);
    if (!isDone) { localStorage.setItem('restUntil', String(Date.now() + te.restSec * 1000)); window.dispatchEvent(new Event('rest')); }
    if ((pain ?? 0) >= 4) toast('Ból ≥4/10: przerwij to ćwiczenie i nie dokładaj ciężaru.');
  }
  return (
    <Card className={cx(isDone && 'border-accent/50')}>
      <div className="flex items-center justify-between mb-2"><span className="text-sm font-semibold">Seria {index + 1}</span>{isDone && <Badge tone="accent"><Check size={12} /> zapisana</Badge>}</div>
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <Stepper value={toDisplay(w, unit)} onChange={(v) => setW(fromDisplay(v, unit))} step={toDisplay(stepKg, unit) || 1} unit={unit} />
        <Stepper value={r} onChange={setR} step={1} unit={ex.perSide ? 'na str.' : 'powt.'} />
      </div>
      <div className="flex items-center gap-1 mt-2" role="group" aria-label="Zapas powtórzeń (RIR), opcjonalnie">
        <span className="text-xs text-muted mr-1">Zapas:</span>
        {[0, 1, 2, 3, 4].map((v) => <button key={v} aria-pressed={rir === v} onClick={() => setRir(rir === v ? undefined : v)} className={cx('h-9 min-w-9 px-2 rounded-lg text-xs num', rir === v ? 'bg-accent text-accent-ink font-semibold' : 'bg-card2')}>{v === 4 ? '4+' : v}</button>)}
        <button className="ml-auto text-xs text-accent" onClick={() => setMore(!more)}>{pain !== undefined ? `ból ${pain}` : 'ból?'}</button>
      </div>
      {more && <div className="mt-2"><Scale label="Ból podczas serii" min={0} max={10} value={pain} onChange={setPain} hint="0 brak" /></div>}
      <Btn className="w-full mt-3" kind={isDone ? 'soft' : 'primary'} disabled={disabled} onClick={save}>{isDone ? 'Popraw serię' : 'Seria zrobiona'}</Btn>
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
      <button className="text-sm underline" onClick={() => { localStorage.removeItem('restUntil'); setLeft(0); }}>pomiń</button>
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
