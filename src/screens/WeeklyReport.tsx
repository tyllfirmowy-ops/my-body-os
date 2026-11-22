import { useMemo, useState } from 'react';
import { CalendarPlus, ClipboardCheck } from 'lucide-react';
import { db, now } from '../db/db';
import type { AppData, Derived } from '../db/repo';
import { addDays, formatPl, mondayOf } from '../domain/dates';
import { weeklyStats } from '../domain/report';
import { checkinEffects, reminderIcs, reportDue, localParts, type DietFeel, type KneeFeel, type WeekChange, type WeeklyCheckin } from '../domain/weeklyCheckin';
import { Btn, Card, cx, Sheet, toast } from '../ui/kit';

const MOODS = [[1, '😣', 'źle'], [2, '🙁', 'słabo'], [3, '😐', 'tak sobie'], [4, '🙂', 'dobrze'], [5, '😄', 'świetnie']] as const;
const DIET: [DietFeel, string][] = [['easy', 'Łatwo'], ['ok', 'Do zniesienia'], ['hard', 'Ciężko']];
const KNEE: [KneeFeel, string][] = [['none', 'Bez bólu'], ['mild', 'Lekko'], ['clear', 'Wyraźnie']];
const CHANGES: [WeekChange, string][] = [['simpler_meals', 'Prostsze posiłki'], ['fewer_workouts', 'Mniej treningów'], ['nothing', 'Nic, jest dobrze']];

/** Pytanie o kolano tylko dla osób, które zgłosiły kolano w ankiecie zdrowotnej (inny użytkownik go nie widzi). */
export const asksKnee = (data: AppData) => !!data.health && (!data.health.kneeCleared || !!data.health.kneeNote);
const startedOn = (data: AppData) => [...data.plans].sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0]?.validFrom;

export function WeeklyReportCard({ data, d }: { data: AppData; d: Derived }) {
  const due = reportDue(new Date(), data.weeklyCheckins ?? [], { startedOn: startedOn(data), snoozedOn: data.settings?.reportSnoozedOn });
  const [open, setOpen] = useState(false);
  if (!due.show && !open) return null;
  return (
    <>
      {due.show && <Card className="bg-accent/10 border-accent/40">
        <div className="flex items-center gap-3"><ClipboardCheck className="text-accent shrink-0" /><div><div className="font-semibold">Raport tygodnia</div><div className="text-sm text-muted">{formatPl(due.weekStart)}–{formatPl(addDays(due.weekStart, 6))} · 4 pytania, ok. 30 s</div></div></div>
        <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
          <Btn className="min-h-12" onClick={() => setOpen(true)}>Wypełnij</Btn>
          <Btn kind="soft" className="min-h-12" onClick={async () => { await db.settings.update('settings', { reportSnoozedOn: localParts(new Date()).date }); toast('Przypomnę jutro po 12:00'); }}>Jutro</Btn>
        </div>
      </Card>}
      {open && <WeeklyReportSheet data={data} d={d} weekStart={due.weekStart} onClose={() => setOpen(false)} />}
    </>
  );
}

export function WeeklyReportSheet({ data, d, weekStart, onClose }: { data: AppData; d: Derived; weekStart: string; onClose: () => void }) {
  const existing = (data.weeklyCheckins ?? []).find((c) => c.id === weekStart);
  const prevNote = (data.weeklyCheckins ?? []).filter((c) => c.weekStart < weekStart && c.note).sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
  const [mood, setMood] = useState<WeeklyCheckin['mood'] | undefined>(existing?.mood);
  const [diet, setDiet] = useState<DietFeel | undefined>(existing?.diet);
  const [hunger, setHunger] = useState<boolean | undefined>(existing?.hunger);
  const [knee, setKnee] = useState<KneeFeel | undefined>(existing?.knee);
  const [changes, setChanges] = useState<WeekChange[]>(existing?.changes ?? []);
  const [note, setNote] = useState(existing?.note ?? '');
  const [saved, setSaved] = useState<WeeklyCheckin | null>(null);
  const knees = asksKnee(data);
  const f = data.profile?.sex === 'female';
  const v = (m: string, w: string) => (f ? w : m);
  const stats = useMemo(() => weeklyStats(d.snaps, d.weights, [], addDays(weekStart, 6), 7, d.steps), [d.snaps, d.weights, d.steps, weekStart]);
  const ready = mood !== undefined && diet !== undefined && hunger !== undefined && (!knees || knee !== undefined);
  const nextWeek = addDays(weekStart, 7);

  function toggleChange(c: WeekChange) {
    if (c === 'nothing') return setChanges(changes.includes('nothing') ? [] : ['nothing']);
    const base = changes.filter((x) => x !== 'nothing');
    setChanges(base.includes(c) ? base.filter((x) => x !== c) : [...base, c]);
  }
  async function save() {
    if (!ready) return;
    const t = now();
    const rec: WeeklyCheckin = { id: weekStart, weekStart, mood: mood!, diet: diet!, hunger: hunger!, ...(knees ? { knee } : {}), changes, note: note.trim() || undefined, createdAt: existing?.createdAt ?? t, updatedAt: t };
    await db.weeklyCheckins.put(rec);
    await db.settings.update('settings', { reportSnoozedOn: undefined });
    setSaved(rec);
  }
  const fx = saved ? checkinEffects(saved) : null;
  const facts = [
    `Treningi: ${stats.workoutsDone} z ${data.settings?.trainingsPerWeek ?? 3}`,
    stats.weightChange !== null ? `Waga (średnia): ${stats.weightChange > 0 ? '+' : ''}${String(stats.weightChange).replace('.', ',')} kg` : 'Waga: za mało pomiarów',
    stats.kcalAvg !== null ? `Kalorie: śr. ${Math.round(stats.kcalAvg)} kcal (${stats.completeIntakeDays} pełnych dni)` : 'Kalorie: brak pełnych dni',
    stats.sleepAvgH !== null ? `Sen: śr. ${String(stats.sleepAvgH).replace('.', ',')} h` : null,
  ].filter(Boolean);

  return (
    <Sheet open onClose={onClose} title={`Raport tygodnia ${formatPl(weekStart)}–${formatPl(addDays(weekStart, 6))}`}>
      {!fx ? (<>
        <div className="rounded-xl bg-card2 p-3 text-sm"><div className="text-xs text-muted mb-1">To aplikacja już wie (nie musisz wpisywać):</div>{facts.map((f) => <div key={f} className="num">{f}</div>)}</div>
        <Q t={`Jak się ${v('czułeś', 'czułaś')} w tym tygodniu?`}>
          <div className="grid grid-cols-5 gap-1">{MOODS.map(([v, e, l]) => <button key={v} aria-pressed={mood === v} aria-label={l} onClick={() => setMood(v)} className={cx('min-h-14 rounded-xl text-2xl', mood === v ? 'bg-accent' : 'bg-card2')}>{e}<div className={cx('text-[10px] leading-none', mood === v ? 'text-accent-ink font-semibold' : 'text-muted')}>{l}</div></button>)}</div>
        </Q>
        <Q t="Jak szła dieta?">
          <Choice opts={DIET} value={diet} onChange={setDiet} />
          <div className="text-sm mt-2 mb-1">Często {v('byłeś głodny albo osłabiony', 'byłaś głodna albo osłabiona')}?</div>
          <Choice opts={[[true, 'Tak'], [false, 'Nie']]} value={hunger} onChange={setHunger} />
        </Q>
        {knees && <Q t="Kolano w tym tygodniu"><Choice opts={KNEE} value={knee} onChange={setKnee} /></Q>}
        <Q t="Co zmienić na przyszły tydzień? (opcjonalnie)">
          <div className="flex flex-wrap gap-1.5">{CHANGES.map(([v, l]) => <button key={v} aria-pressed={changes.includes(v)} onClick={() => toggleChange(v)} className={cx('min-h-11 rounded-full px-3 text-sm', changes.includes(v) ? 'bg-accent text-accent-ink font-semibold' : 'bg-card2')}>{l}</button>)}</div>
        </Q>
        <Q t="Notatka (opcjonalnie)">
          {prevNote && <p className="text-xs text-muted mb-1">Tydzień temu {v('pisałeś', 'pisałaś')}: „{prevNote.note}”</p>}
          <textarea className="w-full min-h-20 rounded-xl bg-card2 border border-line p-3 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="np. dużo pracy, mało snu" />
          <p className="text-xs text-muted mt-1">Notatki aplikacja nie analizuje; pokaże Ci ją za tydzień.</p>
        </Q>
        <Btn className="w-full min-h-12" disabled={!ready} onClick={save}>{ready ? 'Zapisz raport' : 'Odpowiedz na pytania powyżej'}</Btn>
      </>) : (<>
        <div className="font-semibold">Co z tego wynika</div>
        <ul className="text-sm space-y-2 list-disc pl-5">{fx.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        {fx.lighterWeek && <Btn className="w-full min-h-12" onClick={async () => { await db.settings.update('settings', { perWeekOverride: { weekStart: mondayOf(nextWeek), n: 2 } }); toast('Cel na ten tydzień: 2 treningi'); }}>Ustaw 2 treningi na tydzień od {formatPl(nextWeek)}</Btn>}
        <p className="text-xs text-muted">Zmiana kalorii nigdy nie dzieje się sama: jeśli raport na nią wpływa, zobaczysz propozycję do akceptacji w Energii.</p>
        <Btn kind="soft" className="w-full min-h-12" onClick={() => addCalendarReminder(weekStart)}><CalendarPlus size={16} className="inline -mt-0.5 mr-1" />Przypomnienie w kalendarzu (niedziela 20:30)</Btn>
        <Btn className="w-full min-h-12" onClick={onClose}>Gotowe</Btn>
      </>)}
    </Sheet>
  );
}

/** Cykliczne przypomnienie w kalendarzu telefonu. Bez serwera aplikacja webowa nie wyśle powiadomienia o konkretnej godzinie. */
export async function addCalendarReminder(weekStart: string) {
  const sunday = addDays(weekStart, 13);
  const ics = reminderIcs(sunday, location.origin + location.pathname);
  const file = new File([ics], 'my-body-os-raport.ics', { type: 'text/calendar' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Raport tygodnia' }); return; }
  } catch { /* anulowano udostępnianie */ }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  toast('Otwórz plik, żeby dodać wydarzenie do kalendarza');
}

const Q = ({ t, children }: { t: string; children: React.ReactNode }) => <div><div className="text-sm font-semibold mb-1.5">{t}</div>{children}</div>;
function Choice<T extends string | boolean>({ opts, value, onChange }: { opts: [T, string][]; value: T | undefined; onChange: (v: T) => void }) {
  return <div className={cx('grid gap-1.5', opts.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>{opts.map(([v, l]) => <button key={String(v)} aria-pressed={value === v} onClick={() => onChange(v)} className={cx('min-h-11 rounded-xl text-sm', value === v ? 'bg-accent text-accent-ink font-semibold' : 'bg-card2')}>{l}</button>)}</div>;
}
