import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Info, Play, SkipForward, Timer } from 'lucide-react';
import type { ScreenProps } from '../App';
import { db, now, uid } from '../db/db';
import { EXERCISES, exerciseById, WORKOUTS, type ExerciseCard, type TemplateExercise } from '../data/exercises';
import { formatPl, range } from '../domain/dates';
import { withDaughter, cycleSummary } from '../domain/schedule';
import { plannedSetsFor, suggestNext, type Suggestion } from '../domain/progression';
import type { WorkoutSession, WorkoutSet } from '../domain/types';
import type { AppData, Derived } from '../db/repo';
import { ExerciseAnim } from '../ui/ExerciseAnim';
import { Badge, Btn, Card, cx, Field, NumInput, Scale, Sheet, Stepper, Title, toast } from '../ui/kit';

export function Training({ data, d }: ScreenProps) {
  const [card, setCard] = useState<ExerciseCard | null>(null);
  const [active, setActive] = useState<string | null>(d.inProgress?.id ?? null);
  const session = data.sessions.find((s) => s.id === active && s.status === 'in_progress');
  const c = d.custody!;
  const sum = cycleSummary(c, data.sessions, d.today, d.plan!.workoutsPer14d);
  const next = d.todayWorkout ?? d.upcoming[0];

  async function start(t: 'A' | 'B') {
    if (d.safety.level === 'urgent') return toast('Objaw alarmowy: dziś bez treningu');
    const id = uid();
    await db.sessions.add({ id, createdAt: now(), updatedAt: now(), date: d.today, templateId: t, status: 'in_progress', order: WORKOUTS[t].map((e) => e.exerciseId), skipped: [], technique: {}, painBefore: d.morningToday?.kneePain, startedAt: now(), source: 'manual' });
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
          <Title>Trening {t}</Title>
          {WORKOUTS[t].map((te) => {
            const e = exerciseById(te.exerciseId);
            return (
              <button key={te.exerciseId} onClick={() => setCard(e)} className="w-full flex justify-between items-center py-2.5 border-b border-line last:border-0 text-left">
                <span className="text-sm">{e.namePl} {e.knee !== 'none' && <Badge tone={e.knee === 'moderate' ? 'warn' : 'muted'}>kolano</Badge>}</span>
                <span className="text-xs text-muted num">{plannedSetsFor(te.sets, d.weekIdx)}×{te.repMin === te.repMax ? te.repMin : `${te.repMin}–${te.repMax}`}{e.perSide ? '/str.' : ''} · {te.restSec}s</span>
              </button>
            );
          })}
        </Card>
      ))}
      <Card><Title>Biblioteka ćwiczeń</Title><div className="flex flex-wrap gap-1.5">{EXERCISES.map((e) => <button key={e.id} onClick={() => setCard(e)} className="rounded-full bg-card2 px-3 py-2 text-sm">{e.namePl}</button>)}</div></Card>
      {card && <ExerciseSheet e={card} onClose={() => setCard(null)} />}
    </>
  );
}

export function ExerciseSheet({ e, onClose }: { e: ExerciseCard; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={e.namePl}>
      <div className="text-sm text-muted">{e.nameEn} · {e.muscles}</div>
      <ExerciseAnim id={e.id} />
      <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(e.nameEn + ' proper form')}`} target="_blank" rel="noreferrer" className="block text-center min-h-11 leading-[2.75rem] rounded-xl bg-card2 text-sm text-accent">Zobacz wideo (YouTube)</a>
      <Sec t="Sprzęt">{e.equipment}{e.setup && `. ${e.setup}`}</Sec>
      <Sec t="Pozycja początkowa">{e.start}</Sec>
      <div><div className="text-xs uppercase text-muted mb-1">Wykonanie</div><ol className="list-decimal pl-5 text-sm space-y-1">{e.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
      <Sec t="Oddech">{e.breathing}</Sec>
      <Sec t="Najczęstsze błędy">{e.mistakes.join(' · ')}</Sec>
      <Sec t="Dobór ciężaru">{e.loadTip}</Sec>
      <Sec t="Kolano">{{ none: 'Nie obciąża kolana.', low: 'Niewielkie obciążenie kolana.', moderate: 'Obciąża kolano: wymaga ostrożności do czasu oceny specjalisty.' }[e.knee]}</Sec>
      {e.warnings && <Sec t="Uwagi">{e.warnings}</Sec>}
      <Sec t="Alternatywy">{e.alternatives.join(', ')}</Sec>
      <p className="text-xs text-muted">Przy pierwszym treningu poproś trenera dyżurnego o pokazanie ustawienia maszyny. Wideo otwiera wyniki wyszukiwania: wybieraj kanały trenerów lub fizjoterapeutów.</p>
    </Sheet>
  );
}
const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => <div><div className="text-xs uppercase text-muted mb-0.5">{t}</div><div className="text-sm">{children}</div></div>;

function lastSetsFor(data: AppData, exerciseId: string, excludeSession: string) {
  const sessions = data.sessions.filter((s) => s.status === 'completed' && s.id !== excludeSession).sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt);
  for (const s of sessions) {
    const sets = data.sets.filter((x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.done).sort((a, b) => a.setIndex - b.setIndex);
    if (sets.length) return { session: s, sets };
  }
  return undefined;
}

function SessionView({ data, d, s, onExit }: { data: AppData; d: Derived; s: WorkoutSession; onExit: () => void }) {
  const tpl = WORKOUTS[s.templateId];
  const order = s.order.filter((id) => tpl.some((t) => t.exerciseId === id));
  const [idx, setIdx] = useState(() => Number(localStorage.getItem(`ws-idx-${s.id}`) ?? 0));
  const [finish, setFinish] = useState(false);
  useEffect(() => { localStorage.setItem(`ws-idx-${s.id}`, String(idx)); }, [idx, s.id]);
  const exId = order[Math.min(idx, order.length - 1)];
  const te = tpl.find((t) => t.exerciseId === exId)!;
  const ex = exerciseById(exId);
  const done = data.sets.filter((x) => x.sessionId === s.id);
  const lvlB = d.readiness.level === 'B';
  const planned = lvlB ? Math.min(2, te.sets) : plannedSetsFor(te.sets, d.weekIdx);
  const kneeBlock = (d.safety.level === 'stop_legs' && ex.knee !== 'none') || (d.safety.level === 'caution_legs' && ex.knee === 'moderate');
  const prev = lastSetsFor(data, exId, s.id);
  const sug: Suggestion = ex.knee === 'moderate' && !data.health?.kneeCleared && !kneeBlock
    ? { action: 'hold', weightKg: 0, targetReps: `${te.repMin}–${te.repMax}`, reason: 'Bez obciążenia do czasu oceny kolana przez specjalistę.' }
    : suggestNext({ last: prev?.sets, plannedSets: planned, repMin: te.repMin, repMax: te.repMax, increment: ex.increment, technique: prev?.session.technique[exId], safetyBlock: kneeBlock, minRir: 1 });

  async function move(dir: -1 | 1) {
    const o = [...s.order]; const i = o.indexOf(exId); const j = i + dir;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    await db.sessions.update(s.id, { order: o, updatedAt: now() }); setIdx(idx + dir);
  }
  async function skip() {
    await db.sessions.update(s.id, { skipped: [...new Set([...s.skipped, exId])], updatedAt: now() });
    if (idx < order.length - 1) setIdx(idx + 1);
  }
  const doneCount = (id: string) => done.filter((x) => x.exerciseId === id && x.done).length;

  return (
    <div className="space-y-3 pb-4">
      <header className="flex items-center justify-between pt-2">
        <button onClick={onExit} className="text-sm text-accent flex items-center"><ChevronLeft size={18} />Wyjdź (zapisane)</button>
        <Badge tone="accent">Trening {s.templateId}{lvlB ? ' · skrócony' : ''}</Badge>
      </header>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {order.map((id, i) => (
          <button key={id} onClick={() => setIdx(i)} className={cx('shrink-0 rounded-full px-3 py-1.5 text-xs', i === idx ? 'bg-accent text-accent-ink font-semibold' : s.skipped.includes(id) ? 'bg-card2 text-muted line-through' : doneCount(id) ? 'bg-accent/20 text-accent' : 'bg-card2')}>
            {i + 1}. {exerciseById(id).namePl.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>
      <RestTimer />
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div><h2 className="text-xl font-bold leading-tight">{ex.namePl}</h2><div className="text-sm text-muted">{planned} × {te.repMin === te.repMax ? te.repMin : `${te.repMin}–${te.repMax}`}{ex.perSide ? ' na stronę' : ''} · przerwa {te.restSec}s · ~3 RIR</div></div>
          <InfoBtn e={ex} />
        </div>
        {kneeBlock ? <p className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">Blokada bezpieczeństwa: pomiń to ćwiczenie dziś (kolano).</p>
          : <p className={cx('mt-3 rounded-xl p-3 text-sm', sug.action === 'increase' ? 'bg-accent/10' : 'bg-card2')}>
            <b>{sug.weightKg !== null ? `${sug.weightKg} kg` : 'Dobierz ciężar'}</b> · {sug.targetReps} powt. — {sug.reason}
            {prev && <span className="block text-xs text-muted mt-1">Ostatnio ({formatPl(prev.session.date)}): {prev.sets.map((x) => `${x.weightKg}×${x.reps}`).join(', ')}</span>}
          </p>}
        {lvlB && idx >= 5 && <p className="text-xs text-warn mt-2">Plan B: to ćwiczenie jest opcjonalne.</p>}
      </Card>
      {Array.from({ length: Math.max(planned, doneCount(exId)) }, (_, i) => (
        <SetRow key={`${exId}-${i}`} s={s} te={te} ex={ex} index={i} existing={done.find((x) => x.exerciseId === exId && x.setIndex === i)}
          defaultWeight={done.filter((x) => x.exerciseId === exId).at(-1)?.weightKg ?? sug.weightKg ?? prev?.sets[0]?.weightKg ?? 0} defaultReps={te.repMin} disabled={kneeBlock} />
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
    </div>
  );
}

function InfoBtn({ e }: { e: ExerciseCard }) {
  const [o, setO] = useState(false);
  return <><button aria-label="Instrukcja" onClick={() => setO(true)} className="p-2 rounded-lg bg-card2"><Info size={18} /></button>{o && <ExerciseSheet e={e} onClose={() => setO(false)} />}</>;
}

function SetRow({ s, te, ex, index, existing, defaultWeight, defaultReps, disabled }: { s: WorkoutSession; te: TemplateExercise; ex: ExerciseCard; index: number; existing?: WorkoutSet; defaultWeight: number; defaultReps: number; disabled: boolean }) {
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
    await db.sets.put({ id: existing?.id ?? uid(), sessionId: s.id, exerciseId: ex.id, setIndex: index, weightKg: w, reps: r, rir, pain, done: true, createdAt: existing?.createdAt ?? t, updatedAt: t });
    await db.sessions.update(s.id, { updatedAt: t });
    localStorage.removeItem(key);
    if (!isDone) { localStorage.setItem('restUntil', String(Date.now() + te.restSec * 1000)); window.dispatchEvent(new Event('rest')); }
    if ((pain ?? 0) >= 4) toast('Ból ≥4/10: przerwij to ćwiczenie i nie dokładaj ciężaru.');
  }
  return (
    <Card className={cx(isDone && 'border-accent/50')}>
      <div className="flex items-center justify-between mb-2"><span className="text-sm font-semibold">Seria {index + 1}</span>{isDone && <Badge tone="accent"><Check size={12} /> zapisana</Badge>}</div>
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <Stepper value={w} onChange={setW} step={ex.increment || 1} unit="kg" />
        <Stepper value={r} onChange={setR} step={1} unit={ex.perSide ? 'na str.' : 'powt.'} />
      </div>
      <button className="text-xs text-accent mt-2" onClick={() => setMore(!more)}>{more ? 'Ukryj' : 'RIR i ból'}{rir !== undefined ? ` · RIR ${rir}` : ''}{pain !== undefined ? ` · ból ${pain}` : ''}</button>
      {more && <div className="space-y-3 mt-2">
        <Scale label="Powtórzenia w zapasie (RIR)" min={0} max={5} value={rir} onChange={setRir} />
        <Scale label="Ból podczas serii" min={0} max={10} value={pain} onChange={setPain} hint="0 brak" />
      </div>}
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

