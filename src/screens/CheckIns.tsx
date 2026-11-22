import { useState } from 'react';
import { db, now } from '../db/db';
import { addDays } from '../domain/dates';
import { sleepMinutes } from '../domain/dates';
import { SYMPTOM_LABELS } from '../domain/safety';
import { MISS_LABEL } from '../domain/coaching';
import { backupReminder } from '../domain/storageDiag';
import type { EveningCheckIn, MissReason, MorningCheckIn, SymptomFlag } from '../domain/types';
import type { AppData, Derived } from '../db/repo';
import type { HealthSync } from '../domain/sync';
import { Btn, cx, Field, inputCls, NumInput, Scale, Sheet, toast, Toggle } from '../ui/kit';

export function MorningSheet({ open, onClose, data, d, onBackup }: { open: boolean; onClose: () => void; data: AppData; d: Derived; onBackup?: () => void }) {
  const reminder = backupReminder({ confirmedAt: data.settings?.lastBackupConfirmedAt, dismissedKey: data.settings?.backupReminderDismissed, now: now(), everyDays: data.settings?.backupReminderDays ?? 7 });
  const prev = data.morning.find((m) => m.date === addDays(d.today, -1));
  const cur = d.morningToday;
  const [f, setF] = useState<Partial<MorningCheckIn>>(() => cur ?? { bedTime: prev?.bedTime, wakeTime: prev?.wakeTime, symptoms: [] });
  const [showSym, setShowSym] = useState((cur?.symptoms.length ?? 0) > 0);
  const [daughter, setDaughter] = useState(d.withDaughterToday ?? false);
  const sleep = f.bedTime && f.wakeTime ? sleepMinutes(d.today, f.bedTime, f.wakeTime) : null;
  const set = (p: Partial<MorningCheckIn>) => setF((x) => ({ ...x, ...p }));
  const toggleSym = (s: SymptomFlag) => set({ symptoms: f.symptoms?.includes(s) ? f.symptoms.filter((x) => x !== s) : [...(f.symptoms ?? []), s] });

  async function save(thenBackup = false) {
    const t = now();
    await db.morning.put({ ...f, date: d.today, symptoms: f.symptoms ?? [], sleepMinutes: sleep ?? f.sleepMinutes, createdAt: cur?.createdAt ?? t, updatedAt: t } as MorningCheckIn);
    if (daughter !== d.withDaughterToday) await db.overrides.put({ date: d.today, withDaughter: daughter, updatedAt: t });
    toast('Check-in zapisany'); onClose();
    if (thenBackup) onBackup?.();
  }
  async function snooze() {
    if (reminder.key) await db.settings.update('settings', { backupReminderDismissed: reminder.key });
    toast('Przypomnę w kolejnym tygodniu');
  }
  return (
    <Sheet open={open} onClose={onClose} title="Poranny check-in">
      <Field label="Waga rano (opcjonalnie)"><NumInput value={f.weightKg} onChange={(v) => set({ weightKg: v })} placeholder="kg" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Zasnąłem"><input type="time" className={inputCls} value={f.bedTime ?? ''} onChange={(e) => set({ bedTime: e.target.value || undefined })} /></Field>
        <Field label="Wstałem"><input type="time" className={inputCls} value={f.wakeTime ?? ''} onChange={(e) => set({ wakeTime: e.target.value || undefined })} /></Field>
      </div>
      <div className="text-xs text-muted -mt-2">{!cur && prev?.bedTime ? 'Godziny podpowiedziane z wczoraj: popraw, jeśli inne. ' : ''}{sleep ? `Sen: ${Math.floor(sleep / 60)} h ${sleep % 60} min` : 'Brak danych o śnie'}</div>
      <Scale label="Jakość snu" min={1} max={5} value={f.sleepQuality} onChange={(v) => set({ sleepQuality: v })} hint="1 źle · 5 świetnie" />
      <Scale label="Energia" min={1} max={5} value={f.energy} onChange={(v) => set({ energy: v })} />
      <Scale label="Stres" min={1} max={10} value={f.stress} onChange={(v) => set({ stress: v })} />
      <Scale label="Ból kolana" min={0} max={10} value={f.kneePain} onChange={(v) => set({ kneePain: v })} hint="0 brak" />
      <div>
        <div className="text-sm mb-1.5">Czas dziś</div>
        <div className="grid grid-cols-3 gap-1">
          {([['full', 'Normalnie'], ['limited', 'Mało'], ['none', 'Brak']] as const).map(([k, l]) => (
            <button key={k} onClick={() => set({ availability: f.availability === k ? undefined : k })} className={cx('min-h-11 rounded-lg text-sm', f.availability === k ? 'bg-accent text-accent-ink font-semibold' : 'bg-card2')}>{l}</button>
          ))}
        </div>
      </div>
      <Toggle on={daughter} onChange={setDaughter} label="Córka jest dziś ze mną" />
      <Toggle on={showSym} onChange={setShowSym} label="Mam nietypowe objawy" />
      {showSym && (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SYMPTOM_LABELS) as SymptomFlag[]).map((s) => (
            <button key={s} onClick={() => toggleSym(s)} className={cx('rounded-full px-3 py-2 text-sm', f.symptoms?.includes(s) ? 'bg-danger text-white' : 'bg-card2')}>{SYMPTOM_LABELS[s]}</button>
          ))}
        </div>
      )}
      {reminder.due && <div className="rounded-xl border border-warn p-3 text-sm space-y-2">
        <div><b>Kopia zapasowa</b>: {reminder.days !== undefined ? `ostatnia potwierdzona ${reminder.days} dni temu.` : 'brak potwierdzonej kopii.'} Dane są tylko na tym telefonie.</div>
        <div className="flex gap-2"><Btn kind="soft" className="flex-1 text-sm" onClick={() => save(true)}>Zapisz i zrób kopię</Btn><Btn kind="ghost" className="text-sm" onClick={snooze}>Za tydzień</Btn></div>
      </div>}
      <Btn className="w-full" onClick={() => save()}>Zapisz</Btn>
    </Sheet>
  );
}

export function EveningSheet({ open, onClose, d, prefill }: { open: boolean; onClose: () => void; d: Derived; prefill?: HealthSync }) {
  const cur = d.eveningToday;
  const [f, setF] = useState<Partial<EveningCheckIn>>(() => {
    const base: Partial<EveningCheckIn> = cur ?? { kneePain: d.morningToday?.kneePain, stress: d.morningToday?.stress };
    return prefill ? { ...base, steps: prefill.steps ?? base.steps, activeKcal: prefill.activeKcal ?? base.activeKcal, restingHr: prefill.restingHr ?? base.restingHr, healthSyncAt: now() } : base;
  });
  const set = (p: Partial<EveningCheckIn>) => setF((x) => ({ ...x, ...p }));
  const missed = !!d.todayWorkout && !d.doneToday;
  const [summary, setSummary] = useState<string[] | null>(null);

  async function save() {
    const t = now();
    await db.evening.put({ ...f, date: d.today, createdAt: cur?.createdAt ?? t, updatedAt: t } as EveningCheckIn);
    if (prefill && (prefill.weightKg || prefill.sleepMinutes)) {
      const m = d.morningToday;
      const from: ('weight' | 'sleep')[] = [];
      const patch: Partial<MorningCheckIn> = {};
      if (prefill.weightKg && !m?.weightKg) { patch.weightKg = prefill.weightKg; from.push('weight'); }
      if (prefill.sleepMinutes && !m?.sleepMinutes) { patch.sleepMinutes = prefill.sleepMinutes; from.push('sleep'); }
      if (from.length) await db.morning.put({ symptoms: [], createdAt: m?.createdAt ?? t, ...m, ...patch, fromHealth: [...(m?.fromHealth ?? []), ...from], date: d.today, updatedAt: t } as MorningCheckIn);
    }
    setSummary(buildSummary(d, f));
  }
  if (summary) return (
    <Sheet open={open} onClose={() => { setSummary(null); onClose(); }} title="Podsumowanie dnia">
      {summary.map((s, i) => <p key={i} className={cx(i === 2 && 'font-semibold')}>{s}</p>)}
      <Btn className="w-full" onClick={() => { setSummary(null); onClose(); }}>Gotowe</Btn>
    </Sheet>
  );
  return (
    <Sheet open={open} onClose={onClose} title="Wieczorny check-in">
      <div className="rounded-xl bg-card2 p-3 text-sm">
        Z dziennika: {d.intake ? `${Math.round(d.intake.kcal)} kcal, ${Math.round(d.intake.protein)} g białka, ${d.intake.meals} posiłki` : 'brak wpisów jedzenia'} · woda {d.water} ml · trening: {d.doneToday ? 'wykonany' : d.todayWorkout ? 'niewykonany' : 'nie planowany'}
      </div>
      {prefill && <div className="rounded-xl bg-accent/10 p-3 text-sm">Ze Zdrowia: {[prefill.steps !== undefined && `${prefill.steps} kroków`, prefill.sleepMinutes && `sen ${(prefill.sleepMinutes / 60).toFixed(1)} h`, prefill.weightKg && `waga ${prefill.weightKg} kg`, prefill.restingHr && `tętno spocz. ${prefill.restingHr}`, prefill.activeKcal !== undefined && `aktywne ${prefill.activeKcal} kcal`].filter(Boolean).join(' · ')}</div>}
      <div>
        <div className="text-sm mb-1.5">Czy trzymałeś się planu żywienia?</div>
        <div className="grid grid-cols-3 gap-1">
          {([['yes', 'Tak'], ['partial', 'Częściowo'], ['no', 'Nie']] as const).map(([k, l]) => (
            <button key={k} onClick={() => set({ dietAdherence: f.dietAdherence === k ? undefined : k })} className={cx('min-h-11 rounded-lg text-sm', f.dietAdherence === k ? 'bg-accent text-accent-ink font-semibold' : 'bg-card2')}>{l}</button>
          ))}
        </div>
      </div>
      <Toggle on={!!f.sweetsInPlan} onChange={(v) => set({ sweetsInPlan: v })} label="Słodycze były w limicie (albo ich nie było)" />
      <Toggle on={!!f.foodLogComplete} onChange={(v) => set({ foodLogComplete: v })} label="Wpisałem wszystko, co dziś zjadłem" />
      <p className="text-xs text-muted -mt-2">Tylko dni z potwierdzonym, kompletnym dziennikiem są używane do liczenia Twojego zapotrzebowania.</p>
      <Field label="Kroki (z telefonu)"><NumInput value={f.steps} onChange={(v) => set({ steps: v })} placeholder={`cel ${d.steps}`} /></Field>
      {missed && (
        <div>
          <div className="text-sm mb-1.5">Dlaczego bez treningu?</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MISS_LABEL) as MissReason[]).map((k) => (
              <button key={k} onClick={() => set({ workoutMissReason: f.workoutMissReason === k ? undefined : k })} className={cx('rounded-full px-3 py-2 text-sm', f.workoutMissReason === k ? 'bg-accent text-accent-ink' : 'bg-card2')}>{MISS_LABEL[k]}</button>
            ))}
          </div>
        </div>
      )}
      <Scale label="Głód wieczorem" min={1} max={5} value={f.hunger} onChange={(v) => set({ hunger: v })} />
      <Scale label="Ochota na słodycze" min={1} max={5} value={f.sweetsCraving} onChange={(v) => set({ sweetsCraving: v })} />
      <Scale label="Energia" min={1} max={5} value={f.energy} onChange={(v) => set({ energy: v })} />
      <Scale label="Stres" min={1} max={10} value={f.stress} onChange={(v) => set({ stress: v })} />
      <Scale label="Ból kolana" min={0} max={10} value={f.kneePain} onChange={(v) => set({ kneePain: v })} />
      <Scale label="Objawy trawienne" min={0} max={5} value={f.digestive} onChange={(v) => set({ digestive: v })} hint="0 brak" />
      <Field label="Co przeszkodziło? (opcjonalnie)"><input className={inputCls} value={f.planMissReason ?? ''} onChange={(e) => set({ planMissReason: e.target.value || undefined })} /></Field>
      <Btn className="w-full" onClick={save}>Zapisz</Btn>
    </Sheet>
  );
}

function buildSummary(d: Derived, f: Partial<EveningCheckIn>): string[] {
  const kcal = d.targets?.kcal ?? d.plan?.kcal ?? 0;
  const good: string[] = []; const hard: string[] = [];
  if (d.intake && Math.abs(d.intake.kcal - kcal) <= kcal * 0.1) good.push('kalorie w celu'); else if (d.intake && d.intake.kcal > kcal * 1.1) hard.push('kalorie powyżej celu');
  if (d.intake && d.intake.protein >= (d.plan?.proteinG ?? 165) * 0.9) good.push('białko'); else if (d.intake) hard.push('za mało białka');
  if (d.doneToday) good.push('trening');
  if (f.steps && f.steps >= d.steps) good.push('kroki'); else if (f.steps) hard.push(`kroki ${f.steps}/${d.steps}`);
  if ((f.hunger ?? 0) >= 4) hard.push('duży głód wieczorem');
  if (f.dietAdherence === 'yes') good.push('dieta wg planu'); else if (f.dietAdherence === 'no') hard.push('dieta poza planem');
  if (!d.intake) hard.push('brak dziennika jedzenia');
  const tomorrow = (f.hunger ?? 0) >= 4 ? 'Jutro: pełny posiłek z białkiem przed 13:00.'
    : d.intake && d.intake.kcal > kcal * 1.1 ? 'Jutro: normalne śniadanie i zwykły plan. Bez odrabiania.'
    : !d.intake ? 'Jutro: zapisz przynajmniej 2 posiłki.'
    : f.steps && f.steps < d.steps ? 'Jutro: 15 min spaceru po obiedzie.'
    : 'Jutro: to samo. Powtarzalność działa.';
  return [`Udało się: ${good.length ? good.join(', ') : 'zapisałeś dzień, to też się liczy'}.`, `Utrudniło: ${hard.length ? hard.join(', ') : 'nic wyraźnego'}.`, tomorrow];
}
