import { useMemo, useState } from 'react';
import { Copy, Download, FileText } from 'lucide-react';
import type { ScreenProps } from '../App';
import { db, now, uid } from '../db/db';
import { addDays, formatPl } from '../domain/dates';
import { mean, ageOn } from '../domain/calc';
import { weeklyStats, weeklyMarkdown, aiContext } from '../domain/report';
import { findPattern } from '../domain/coaching';
import { EXERCISES } from '../data/exercises';
import type { BodyMeasurement } from '../domain/types';
import { Btn, Card, copyText, cx, download, Field, NumInput, Sheet, Stat, Title, toast, Toggle } from '../ui/kit';
import { Bars, TrendChart } from '../ui/Chart';

const PERIODS = [7, 14, 28, 90] as const;

export function Progress({ data, d }: ScreenProps) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(28);
  const [measure, setMeasure] = useState(false);
  const [report, setReport] = useState<'week' | 'ai' | null>(null);
  const [rLen, setRLen] = useState<7 | 14 | 28>(7);
  const from = addDays(d.today, -(period - 1));
  const goal = data.profile?.goals[0]?.kg;
  const end = addDays(d.today, -1);
  const stats = useMemo(() => weeklyStats(d.snaps, d.weights, waist(data.measurements), end, 7, d.steps), [d.snaps, d.weights, data.measurements, end, d.steps]);
  const rStats = useMemo(() => weeklyStats(d.snaps, d.weights, waist(data.measurements), end, rLen, d.steps), [d.snaps, d.weights, data.measurements, end, rLen, d.steps]);
  const md = d.adapt ? weeklyMarkdown(rStats, d.adapt, d.recs, d.plan!.kcal) : '';
  const w7 = mean(d.weights.filter((w) => w.date > addDays(d.today, -7)).map((w) => w.value));
  const snapsP = d.snaps.filter((s) => s.date >= from);
  const series = (f: (s: (typeof d.snaps)[number]) => number | undefined) => snapsP.map((s) => ({ date: s.date, value: f(s) })).filter((x): x is { date: string; value: number } => x.value !== undefined);

  async function approve() {
    const p = d.adapt?.proposal; const cur = d.plan!;
    if (!p) return;
    if (p.kind === 'kcal' && p.newKcal) {
      const carbs = Math.max(0, Math.round((p.newKcal - cur.proteinG * 4 - cur.fatG * 9) / 4));
      await db.plans.add({ ...cur, id: uid(), createdAt: now(), updatedAt: now(), validFrom: d.today, kcal: p.newKcal, carbsG: carbs, reason: p.reason, approvedByUser: true, source: 'calculated' });
      toast(`Nowy plan: ${p.newKcal} kcal (białko bez zmian)`);
    } else {
      await db.feedback.add({ id: uid(), createdAt: now(), updatedAt: now(), recId: 'adapt_activity', date: d.today, action: 'accepted' });
      toast('Przyjęte: +1000 kroków dziennie');
    }
  }

  return (
    <>
      <header className="pt-2 flex items-end justify-between"><h1 className="text-2xl font-bold">Postępy</h1><Btn kind="soft" className="text-sm" onClick={() => setMeasure(true)}>+ Pomiar</Btn></header>
      <div className="flex gap-1 rounded-xl bg-card2 p-1">
        {PERIODS.map((p) => <button key={p} onClick={() => setPeriod(p)} className={cx('flex-1 min-h-9 rounded-lg text-sm', period === p ? 'bg-card font-semibold' : 'text-muted')}>{p} dni</button>)}
      </div>
      <Card>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <Stat label="Śr. 7 dni" value={w7.value?.toFixed(1) ?? '—'} unit="kg" sub={`${w7.n} ważeń`} />
          <Stat label="Zmiana tyg." value={stats.weightChange === null ? '—' : `${stats.weightChange > 0 ? '+' : ''}${stats.weightChange}`} unit="kg" />
          <Stat label="Do celu" value={goal && w7.value ? (w7.value - goal).toFixed(1) : '—'} unit="kg" sub={goal ? `cel ${goal} kg` : undefined} />
        </div>
        <TrendChart data={d.weights} from={from} to={d.today} unit="kg" goal={goal} />
        <p className="text-xs text-muted">Kropki: ważenia. Linia: średnia 7 dni (gdy ≥4 ważenia w oknie).</p>
      </Card>
      {d.adapt && (
        <Card>
          <Title>Silnik redukcji</Title>
          <p className="text-sm">{d.adapt.message}</p>
          {d.adapt.checks.length > 0 && <ul className="mt-2 text-xs text-muted space-y-0.5">{d.adapt.checks.map((c) => <li key={c}>• {c}</li>)}</ul>}
          {d.adapt.proposal && (
            <div className="mt-3 rounded-xl bg-card2 p-3 text-sm">
              <b>Propozycja:</b> {d.adapt.proposal.kind === 'kcal' ? `${d.plan!.kcal} → ${d.adapt.proposal.newKcal} kcal` : `+${d.adapt.proposal.stepsDelta} kroków dziennie`}<br />
              <span className="text-muted">{d.adapt.proposal.reason} Alternatywa: {d.adapt.proposal.alternative} Nigdy obie zmiany naraz.</span>
              <div className="flex gap-2 mt-2"><Btn className="flex-1" onClick={approve}>Zatwierdzam</Btn><Btn kind="ghost" onClick={() => toast('Bez zmian')}>Nie teraz</Btn></div>
            </div>
          )}
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Btn kind="soft" onClick={() => setReport('week')}><FileText size={16} className="inline -mt-0.5" /> Raporty</Btn>
        <Btn kind="soft" onClick={() => setReport('ai')}><Copy size={16} className="inline -mt-0.5" /> Raport dla AI</Btn>
      </div>
      <Card><Title>Talia</Title><TrendChart data={waist(data.measurements)} from={from} to={d.today} unit="cm" showAvg={false} height={120} /></Card>
      <Card><Title right={<span className="text-xs text-muted">cel {d.plan!.kcal}</span>}>Kalorie</Title><Bars data={series((s) => s.kcal)} from={from} to={d.today} target={d.plan!.kcal} /></Card>
      <Card><Title right={<span className="text-xs text-muted">cel {d.plan!.proteinG} g</span>}>Białko</Title><Bars data={series((s) => s.protein)} from={from} to={d.today} target={d.plan!.proteinG} /></Card>
      <Card><Title right={<span className="text-xs text-muted">cel {d.steps}</span>}>Kroki</Title><Bars data={series((s) => s.evening?.steps)} from={from} to={d.today} target={d.steps} /></Card>
      <Card><Title right={<span className="text-xs text-muted">7–9 h</span>}>Sen (h)</Title><Bars data={series((s) => (s.morning?.sleepMinutes ? s.morning.sleepMinutes / 60 : undefined))} from={from} to={d.today} target={7} /></Card>
      <Card><Title>Stres (1–10)</Title><Bars data={series((s) => s.morning?.stress)} from={from} to={d.today} /></Card>
      <Strength data={data} />
      <Patterns d={d} />
      <Card>
        <Title>Historia pomiarów</Title>
        {[...data.measurements].reverse().slice(0, 12).map((m) => (
          <div key={m.id} className="py-2 border-b border-line last:border-0 text-sm">
            <span className="text-muted">{m.historical ? 'historyczny (data do potwierdzenia)' : formatPl(m.date)}:</span>{' '}
            {[m.weightKg && `${m.weightKg} kg`, m.waistCm && `talia ${m.waistCm}`, m.hipsCm && `biodra ${m.hipsCm}`, m.chestCm && `klatka ${m.chestCm}`, m.armCm && `ramię ${m.armCm}`, m.thighCm && `udo ${m.thighCm}`, m.bodyFatPct && `BF ${m.bodyFatPct}% (szac.)`].filter(Boolean).join(' · ')}
          </div>
        ))}
        {!data.measurements.length && <p className="text-sm text-muted">Brak pomiarów.</p>}
        <p className="text-xs text-muted mt-2">Talia raz w tygodniu, pozostałe obwody co 2 tygodnie. Ta sama pora i metoda.</p>
      </Card>
      {measure && <MeasureSheet onClose={() => setMeasure(false)} today={d.today} />}
      <Sheet open={report === 'week'} onClose={() => setReport(null)} title="Raport">
        <div className="flex gap-1 rounded-xl bg-card2 p-1">{([7, 14, 28] as const).map((n) => <button key={n} onClick={() => setRLen(n)} className={cx('flex-1 min-h-9 rounded-lg text-sm', rLen === n ? 'bg-card font-semibold' : 'text-muted')}>{n === 7 ? 'Tydzień' : n === 14 ? '14 dni' : 'Miesiąc'}</button>)}</div>
        <pre className="whitespace-pre-wrap text-sm font-sans">{md}</pre>
        <div className="grid grid-cols-2 gap-2">
          <Btn kind="soft" onClick={() => copyText(md)}><Copy size={16} className="inline" /> Kopiuj</Btn>
          <Btn kind="soft" onClick={() => download(`raport-${rLen}d-${rStats.to}.md`, md, 'text/markdown')}><Download size={16} className="inline" /> .md</Btn>
          <Btn kind="soft" onClick={() => download(`raport-${rLen}d-${rStats.to}.json`, JSON.stringify(rStats, null, 2))}>JSON</Btn>
          <Btn kind="soft" onClick={() => download(`dni-${stats.to}.csv`, toCsv(d.snaps), 'text/csv')}>CSV dni</Btn>
        </div>
      </Sheet>
      {report === 'ai' && <AiSheet data={data} d={d} stats={stats} onClose={() => setReport(null)} />}
    </>
  );
}

const waist = (m: BodyMeasurement[]) => m.filter((x) => !x.historical && x.waistCm).map((x) => ({ date: x.date, value: x.waistCm! }));

function toCsv(snaps: ScreenProps['d']['snaps']) {
  const h = 'data,waga,sen_min,jakosc_snu,energia,stres,kolano,kcal,bialko,blonnik,posilki,woda_ml,kroki,glod,trening,corka';
  const v = (x: unknown) => (x === undefined || x === null ? '' : String(typeof x === 'number' ? Math.round(x * 10) / 10 : x));
  return [h, ...snaps.map((s) => [s.date, s.morning?.weightKg, s.morning?.sleepMinutes, s.morning?.sleepQuality, s.morning?.energy, s.morning?.stress, s.morning?.kneePain, s.kcal, s.protein, s.fiber, s.meals, s.waterMl, s.evening?.steps, s.evening?.hunger, s.workoutDone ? 1 : 0, s.withDaughter ? 1 : 0].map(v).join(','))].join('\n');
}

function AiSheet({ data, d, stats, onClose }: { data: ScreenProps['data']; d: ScreenProps['d']; stats: ReturnType<typeof weeklyStats>; onClose: () => void }) {
  const [health, setHealth] = useState(data.settings?.aiIncludeHealth ?? false);
  const [days, setDays] = useState<14 | 28>(14);
  const p = data.profile!;
  const text = aiContext({ stats, adapt: d.adapt!, recs: d.recs, plan: d.plan!, profile: { heightCm: p.heightCm, age: ageOn(p, d.today), goals: p.goals.map((g) => `${g.kg} kg`).join(', ') },
    health: health ? [...(data.health?.conditions ?? []), data.health?.kneeNote ?? '', data.health?.dairyAvoid ? 'objawy po nabiale (bez diagnozy)' : ''].filter(Boolean) : undefined, days });
  return (
    <Sheet open onClose={onClose} title="Kopiuj raport dla AI">
      <Toggle on={health} onChange={(v) => { setHealth(v); db.settings.update('settings', { aiIncludeHealth: v }); }} label="Dołącz dane zdrowotne" />
      <div className="flex gap-2">{([14, 28] as const).map((n) => <button key={n} onClick={() => setDays(n)} className={cx('flex-1 min-h-10 rounded-lg text-sm', days === n ? 'bg-accent text-accent-ink' : 'bg-card2')}>{n} dni</button>)}</div>
      <pre className="whitespace-pre-wrap text-xs bg-card2 rounded-xl p-3 font-sans">{text}</pre>
      <Btn className="w-full" onClick={() => copyText(text)}>Kopiuj do schowka</Btn>
      <p className="text-xs text-muted">Nic nie jest wysyłane automatycznie. Wklejasz sam, gdzie chcesz.</p>
    </Sheet>
  );
}

function MeasureSheet({ onClose, today }: { onClose: () => void; today: string }) {
  const [m, setM] = useState<Partial<BodyMeasurement>>({ date: today });
  async function save() {
    const { date, ...rest } = m;
    if (!Object.values(rest).some((v) => typeof v === 'number')) return toast('Wpisz przynajmniej jeden pomiar');
    await db.measurements.add({ id: uid(), createdAt: now(), updatedAt: now(), date: date ?? today, ...rest, source: 'manual' });
    toast('Pomiar zapisany'); onClose();
  }
  return (
    <Sheet open onClose={onClose} title="Nowy pomiar">
      <Field label="Data"><input type="date" className="w-full min-h-12 rounded-xl bg-card2 border border-line px-3" value={m.date} max={today} onChange={(e) => setM({ ...m, date: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        {([['weightKg', 'Waga (kg)'], ['waistCm', 'Talia przy pępku (cm)'], ['hipsCm', 'Biodra (cm)'], ['chestCm', 'Klatka (cm)'], ['armCm', 'Ramię luźne (cm)'], ['thighCm', 'Udo (cm)'], ['bodyFatPct', '% tłuszczu z wagi (szac.)']] as const).map(([k, l]) => (
          <Field key={k} label={l}><NumInput value={m[k] as number | undefined} onChange={(v) => setM({ ...m, [k]: v })} /></Field>
        ))}
      </div>
      <p className="text-xs text-muted">% tłuszczu z wagi łazienkowej zależy od nawodnienia i pory dnia: traktowany jako szacunek.</p>
      <Btn className="w-full" onClick={save}>Zapisz</Btn>
    </Sheet>
  );
}

function Strength({ data }: { data: ScreenProps['data'] }) {
  const rows = EXERCISES.map((e) => {
    const sets = data.sets.filter((s) => s.exerciseId === e.id && s.done && data.sessions.find((x) => x.id === s.sessionId)?.status === 'completed');
    const bySession = new Map<string, number>();
    sets.forEach((s) => bySession.set(s.sessionId, Math.max(bySession.get(s.sessionId) ?? 0, s.weightKg * (1 + s.reps / 30))));
    const vals = [...bySession.entries()].map(([sid, v]) => ({ date: data.sessions.find((x) => x.id === sid)!.date, v })).sort((a, b) => a.date.localeCompare(b.date));
    return { e, first: vals[0], last: vals.at(-1), n: vals.length };
  }).filter((r) => r.n > 0);
  return (
    <Card>
      <Title>Siła (szac. 1RM z najlepszej serii)</Title>
      {rows.length ? rows.map(({ e, first, last, n }) => (
        <div key={e.id} className="flex justify-between py-2 border-b border-line last:border-0 text-sm"><span>{e.namePl}</span><span className="num text-muted">{first!.v.toFixed(1)} → <b className="text-ink">{last!.v.toFixed(1)}</b> kg ({n} sesji)</span></div>
      )) : <p className="text-sm text-muted">Brak zapisanych treningów.</p>}
      <p className="text-xs text-muted mt-2">Wzór Epleya, tylko do porównań w obrębie tego samego ćwiczenia. Nie testujemy ciężarów maksymalnych.</p>
    </Card>
  );
}

function Patterns({ d }: { d: ScreenProps['d'] }) {
  const P = [
    { name: 'Sen a wieczorny głód', x: (s: (typeof d.snaps)[number]) => s.morning?.sleepMinutes, y: (s: (typeof d.snaps)[number]) => s.evening?.hunger },
    { name: 'Stres a kalorie', x: (s: (typeof d.snaps)[number]) => s.morning?.stress, y: (s: (typeof d.snaps)[number]) => s.kcal },
    { name: 'Liczba posiłków a głód', x: (s: (typeof d.snaps)[number]) => s.meals, y: (s: (typeof d.snaps)[number]) => s.evening?.hunger },
    { name: 'Sen a energia', x: (s: (typeof d.snaps)[number]) => s.morning?.sleepMinutes, y: (s: (typeof d.snaps)[number]) => s.morning?.energy },
  ];
  return (
    <Card>
      <Title>Możliwe zależności (35 dni)</Title>
      {P.map((p) => {
        const r = findPattern(d.snaps, p.x, p.y);
        return (
          <div key={p.name} className="py-2 border-b border-line last:border-0 text-sm">
            <div className="flex justify-between"><span>{p.name}</span><span className="text-muted num">{r.enough && r.r !== null ? `r = ${r.r.toFixed(2)}` : 'za mało danych'}</span></div>
            <div className="text-xs text-muted">{r.n} dni z obiema wartościami (min. 10).{r.enough && r.r !== null && Math.abs(r.r) >= 0.4 ? ' Wyraźniejsza zależność, ale to korelacja, nie przyczyna.' : ''}</div>
          </div>
        );
      })}
    </Card>
  );
}
