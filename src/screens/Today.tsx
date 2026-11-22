import { useEffect, useState } from 'react';
import { AlertTriangle, Baby, ClipboardPaste, Droplets, Moon, RotateCcw, Sunrise, Sunset } from 'lucide-react';
import { parseSync, type HealthSync } from '../domain/sync';
import type { ScreenProps } from '../App';
import { db, now, uid } from '../db/db';
import { effectiveTemplates } from '../domain/recipes';
import type { DayTemplateRec, RejectReason } from '../domain/types';
import { HIDE_DAYS, REASON_LABEL, pickRecommendation } from '../domain/feedback';
import { DAY_TEMPLATES } from '../data/foods';
import { PLAN_COPY } from '../domain/readiness';
import { addDays, diffDays, formatPl } from '../domain/dates';
import { mean } from '../domain/calc';
import { Badge, Bar, Btn, Card, cx, inputCls, Sheet, Stat, Title, toast } from '../ui/kit';
import { MorningSheet, EveningSheet } from './CheckIns';

export function templateFor(date: string, user: DayTemplateRec[] = []) { return effectiveTemplates(DAY_TEMPLATES, user)[((diffDays('2026-01-05', date) % 3) + 3) % 3]; }

export function Today({ data, d, go }: ScreenProps) {
  const [mOpen, setMOpen] = useState(false);
  const [eOpen, setEOpen] = useState(false);
  const [back, setBack] = useState(false);
  const [prefill, setPrefill] = useState<HealthSync | undefined>();
  const [pasteBox, setPasteBox] = useState(false);
  const [pasteTxt, setPasteTxt] = useState('');
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
  const plan = { ...d.plan!, kcal: d.targets!.kcal, proteinG: d.targets!.proteinG };
  const lvl = d.readiness.level;
  const tpl = templateFor(d.today, data.mealTemplates);
  const w7 = mean(d.weights.filter((w) => w.date > addDays(d.today, -7)).map((w) => w.value));
  const lastW = d.weights.at(-1);
  const goal = data.profile?.goals[0];
  const urgent = d.safety.alerts.filter((a) => a.level === 'urgent' || a.level === 'stop_legs');
  const info = d.safety.alerts.filter((a) => a.level === 'caution_legs' || (a.level === 'none' && a.code !== 'knee_not_cleared'));
  const trainingToday = d.todayWorkout && lvl !== 'C' && d.safety.level !== 'urgent';
  const hour = Number(new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }).format(new Date()));

  const main = d.safety.level === 'urgent' ? 'Najpierw zdrowie: bez treningu, w razie potrzeby 112.'
    : d.inProgress ? 'Dokończ rozpoczęty trening.'
    : trainingToday ? `Trening ${d.todayWorkout!.templateId}${lvl === 'B' ? ' w wersji skróconej' : ''}.`
    : lvl === 'C' ? 'Odpoczynek i regularne, proste posiłki.'
    : d.recs[0] && d.recs[0].priority >= 60 ? d.recs[0].action
    : `${plan.mealsPerDay} posiłki z planu i ${d.steps.toLocaleString('pl-PL')} kroków.`;
  const why = d.morningToday ? `${PLAN_COPY[lvl].title.split(':')[0]}, bo: ${d.readiness.reasons.join(', ')}.` : 'Zrób check-in, żeby dopasować plan do dzisiejszego dnia.';

  const eaten = d.intake?.kcal ?? 0;
  async function addWater(ml: number) {
    await db.water.put({ date: d.today, ml: Math.max(0, d.water + ml), updatedAt: now() });
  }
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [otherOpen, setOtherOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  async function feedback(recId: string, action: 'accepted' | 'rejected' | 'reset', reason?: RejectReason, health?: boolean) {
    await db.feedback.add({ id: uid(), createdAt: now(), updatedAt: now(), recId, date: d.today, action, ...(reason ? { reason } : {}), ...(reason === 'other' && note.trim() ? { note: note.trim() } : {}) });
    setRejecting(false); setNote(''); setOtherOpen(false);
    if (action === 'accepted') return toast('Przyjęte');
    if (action === 'reset') return toast('Porada znów będzie pokazywana');
    const days = health ? 0 : HIDE_DAYS[reason ?? 'not_now'];
    toast(reason === 'health' ? 'Zapisane. Objawy zapisz w check-inie; przy niepokojących skontaktuj się z lekarzem.' : days ? `Nie pokażę tej porady przez ${days} dni` : 'Nie pokażę jej dziś ponownie');
  }
  const { rec, hidden } = pickRecommendation(d.recs, data.feedback, d.today);

  return (
    <>
      <header className="flex items-end justify-between pt-2">
        <div><div className="text-sm text-muted">{formatPl(d.today)}</div><h1 className="text-2xl font-bold">Cześć{data.profile?.name ? `, ${data.profile.name}` : ''}</h1></div>
        <div className="flex gap-1.5">
          {d.withDaughterToday && <Badge tone="accent"><Baby size={13} /> dzień z córką</Badge>}
          <Badge tone={lvl === 'A' ? 'accent' : 'warn'}>Plan {lvl}</Badge>
        </div>
      </header>

      {urgent.map((a) => (
        <div key={a.code} className="rounded-2xl border border-danger bg-danger/10 p-4" role="alert">
          <div className="flex items-center gap-2 font-semibold text-danger"><AlertTriangle size={18} />{a.title}</div>
          <p className="text-sm mt-1">{a.text}</p>
          {a.level === 'urgent' && <a href="tel:112" className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-danger px-4 font-semibold text-white">Zadzwoń 112</a>}{a.level === "urgent" && <span className="ml-3 text-sm">numer alarmowy: <b>112</b></span>}
        </div>
      ))}

      {d.returnMode && !d.morningToday && (
        <Card className="border-accent">
          <div className="font-semibold">Dobrze, że jesteś</div>
          <p className="text-sm text-muted mt-1">Historia i osiągnięcia zostają. Nie musisz niczego nadrabiać.</p>
          {back ? <ul className="mt-2 text-sm list-disc pl-5 space-y-1"><li>Check-in (30 s)</li><li>2 posiłki z planu</li><li>15 min spaceru</li></ul>
            : <Btn className="w-full mt-3" onClick={() => setBack(true)}><RotateCcw size={16} className="inline mr-1" />Wracam do planu</Btn>}
        </Card>
      )}

      {!d.morningToday ? (
        <Card onClick={() => setMOpen(true)} className="bg-accent/10 border-accent/40">
          <div className="flex items-center gap-3"><Sunrise className="text-accent" /><div><div className="font-semibold">Poranny check-in</div><div className="text-sm text-muted">Waga, sen, energia · ~30 s</div></div></div>
        </Card>
      ) : null}

      <Card>
        <Title right={<button className="text-xs text-accent" onClick={() => setMOpen(true)}>{d.morningToday ? 'edytuj check-in' : ''}</button>}>Najważniejsze dziś</Title>
        <p className="text-lg font-semibold leading-snug">{main}</p>
        <p className="text-sm text-muted mt-1">{why}</p>
        {d.readiness.missing.length > 0 && d.morningToday && <p className="text-xs text-muted mt-1">Brak danych: {d.readiness.missing.join(', ')}</p>}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button onClick={() => go('diet')} className="text-left">
            <Stat label="Kalorie" value={Math.round(plan.kcal - eaten).toLocaleString('pl-PL')} unit="zostało" sub={`${Math.round(eaten)} / ${plan.kcal} kcal`} />
            <div className="mt-1.5"><Bar value={eaten} max={plan.kcal} tone={eaten > plan.kcal * 1.1 ? 'warn' : 'accent'} /></div>
          </button>
          <button onClick={() => go('diet')} className="text-left">
            <Stat label="Białko" value={Math.round(d.intake?.protein ?? 0)} unit={`/ ${plan.proteinG} g`} />
            <div className="mt-1.5"><Bar value={d.intake?.protein ?? 0} max={plan.proteinG} /></div>
          </button>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {d.targets!.dayType !== 'flat' && <Row k="Typ dnia" v={d.targets!.dayType === 'training' ? `treningowy: ${d.targets!.kcal} kcal, W ${d.targets!.carbsG} g` : `bez treningu: ${d.targets!.kcal} kcal, W ${d.targets!.carbsG} g`} />}
          <Row k="Jedzenie" v={`${tpl.name}: ${tpl.meals.map((m) => m.name).join(' · ')}`} />
          <Row k="Ruch" v={`${d.steps.toLocaleString('pl-PL')} kroków${lvl === 'C' ? ' (opcjonalnie)' : ''}${d.withDaughterToday ? ' · spacer z córką się liczy' : ''}`} />
          <Row k="Trening" v={d.doneToday ? `Trening ${d.doneToday.templateId} zrobiony ✓` : trainingToday ? `Trening ${d.todayWorkout!.templateId} · ok. 60 min + 10–15 min marszu` : d.withDaughterToday ? 'Dzień z córką: bez siłowni' : 'Odpoczynek'} onClick={() => go('training')} />
        </div>
        {info.map((a) => <p key={a.code} className="mt-3 text-sm text-warn">⚠ {a.title}: {a.text}</p>)}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card onClick={() => go('progress')}>
          <Stat label="Waga" value={lastW ? lastW.value.toFixed(1) : '—'} unit="kg" sub={w7.n ? `śr. 7 dni ${w7.value!.toFixed(1)} (${w7.n})` : 'brak ważeń'} />
          {goal && w7.value && <div className="text-xs text-muted mt-1">do {goal.kg} kg: {(w7.value - goal.kg).toFixed(1)} kg</div>}
        </Card>
        <Card>
          <div className="flex items-center justify-between"><Stat label="Woda" value={(d.water / 1000).toFixed(2)} unit="l" /><Droplets size={18} className="text-accent" /></div>
          <div className="flex gap-1.5 mt-2">
            <button onClick={() => addWater(250)} className="flex-1 min-h-10 rounded-lg bg-card2 text-sm">+250</button>
            <button onClick={() => addWater(500)} className="flex-1 min-h-10 rounded-lg bg-card2 text-sm">+500</button>
            <button onClick={() => addWater(-250)} className="min-h-10 px-2 rounded-lg bg-card2 text-sm text-muted" aria-label="Cofnij 250 ml">−</button>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between"><Stat label="Sen" value={d.morningToday?.sleepMinutes ? (d.morningToday.sleepMinutes / 60).toFixed(1) : '—'} unit="h" sub={d.morningToday?.sleepQuality ? `jakość ${d.morningToday.sleepQuality}/5` : 'brak danych'} /><Moon size={18} className="text-muted" /></div>
        </Card>
        <Card>
          <Stat label="Kolano" value={d.morningToday?.kneePain ?? '—'} unit="/10" sub={data.health?.kneeCleared ? 'po ocenie specjalisty' : 'bez oceny specjalisty'} />
        </Card>
      </div>

      {rec && (
        <Card>
          <Title>Coach</Title>
          <div className="font-semibold">{rec.title}</div>
          <p className="text-sm mt-1">{rec.action}</p>
          <p className="text-xs text-muted mt-2">Podstawa: {rec.basis} ({rec.days} dni) · dane: {rec.completeness}. {rec.limits}</p>
          {!rejecting ? <div className="flex gap-2 mt-3"><Btn kind="soft" className="flex-1" onClick={() => feedback(rec.id, 'accepted')}>OK, robię</Btn><Btn kind="ghost" onClick={() => setRejecting(true)}>Nie teraz…</Btn></div>
            : <div className="mt-3 space-y-2">
              <div className="text-xs text-muted">Dlaczego? Na tej podstawie rzadziej pokażę podobne porady.</div>
              <div className="grid grid-cols-2 gap-1.5">{(Object.keys(REASON_LABEL) as RejectReason[]).map((r) => <Btn key={r} kind="soft" className="text-xs min-h-10" onClick={() => (r === 'other' ? setOtherOpen(true) : feedback(rec.id, 'rejected', r, rec.health))}>{REASON_LABEL[r]}</Btn>)}</div>
              {otherOpen && <div className="flex gap-2"><input className={inputCls + ' flex-1'} placeholder="Krótko, co nie pasuje (opcjonalnie)" value={note} onChange={(e) => setNote(e.target.value)} /><Btn onClick={() => feedback(rec.id, 'rejected', 'other', rec.health)}>OK</Btn></div>}
              <button className="text-xs text-muted underline" onClick={() => { setRejecting(false); setNote(''); setOtherOpen(false); }}>anuluj</button>
            </div>}
        </Card>
      )}
      {hidden.length > 0 && <button className="text-xs text-muted underline w-full text-center" onClick={() => setShowHidden(!showHidden)}>Ukryte porady ({hidden.length})</button>}
      {showHidden && hidden.map(({ rec: h, s }) => (
        <Card key={h.id}><div className="text-sm font-semibold">{h.title}</div>
          <div className="text-xs text-muted">{s.reason ? REASON_LABEL[s.reason] : ''}{s.until ? ` · ukryta do ${formatPl(s.until)}` : ''}{s.rejections >= 3 ? ' · odrzucana kilka razy' : ''}</div>
          <Btn kind="soft" className="w-full mt-2 text-sm" onClick={() => feedback(h.id, 'reset')}>Pokazuj znowu</Btn></Card>
      ))}

      <button onClick={pasteHealth} className="w-full flex items-center justify-center gap-2 min-h-12 rounded-2xl border border-line bg-card text-sm"><ClipboardPaste size={18} className="text-accent" /> Wklej dane ze Zdrowia</button>
      <Sheet open={pasteBox} onClose={() => setPasteBox(false)} title="Wklej dane ze Zdrowia">
        <p className="text-sm text-muted">Przytrzymaj pole i wybierz „Wklej”.</p>
        <textarea className={inputCls + ' min-h-24 py-2'} value={pasteTxt} onChange={(e) => setPasteTxt(e.target.value)} placeholder="MBOS1;steps=…" />
        <Btn className="w-full" disabled={!pasteTxt} onClick={() => applySync(pasteTxt)}>Dalej</Btn>
      </Sheet>

      <Card onClick={() => setEOpen(true)} className={cx(hour >= 18 && !d.eveningToday && 'bg-accent/10 border-accent/40')}>
        <div className="flex items-center gap-3"><Sunset className={hour >= 18 ? 'text-accent' : 'text-muted'} /><div><div className="font-semibold">Wieczorny check-in {d.eveningToday && '✓'}</div><div className="text-sm text-muted">Kroki, głód, objawy · ~60 s</div></div></div>
      </Card>

      {mOpen && <MorningSheet open onClose={() => setMOpen(false)} data={data} d={d} />}
      {eOpen && <EveningSheet open onClose={() => { setEOpen(false); setPrefill(undefined); }} d={d} prefill={prefill} />}
    </>
  );
}

function Row({ k, v, onClick }: { k: string; v: string; onClick?: () => void }) {
  return <div className={cx('flex gap-3', onClick && 'cursor-pointer')} onClick={onClick}><span className="w-16 shrink-0 text-muted">{k}</span><span>{v}</span></div>;
}
