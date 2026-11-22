import { useState } from 'react';
import { db, now, uid } from '../db/db';
import type { AppData, Derived } from '../db/repo';
import { mean, ageOn, bmrMifflin } from '../domain/calc';
import { addDays } from '../domain/dates';
import { estimateTdee, JOB_LABEL, observedTdee, planFromTdee, type ActivityProfile, type Pace } from '../domain/energy';
import { Btn, copyText, cx, Field, NumInput, Sheet, toast, Toggle } from '../ui/kit';
import { dayTargets, DEFAULT_CYCLING, DEFAULT_RULES } from '../domain/targets';

export function defaultActivity(data: AppData, d: Derived): ActivityProfile {
  if (data.profile?.activity) return data.profile.activity;
  const steps = mean(d.snaps.slice(-14).map((s) => s.evening?.steps));
  return { job: 'desk', stepsPerDay: steps.n >= 5 ? Math.round(steps.value!) : 6500, workoutsPerWeek: Math.round((d.plan?.workoutsPer14d ?? 4) / 2), workoutMin: 60, workoutType: 'strength', cardioMinPerWeek: 25 };
}

export function ActivityForm({ a, onChange }: { a: ActivityProfile; onChange: (a: ActivityProfile) => void }) {
  const chip = <K extends keyof ActivityProfile>(k: K, v: ActivityProfile[K], label: string) => (
    <button key={String(v)} onClick={() => onChange({ ...a, [k]: v })} className={cx('rounded-full px-3 py-2 text-sm', a[k] === v ? 'bg-accent text-accent-ink font-semibold' : 'bg-card2')}>{label}</button>
  );
  return (
    <div className="space-y-3">
      <div><div className="text-sm text-muted mb-1">Praca / typowy dzień</div><div className="flex flex-wrap gap-1.5">{(Object.keys(JOB_LABEL) as ActivityProfile['job'][]).map((j) => chip('job', j, JOB_LABEL[j]))}</div></div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kroki dziennie (średnio)"><NumInput value={a.stepsPerDay} onChange={(v) => onChange({ ...a, stepsPerDay: v ?? 0 })} /></Field>
        <Field label="Cardio poza treningiem (min/tydz.)"><NumInput value={a.cardioMinPerWeek} onChange={(v) => onChange({ ...a, cardioMinPerWeek: v ?? 0 })} /></Field>
        <Field label="Treningi w tygodniu"><NumInput value={a.workoutsPerWeek} onChange={(v) => onChange({ ...a, workoutsPerWeek: v ?? 0 })} /></Field>
        <Field label="Czas treningu (min)"><NumInput value={a.workoutMin} onChange={(v) => onChange({ ...a, workoutMin: v ?? 0 })} /></Field>
      </div>
      <div><div className="text-sm text-muted mb-1">Rodzaj treningu</div><div className="flex flex-wrap gap-1.5">{chip('workoutType', 'strength', 'Siłowy')}{chip('workoutType', 'mixed', 'Mieszany')}{chip('workoutType', 'cardio', 'Wytrzymałościowy')}</div></div>
    </div>
  );
}

export function EnergySheet({ data, d, onClose }: { data: AppData; d: Derived; onClose: () => void }) {
  const p = data.profile!;
  const [a, setA] = useState<ActivityProfile>(() => defaultActivity(data, d));
  const [pace, setPace] = useState<Pace>('gentle');
  const weight = mean(d.weights.filter((w) => w.date > addDays(d.today, -7)).map((w) => w.value)).value ?? d.weights.at(-1)?.value ?? p.declaredWeightKg;
  const bmr = bmrMifflin({ weightKg: weight, heightCm: p.heightCm, age: ageOn(p, d.today), sex: p.sex });
  const est = estimateTdee(bmr, weight, p.heightCm, a);
  const goal = p.goals[0]?.kg ?? weight - 10;
  const intake = d.snaps.filter((s) => s.kcal !== undefined && (s.meals ?? 0) >= 3).map((s) => ({ date: s.date, kcal: s.kcal! }));
  const obs = observedTdee(d.weights, intake, addDays(d.today, -1));
  const base = obs.tdee ?? est.tdee;
  const plan = planFromTdee(base, goal, pace);
  const cur = d.plan!;

  async function saveActivity() { await db.profile.update('me', { activity: a, updatedAt: now() }); toast('Wywiad zapisany'); }
  async function apply() {
    await db.profile.update('me', { activity: a, updatedAt: now() });
    await db.plans.add({ ...cur, id: uid(), createdAt: now(), updatedAt: now(), validFrom: d.today, kcal: plan.kcal, proteinG: plan.proteinG, fatG: plan.fatG, carbsG: plan.carbsG,
      reason: `Kalkulator: TDEE ${base} kcal (${obs.tdee ? 'z Twoich danych' : 'szacunek z wywiadu'}), deficyt ${Math.round(PACE_PCT[pace] * 100)}%`, approvedByUser: true, source: 'calculated' });
    toast(`Nowy plan: ${plan.kcal} kcal`); onClose();
  }
  return (
    <Sheet open onClose={onClose} title="Zapotrzebowanie kaloryczne">
      <ActivityForm a={a} onChange={setA} />
      <div className="rounded-xl bg-card2 p-3 text-sm space-y-0.5">
        {est.lines.map((l) => <div key={l}>{l}</div>)}
        <div className="font-semibold pt-1">Szacunkowe TDEE: {est.tdee} kcal (zakres {est.range.join('–')})</div>
        <div className="text-xs text-muted">Masa do obliczeń: {weight.toFixed(1)} kg (śr. 7 dni lub ostatni pomiar).</div>
      </div>
      <div className="rounded-xl border border-line p-3 text-sm">
        <div className="font-semibold">Z Twoich danych (ostatnie 28 dni)</div>
        <div>{obs.tdee ? `${obs.tdee} kcal. ${obs.reason} To dokładniejsze niż wzór, więc plan liczę od tej wartości.` : obs.reason}</div>
      </div>
      <div className="flex gap-2">{(['gentle', 'standard'] as const).map((k) => <button key={k} onClick={() => setPace(k)} className={cx('flex-1 min-h-11 rounded-lg text-sm', pace === k ? 'bg-accent text-accent-ink font-semibold' : 'bg-card2')}>{k === 'gentle' ? 'Łagodnie (−15%)' : 'Standard (−20%)'}</button>)}</div>
      <div className="rounded-xl bg-accent/10 p-3 text-sm">
        <div className="font-semibold">Propozycja: {plan.kcal} kcal · B {plan.proteinG} g · T {plan.fatG} g · W {plan.carbsG} g</div>
        <div className="text-muted">Deficyt ok. {plan.deficit} kcal/dzień, czyli orientacyjnie {plan.expectedLossKgWeek} kg/tydz. Białko 1,7 g/kg masy docelowej ({goal} kg). Minimum 2100 kcal.</div>
        <div className="text-muted mt-1">Obecny plan: {cur.kcal} kcal ({cur.kcal >= plan.kcal ? `o ${cur.kcal - plan.kcal} kcal więcej` : `o ${plan.kcal - cur.kcal} kcal mniej`}).</div>
      </div>
      <p className="text-xs text-muted">Kalorie spalone wg zegarka nie są doliczane do jedzenia (zegarki często je zawyżają). Zapotrzebowanie koryguje trend wagi.</p>
      <div className="flex gap-2"><Btn kind="soft" onClick={saveActivity}>Zapisz wywiad</Btn><Btn className="flex-1" onClick={apply}>Zastosuj jako nowy plan</Btn></div>
    </Sheet>
  );
}
const PACE_PCT: Record<Pace, number> = { gentle: 0.15, standard: 0.2 };

export function HealthSyncHelp({ onClose }: { onClose: () => void }) {
  const tpl = 'MBOS1;steps=[Kroki];sleep=[Sen];active=[Energia];rhr=[Tętno];weight=[Waga]';
  return (
    <Sheet open onClose={onClose} title="Synchronizacja z Apple Zdrowie">
      <p className="text-sm">Skrót iOS co wieczór odczytuje dane ze Zdrowia (też z zegarka), kopiuje je i przypomina o check-inie. W aplikacji stukasz „Wklej dane ze Zdrowia”.</p>
      <ol className="list-decimal pl-5 text-sm space-y-2">
        <li>Otwórz <b>Skróty</b> → zakładka Skróty → <b>+</b> (prawy górny róg).</li>
        <li>Dodaj czynność <b>Znajdź próbki zdrowotne</b>: Typ <b>Kroki</b>, filtr Data początkowa <b>jest dzisiaj</b>. Potem <b>Oblicz statystyki</b> → <b>Suma</b>. Stuknij wynik → Zmień nazwę na <b>Kroki</b> (albo dodaj „Ustaw zmienną”).</li>
        <li>To samo dla <b>Energia aktywna</b> (Suma, dzisiaj) → zmienna <b>Energia</b>.</li>
        <li><b>Tętno spoczynkowe</b>: Znajdź próbki, Sortuj wg Data początkowa, Najnowsze najpierw, Limit 1 → zmienna <b>Tętno</b>.</li>
        <li><b>Masa ciała</b>: jak tętno, z filtrem Data początkowa jest dzisiaj → zmienna <b>Waga</b>.</li>
        <li><b>Sen</b> (opcjonalnie): Znajdź próbki Typ Analiza snu, Data początkowa w ciągu ostatnich 1 dni, Wartość nie jest „W łóżku” → <b>Pobierz szczegóły próbki zdrowotnej: Czas trwania</b> → Oblicz statystyki Suma → zmienna <b>Sen</b>. Aplikacja sama rozpozna godziny, minuty lub sekundy.</li>
        <li>Dodaj czynność <b>Tekst</b> i wpisz poniższy wzór, wstawiając zmienne w nawiasach:</li>
      </ol>
      <pre className="text-xs bg-card2 rounded-xl p-3 whitespace-pre-wrap break-all">{tpl}</pre>
      <Btn kind="soft" className="w-full" onClick={() => copyText(tpl)}>Kopiuj wzór</Btn>
      <ol start={8} className="list-decimal pl-5 text-sm space-y-2">
        <li><b>Kopiuj do schowka</b> (wejście: Tekst), potem <b>Pokaż powiadomienie</b>: „Dane skopiowane. Otwórz Body OS i stuknij Wklej”. Nazwij skrót „Body OS sync”.</li>
        <li>Zakładka <b>Automatyzacja</b> → <b>+</b> → <b>Pora dnia</b> → 21:00, Codziennie → <b>Uruchom natychmiast</b> → wybierz „Body OS sync”.</li>
        <li>Przy pierwszym uruchomieniu iPhone zapyta o dostęp do danych Zdrowia: zezwól.</li>
      </ol>
      <p className="text-xs text-muted">Puste wartości (np. brak ważenia) są pomijane. Nazwy czynności mogą się nieznacznie różnić zależnie od wersji iOS. Dane nie wychodzą poza telefon.</p>
    </Sheet>
  );
}

export function PlanSettingsSheet({ plan, today, onClose }: { plan: import('../domain/types').PlanVersion; today: string; onClose: () => void }) {
  const [cyc, setCyc] = useState({ ...DEFAULT_CYCLING, ...plan.cycling });
  const [ir, setIr] = useState({ ...DEFAULT_RULES.insulinResistance, ...plan.rules?.insulinResistance });
  const [dairy, setDairy] = useState(plan.rules?.dairyFree?.enabled ?? false);
  const [per14, setPer14] = useState(plan.workoutsPer14d);
  const draft = { ...plan, cycling: cyc, rules: { insulinResistance: ir, dairyFree: { enabled: dairy } }, workoutsPer14d: per14 };
  const tr = dayTargets(draft, true), rest = dayTargets(draft, false);
  async function save() {
    await db.plans.add({ ...draft, id: uid(), createdAt: now(), updatedAt: now(), validFrom: today, reason: 'Zmiana ustawień planu (cykl kcal / reguły zdrowotne / liczba treningów)', approvedByUser: true, source: 'manual' });
    await db.health.update('me', { dairyAvoid: dairy, updatedAt: now() });
    toast('Ustawienia zapisane jako nowa wersja planu'); onClose();
  }
  const T = ({ t, label }: { t: ReturnType<typeof dayTargets>; label: string }) => (
    <div className="rounded-xl bg-card2 p-3 text-sm"><div className="text-xs text-muted">{label}</div><div className="num font-semibold">{t.kcal} kcal</div>
      <div className="num text-xs text-muted">B {t.proteinG} · T {t.fatG} · W {t.carbsG} · Bł ≥{t.fiberG}{t.sugarMaxG ? ` · cukry ≤${t.sugarMaxG}` : ''}</div></div>
  );
  return (
    <Sheet open onClose={onClose} title="Ustawienia planu">
      <p className="text-sm text-muted">Średni cel: {plan.kcal} kcal, B {plan.proteinG} g. Każda zmiana zapisuje się jako nowa wersja planu (historia zostaje).</p>
      <div className="grid grid-cols-2 gap-2"><T t={tr} label="Dzień treningowy" /><T t={rest} label="Dzień bez treningu" /></div>

      <div className="rounded-xl border border-line p-3 space-y-2">
        <Toggle on={cyc.enabled} onChange={(v) => setCyc({ ...cyc, enabled: v })} label="Inne kalorie w dni treningowe" />
        {cyc.enabled && <Field label="Dodatkowe kcal w dzień treningowy (z węglowodanów)"><NumInput value={cyc.trainingExtraKcal} onChange={(v) => setCyc({ ...cyc, trainingExtraKcal: Math.max(0, Math.min(500, v ?? 0)) })} /></Field>}
        <p className="text-xs text-muted">Średnia tygodnia się nie zmienia: dni bez treningu dostają odpowiednio mniej. Deficyt i tempo chudnięcia są te same, a więcej węglowodanów przypada na trening.</p>
      </div>

      <div className="rounded-xl border border-line p-3 space-y-2">
        <Toggle on={ir.enabled} onChange={(v) => setIr({ ...ir, enabled: v })} label="Insulinooporność: reguły posiłków" />
        {ir.enabled && <div className="grid grid-cols-2 gap-2">
          <Field label="Węglowodany max % kcal"><NumInput value={ir.carbMaxPct} onChange={(v) => setIr({ ...ir, carbMaxPct: Math.max(30, Math.min(60, v ?? 45)) })} /></Field>
          <Field label="Cukry max % kcal"><NumInput value={ir.sugarMaxPct} onChange={(v) => setIr({ ...ir, sugarMaxPct: Math.max(5, Math.min(20, v ?? 10)) })} /></Field>
          <Field label="Błonnik min (g)"><NumInput value={ir.fiberMin} onChange={(v) => setIr({ ...ir, fiberMin: Math.max(20, Math.min(50, v ?? 30)) })} /></Field>
          <Field label="Węgle na posiłek max (g)"><NumInput value={ir.carbsPerMealMaxG} onChange={(v) => setIr({ ...ir, carbsPerMealMaxG: Math.max(40, Math.min(150, v ?? 80)) })} /></Field>
        </div>}
        <p className="text-xs text-muted">Bez eliminowania węglowodanów: limit udziału, mniej cukrów, więcej błonnika i rozłożenie węgli na posiłki. Nadwyżka ponad limit przechodzi do tłuszczu, białko bez zmian.</p>
      </div>

      <div className="rounded-xl border border-line p-3 space-y-2">
        <Toggle on={dairy} onChange={setDairy} label="Bez nabiału (ostrzeżenia przy produktach z mlekiem)" />
        <p className="text-xs text-muted">Przy diecie bez nabiału pilnuj wapnia (napój sojowy z wapniem, tofu z wapniem) i B12. Zapytaj lekarza o badanie B12 i witaminy D.</p>
      </div>

      <Field label="Treningi na 14 dni"><NumInput value={per14} onChange={(v) => setPer14(Math.max(0, Math.min(10, v ?? 4)))} /></Field>
      <Btn className="w-full" onClick={save}>Zapisz jako nową wersję planu</Btn>
    </Sheet>
  );
}
