import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, ClipboardPaste, Droplets, Footprints, Dumbbell, Moon, Plus, Sunrise, Sunset } from 'lucide-react';
import { parseSync, type HealthSync } from '../domain/sync';
import type { ScreenProps } from '../App';
import { db, now, uid } from '../db/db';
import { productEntry } from '../domain/recipes';
import type { RejectReason } from '../domain/types';
import { HIDE_DAYS, REASON_LABEL, pickRecommendation, type Suppression } from '../domain/feedback';
import { addDays, formatPl } from '../domain/dates';
import { mean } from '../domain/calc';
import { DAY_MESSAGE, nextBestAction, type NextAction } from '../domain/nextAction';
import { defaultMeal } from '../domain/mealSlot';
import { reportDue } from '../domain/weeklyCheckin';
import { Bar, Btn, Card, cx, inputCls, Sheet, Title, toast } from '../ui/kit';
import { MorningSheet, EveningSheet } from './CheckIns';
import { FoodPicker, addQuickEntry } from './FoodPicker';
import { MEALS } from './Diet';
import { WeeklyReportCard, asksKnee } from './WeeklyReport';

const localHM = () => {
  const p = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  return { hour: Number(p.find((x) => x.type === 'hour')?.value ?? 12) % 24, minute: Number(p.find((x) => x.type === 'minute')?.value ?? 0) };
};

export function Today({ data, d, go }: ScreenProps) {
  const [mOpen, setMOpen] = useState(false);
  const [eOpen, setEOpen] = useState(false);
  const [prefill, setPrefill] = useState<HealthSync | undefined>();
  const [pasteBox, setPasteBox] = useState(false);
  const [pasteTxt, setPasteTxt] = useState('');
  const [adding, setAdding] = useState(false);
  const [meal, setMeal] = useState(1);
  const [macrosOpen, setMacrosOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    const take = () => {
      const raw = sessionStorage.getItem('pendingSync');
      if (raw) { sessionStorage.removeItem('pendingSync'); setPrefill(JSON.parse(raw)); setEOpen(true); }
    };
    take(); window.addEventListener('pendingSync', take);
    return () => window.removeEventListener('pendingSync', take);
  }, []);
  function applySync(text: string) {
    const r = parseSync(text);
    if (!r) return toast('W schowku nie ma danych ze Skrótu (MBOS1;…)');
    setPrefill(r); setPasteBox(false); setPasteTxt(''); setEOpen(true);
  }
  async function pasteHealth() {
    try { applySync(await navigator.clipboard.readText()); } catch { setPasteBox(true); }
  }

  const t = d.targets!;
  const hm = localHM();
  const todayEntries = useMemo(() => data.entries.filter((e) => e.date === d.today), [data.entries, d.today]);
  const eaten = d.intake?.kcal ?? 0;
  const left = Math.round(t.kcal - eaten);
  const w7 = mean(d.weights.filter((w) => w.date > addDays(d.today, -7)).map((w) => w.value));
  const weeklyDue = reportDue(new Date(), data.weeklyCheckins ?? [], { startedOn: [...data.plans].sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0]?.validFrom, snoozedOn: data.settings?.reportSnoozedOn }).show;
  const { rec, hidden } = pickRecommendation(d.recs, data.feedback, d.today);
  const lvl = d.morningToday ? d.readiness.level : undefined;
  const action = nextBestAction({
    today: d.today, hour: hm.hour, safetyLevel: d.safety.level, alerts: d.safety.alerts,
    inProgress: d.inProgress, todayWorkout: d.todayWorkout, doneToday: !!d.doneToday, readiness: lvl, sleepMinutes: d.morningToday?.sleepMinutes,
    entriesToday: todayEntries.length, returnMode: d.returnMode, weeklyDue, rec, feedback: data.feedback,
  });
  const urgent = d.safety.alerts.filter((a) => a.level === 'urgent' || a.level === 'stop_legs');
  const info = d.safety.alerts.filter((a) => a.level === 'caution_legs' || (a.level === 'none' && a.code !== 'knee_not_cleared'));
  const steps = d.eveningToday?.steps;

  function openAdd() {
    const last = [...todayEntries].sort((a, b) => b.createdAt - a.createdAt)[0];
    setMeal(defaultMeal(hm, d.plan?.mealsPerDay ?? 4, last, now()));
    setAdding(true);
  }
  async function undoable(id: string, label: string) {
    toast(label, { label: 'Cofnij', run: () => { db.entries.delete(id).then(() => toast('Cofnięto')); } });
  }
  async function addWater(ml: number) {
    await db.water.put({ date: d.today, ml: Math.max(0, d.water + ml), updatedAt: now() });
  }
  async function act(a: NextAction) {
    const target = a.cta?.target;
    if (target === 'training') return go('training');
    if (target === 'food') return openAdd();
    if (target === 'return') {
      await db.feedback.add({ id: uid(), createdAt: now(), updatedAt: now(), recId: 'return', date: d.today, action: 'accepted' });
      toast('Zaczynamy od dzisiaj');
    }
  }

  return (
    <>
      <header className="pt-1">
        <div className="text-sm text-muted">{formatPl(d.today)}</div>
        <h1 className="text-2xl font-bold">Cześć{data.profile?.name && data.profile.name !== 'Ja' ? `, ${data.profile.name}` : ''}!</h1>
        <p className="text-sm text-muted">Dzisiaj też możesz zrobić coś dla siebie.</p>
      </header>

      {urgent.map((a) => (
        <div key={a.code} className="rounded-2xl border border-danger bg-danger/10 p-4" role="alert">
          <div className="flex items-center gap-2 font-semibold text-danger"><AlertTriangle size={18} />{a.title}</div>
          <p className="text-sm mt-1">{a.text}</p>
          {a.level === 'urgent' && <><a href="tel:112" className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-danger px-4 font-semibold text-white">Zadzwoń 112</a><span className="ml-3 text-sm">numer alarmowy: <b>112</b></span></>}
        </div>
      ))}

      <Card>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-muted">{todayEntries.length ? (left >= 0 ? 'Zostało w planie' : 'Ponad plan') : 'Cel na dziś'}</div>
            <div className="num text-5xl font-bold leading-none mt-1">{(todayEntries.length ? Math.abs(left) : t.kcal).toLocaleString('pl-PL')}<span className="text-base font-normal text-muted"> kcal</span></div>
          </div>
          {todayEntries.length > 0 && <div className="text-right text-sm"><div className="num font-semibold">{Math.round(eaten).toLocaleString('pl-PL')} / {t.kcal.toLocaleString('pl-PL')}</div><div className="text-xs text-muted">zjedzone / cel</div></div>}
        </div>
        {todayEntries.length ? <div className="mt-3"><Bar value={eaten} max={t.kcal} /></div>
          : <p className="text-sm text-muted mt-2">Nie zapisano jeszcze jedzenia.</p>}
        {left < 0 && todayEntries.length > 0 && <p className="text-xs text-muted mt-2">Bez odrabiania: wracasz do zwykłego planu od następnego posiłku.</p>}
        <button className="w-full mt-3 text-left" onClick={() => setMacrosOpen(!macrosOpen)} aria-expanded={macrosOpen}>
          <div className="flex justify-between text-sm"><span>Białko</span><span className="num"><b>{Math.round(d.intake?.protein ?? 0)}</b> / {t.proteinG} g <ChevronRight size={14} className={cx('inline transition', macrosOpen && 'rotate-90')} /></span></div>
          <div className="mt-1.5"><Bar value={d.intake?.protein ?? 0} max={t.proteinG} /></div>
        </button>
        {d.intake && d.intake.coverage.protein < 1 && <p className="text-xs text-muted mt-1">Część wpisów bez białka: znane dla {Math.round(d.intake.coverage.protein * 100)}% kcal.</p>}
        {macrosOpen && <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
          {([['Tłuszcz', d.intake?.fat, t.fatG, 'fat'], ['Węglowodany', d.intake?.carbs, t.carbsG, 'carbs'], ['Błonnik', d.intake?.fiber, t.fiberG, 'fiber']] as const).map(([l, v, max, k]) => (
            <div key={l}><div className="text-xs text-muted">{l}</div><div className="num font-semibold">{Math.round(v ?? 0)}<span className="text-muted font-normal">/{max} g</span></div><div className="mt-1"><Bar value={v ?? 0} max={max} /></div>
              {d.intake && d.intake.coverage[k] < 1 && <div className="text-[11px] text-muted mt-0.5">znane dla {Math.round(d.intake.coverage[k] * 100)}% kcal</div>}</div>
          ))}
        </div>}
      </Card>

      <button onClick={openAdd} className="w-full min-h-16 rounded-2xl bg-accent text-accent-ink text-lg font-semibold flex items-center justify-center gap-2 active:opacity-80 shadow-sm"><Plus size={24} /> Dodaj jedzenie</button>

      <div className="grid grid-cols-2 gap-3">
        <Card onClick={() => setEOpen(true)}>
          <div className="flex items-center gap-1.5 text-xs text-muted"><Footprints size={14} /> Kroki</div>
          <div className="num text-2xl font-semibold mt-0.5">{steps !== undefined ? steps.toLocaleString('pl-PL') : '—'}</div>
          <div className="text-xs text-muted">cel ok. {d.steps.toLocaleString('pl-PL')}{steps === undefined ? ' · brak danych' : d.eveningToday?.healthSyncAt ? ` · Zdrowie ${new Date(d.eveningToday.healthSyncAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : ' · wpis ręczny'}</div>
        </Card>
        <Card onClick={() => go('training')}>
          <div className="flex items-center gap-1.5 text-xs text-muted"><Dumbbell size={14} /> Trening</div>
          {d.doneToday ? <div className="font-semibold mt-1">Zrobiony ✓</div>
            : d.inProgress ? <div className="font-semibold mt-1 text-accent">W trakcie: wznów</div>
            : d.todayWorkout && lvl !== 'C' ? <div className="font-semibold mt-1">Dzisiaj trening {d.todayWorkout.templateId}<div className="text-sm text-accent">rozpocznij →</div></div>
            : <div className="font-semibold mt-1">Dzisiaj odpoczynek{d.upcoming[0] && <div className="text-xs text-muted font-normal">następny: {formatPl(d.upcoming[0].date)}</div>}</div>}
        </Card>
      </div>
      {info.map((a) => <p key={a.code} className="text-sm text-warn px-1">⚠ {a.title}: {a.text}</p>)}

      <WeeklyReportCard data={data} d={d} showCard={action?.kind === 'weekly_report'} />
      {action && action.kind !== 'health' && action.kind !== 'weekly_report' && <ActionCard a={action} today={d.today} onAct={() => act(action)} />}

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted pl-1 pr-1">Check-in</span>
        <button onClick={() => setMOpen(true)} aria-label="Poranny check-in" className={cx('flex-1 min-h-12 rounded-2xl border px-3 text-sm flex items-center justify-center gap-1.5 whitespace-nowrap', d.morningToday ? 'border-line bg-card' : 'border-accent/40 bg-accent/10')}>
          <Sunrise size={18} className="text-accent shrink-0" />Rano{d.morningToday ? ' ✓' : ''}
        </button>
        <button onClick={() => setEOpen(true)} aria-label="Wieczorny check-in" className={cx('flex-1 min-h-12 rounded-2xl border px-3 text-sm flex items-center justify-center gap-1.5 whitespace-nowrap', hm.hour >= 18 && !d.eveningToday ? 'border-accent/40 bg-accent/10' : 'border-line bg-card')}>
          <Sunset size={18} className={hm.hour >= 18 ? 'text-accent shrink-0' : 'text-muted shrink-0'} />Wieczorem{d.eveningToday ? ' ✓' : ''}
        </button>
      </div>
      {lvl && <p className="text-sm text-muted px-1">{DAY_MESSAGE[lvl]}</p>}

      {w7.n > 0 && <button onClick={() => go('progress')} className="w-full text-left px-1 text-sm flex justify-between items-center min-h-11">
        <span>Średnia waga z 7 dni: <b className="num">{w7.value!.toFixed(1).replace('.', ',')} kg</b> <span className="text-muted">({w7.n} {w7.n === 1 ? 'ważenie' : w7.n < 5 ? 'ważenia' : 'ważeń'})</span></span><ChevronRight size={16} className="text-muted" />
      </button>}

      <button onClick={() => setDetailsOpen(!detailsOpen)} aria-expanded={detailsOpen} className="w-full min-h-12 flex items-center justify-between rounded-2xl border border-line bg-card px-4 text-sm">
        <span>Szczegóły dnia</span><ChevronRight size={18} className={cx('transition', detailsOpen && 'rotate-90')} />
      </button>
      {detailsOpen && <DayDetails data={data} d={d} onWater={addWater} onPaste={pasteHealth} hiddenRecs={hidden} />}

      <Sheet open={pasteBox} onClose={() => setPasteBox(false)} title="Wklej dane ze Zdrowia">
        <p className="text-sm text-muted">Przytrzymaj pole i wybierz „Wklej”.</p>
        <textarea className={inputCls + ' min-h-24 py-2'} value={pasteTxt} onChange={(e) => setPasteTxt(e.target.value)} placeholder="MBOS1;steps=…" />
        <Btn className="w-full" disabled={!pasteTxt} onClick={() => applySync(pasteTxt)}>Dalej</Btn>
      </Sheet>

      {adding && <FoodPicker foods={data.foods} entries={data.entries} title="Dodaj jedzenie" onClose={() => setAdding(false)}
        meal={{ value: meal, options: [...MEALS.slice(0, Math.max(1, Math.min(4, d.plan?.mealsPerDay ?? 4))).map((label, i) => ({ value: i + 1, label })), { value: 5, label: MEALS[4] }], onChange: setMeal }}
        onAdd={async (p, g) => { const e = productEntry(p, g, d.today, meal, uid(), now()); await db.entries.add(e); undoable(e.id, `Dodano: ${p.name}`); }}
        onQuick={async (name, kcal, protein) => { const id = uid(); await addQuickEntry(d.today, meal, name, kcal, protein, id); undoable(id, 'Dodano szacunek'); }}
        onNew={() => go('diet')} />}
      {mOpen && <MorningSheet open onClose={() => setMOpen(false)} data={data} d={d} onBackup={() => { sessionStorage.setItem('scrollTo', 'backup'); go('profile'); }} />}
      {eOpen && <EveningSheet open onClose={() => { setEOpen(false); setPrefill(undefined); }} d={d} prefill={prefill} />}
    </>
  );
}

/** Jedna sugestia na dziś. Zwykłą można odłożyć; porada coacha ma pełny wybór powodów (pamięć odrzuceń). */
function ActionCard({ a, today, onAct }: { a: NextAction; today: string; onAct: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [otherOpen, setOtherOpen] = useState(false);
  const [why, setWhy] = useState(false);
  async function feedback(action: 'accepted' | 'rejected', reason?: RejectReason) {
    await db.feedback.add({ id: uid(), createdAt: now(), updatedAt: now(), recId: a.recId, date: today, action, ...(reason ? { reason } : {}), ...(reason === 'other' && note.trim() ? { note: note.trim() } : {}) });
    setRejecting(false); setNote(''); setOtherOpen(false);
    if (action === 'accepted') return toast('Przyjęte');
    const health = a.importance === 'high';
    const days = health ? 0 : HIDE_DAYS[reason ?? 'not_now'];
    toast(reason === 'health' ? 'Zapisane. Objawy zapisz w check-inie; przy niepokojących skontaktuj się z lekarzem.' : days ? `Nie pokażę tej porady przez ${days} dni` : 'Nie pokażę jej dziś ponownie');
  }
  const tone = a.importance === 'high' ? 'border-warn/60' : 'border-accent/40';
  return (
    <Card className={tone}>
      <Title right={<button className="min-h-11 text-xs text-muted" onClick={() => setWhy(!why)} aria-expanded={why}>Dlaczego?</button>}>Na dziś</Title>
      <div className="font-semibold">{a.title}</div>
      <p className="text-sm mt-1">{a.text}</p>
      {why && <p className="text-xs text-muted mt-2">Źródło: {a.source}.</p>}
      {!rejecting ? (
        <div className="flex gap-2 mt-3">
          {a.cta ? <Btn className="flex-1" onClick={onAct}>{a.cta.label}</Btn> : a.kind === 'coach' ? <Btn kind="soft" className="flex-1" onClick={() => feedback('accepted')}>OK, robię</Btn> : null}
          {a.dismissible && <Btn kind="ghost" onClick={() => (a.kind === 'coach' ? setRejecting(true) : feedback('rejected', 'not_now'))}>Nie teraz{a.kind === 'coach' ? '…' : ''}</Btn>}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-muted">Dlaczego? Na tej podstawie rzadziej pokażę podobne porady.</div>
          <div className="grid grid-cols-2 gap-1.5">{(Object.keys(REASON_LABEL) as RejectReason[]).map((r) => <Btn key={r} kind="soft" className="text-xs min-h-11" onClick={() => (r === 'other' ? setOtherOpen(true) : feedback('rejected', r))}>{REASON_LABEL[r]}</Btn>)}</div>
          {otherOpen && <div className="flex gap-2"><input className={inputCls + ' flex-1'} placeholder="Krótko, co nie pasuje (opcjonalnie)" value={note} onChange={(e) => setNote(e.target.value)} /><Btn onClick={() => feedback('rejected', 'other')}>OK</Btn></div>}
          <button className="min-h-11 text-xs text-muted underline" onClick={() => { setRejecting(false); setNote(''); setOtherOpen(false); }}>anuluj</button>
        </div>
      )}
    </Card>
  );
}

function DayDetails({ data, d, onWater, onPaste, hiddenRecs }: { data: ScreenProps['data']; d: ScreenProps['d']; onWater: (ml: number) => void; onPaste: () => void; hiddenRecs: { rec: { id: string; title: string }; s: Suppression }[] }) {
  const [showHidden, setShowHidden] = useState(false);
  const t = d.targets!;
  async function reset(recId: string) {
    await db.feedback.add({ id: uid(), createdAt: now(), updatedAt: now(), recId, date: d.today, action: 'reset' });
    toast('Porada znów będzie pokazywana');
  }
  return (
    <>
      <Card>
        <div className="flex items-center justify-between"><div><div className="text-xs text-muted">Woda</div><div className="num text-xl font-semibold">{(d.water / 1000).toFixed(2)} l</div></div><Droplets size={18} className="text-accent" /></div>
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => onWater(250)} className="flex-1 min-h-11 rounded-lg bg-card2 text-sm">+250 ml</button>
          <button onClick={() => onWater(500)} className="flex-1 min-h-11 rounded-lg bg-card2 text-sm">+500 ml</button>
          <button onClick={() => onWater(-250)} className="min-h-11 px-3 rounded-lg bg-card2 text-sm text-muted" aria-label="Cofnij 250 ml">−</button>
        </div>
      </Card>
      <Card>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted flex items-center gap-1.5"><Moon size={14} /> Sen</span><span>{d.morningToday?.sleepMinutes ? `${(d.morningToday.sleepMinutes / 60).toFixed(1)} h${d.morningToday.sleepQuality ? ` · jakość ${d.morningToday.sleepQuality}/5` : ''}` : 'brak danych'}</span></div>
          {asksKnee(data) && <div className="flex justify-between"><span className="text-muted">Kolano</span><span>{d.morningToday?.kneePain !== undefined ? `${d.morningToday.kneePain}/10` : 'brak danych'} · {data.health?.kneeCleared ? 'po ocenie specjalisty' : 'bez oceny specjalisty'}</span></div>}
          {t.dayType !== 'flat' && <div className="flex justify-between"><span className="text-muted">Typ dnia</span><span>{t.dayType === 'training' ? 'treningowy' : 'bez treningu'}: {t.kcal} kcal</span></div>}
        </div>
      </Card>
      <button onClick={onPaste} className="w-full flex items-center justify-center gap-2 min-h-12 rounded-2xl border border-line bg-card text-sm"><ClipboardPaste size={18} className="text-accent" /> Wklej dane ze Zdrowia</button>
      {hiddenRecs.length > 0 && <button className="min-h-11 text-xs text-muted underline w-full text-center" onClick={() => setShowHidden(!showHidden)}>Ukryte porady ({hiddenRecs.length})</button>}
      {showHidden && hiddenRecs.map(({ rec: h, s }) => (
        <Card key={h.id}><div className="text-sm font-semibold">{h.title}</div>
          <div className="text-xs text-muted">{s.reason ? REASON_LABEL[s.reason] : ''}{s.until ? ` · ukryta do ${formatPl(s.until)}` : ''}{s.rejections >= 3 ? ' · odrzucana kilka razy' : ''}</div>
          <Btn kind="soft" className="w-full mt-2 text-sm" onClick={() => reset(h.id)}>Pokazuj znowu</Btn></Card>
      ))}
    </>
  );
}
