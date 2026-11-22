import { useState } from 'react';
import { db, now, uid } from '../db/db';
import { applyProfile, PrivateProfile, type AppData, type PrivateProfileT } from '../db/repo';
import { importAll, isEncrypted, decryptBackup } from '../db/backup';
import { addDays, formatPl, mondayOf, range, today, weekday } from '../domain/dates';
import { PATTERN_223, cycleIndex } from '../domain/schedule';
import { Btn, Card, cx, Field, inputCls, NumInput, toast } from '../ui/kit';
import { ActivityForm } from './Energy';
import { bmrMifflin } from '../domain/calc';
import { estimateTdee, planFromTdee, type ActivityProfile } from '../domain/energy';
import { DEFAULT_RULES } from '../domain/targets';

const DEMO: PrivateProfileT = {
  format: 'my-body-os-profile',
  profile: { name: 'Demo', sex: 'male', ageYears: 30, ageRefDate: '2026-01-01', heightCm: 180, declaredWeightKg: 95, goals: [{ kg: 85, label: 'Cel 1' }] },
  health: { conditions: [], kneeNote: '', kneeCleared: true, dairyAvoid: false, notes: [] },
  plan: { kcal: 2300, proteinG: 150, fatG: 75, carbsG: 255, fiberG: [30, 35], mealsPerDay: 4, workoutsPer14d: 4 },
};

export function Onboarding({ data }: { data: AppData }) {
  const [step, setStep] = useState<'profile' | 'manual' | 'health' | 'custody' | 'measure'>(data.profile ? (data.custody ? 'measure' : 'custody') : 'profile');
  const [manual, setManual] = useState({ name: '', sex: 'male' as 'male' | 'female', heightCm: 180, ageYears: 30, weightKg: 100, goalKg: 90 });
  const [act, setAct] = useState<ActivityProfile>({ job: 'desk', stepsPerDay: 6000, workoutsPerWeek: 2, workoutMin: 60, workoutType: 'strength', cardioMinPerWeek: 0 });
  const est = estimateTdee(bmrMifflin({ weightKg: manual.weightKg, heightCm: manual.heightCm, age: manual.ageYears, sex: manual.sex }), manual.weightKg, manual.heightCm, act);
  const calc = planFromTdee(est.tdee, manual.goalKg, 'gentle', manual.sex === 'male' ? 1800 : 1400);
  const [refDate, setRefDate] = useState(today());
  const [withD, setWithD] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [hq, setHq] = useState({ ir: false, dairy: false, knee: false, other: '' });
  const [m, setM] = useState<{ weightKg?: number; waistCm?: number; hipsCm?: number; chestCm?: number; armCm?: number; thighCm?: number }>({});

  async function onFile(f: File) {
    try {
      let json: unknown = JSON.parse(await f.text());
      if (isEncrypted(json)) { if (!pw) return toast('Kopia zaszyfrowana: wpisz hasło poniżej i wybierz plik ponownie'); json = await decryptBackup(json, pw); }
      const pp = PrivateProfile.safeParse(json);
      if (pp.success) { await applyProfile(pp.data, today()); toast('Profil wczytany'); setStep('custody'); return; }
      const r = await importAll(json);
      if (r.ok) { toast('Kopia zapasowa odtworzona'); await db.settings.update('settings', { onboarded: true }); return; }
      toast(r.error);
    } catch { toast('Nie udało się odczytać pliku'); }
  }
  async function saveManual() {
    await applyProfile({ ...DEMO, profile: { ...DEMO.profile, name: manual.name || 'Ja', sex: manual.sex, heightCm: manual.heightCm, ageYears: manual.ageYears, ageRefDate: today(), declaredWeightKg: manual.weightKg, goals: [{ kg: manual.goalKg, label: 'Cel 1' }] },
      health: { ...DEMO.health, kneeCleared: true }, plan: { ...DEMO.plan, kcal: calc.kcal, proteinG: calc.proteinG, fatG: calc.fatG, carbsG: calc.carbsG, workoutsPer14d: Math.max(2, act.workoutsPerWeek * 2) } }, today());
    await db.profile.update('me', { activity: act });
    setStep('health');
  }
  /** Ankieta zdrowotna: zapis w miejscach, z których czytają cele, przepisy, propozycje i blokady (bez nowych pól). */
  async function saveHealth() {
    const t = now();
    await db.health.update('me', { dairyAvoid: hq.dairy, kneeCleared: !hq.knee, kneeNote: hq.knee ? 'Zgłoszony problem z kolanem (ankieta startowa). Ocena specjalisty zalecana.' : '', conditions: hq.other.trim() ? [hq.other.trim()] : [], updatedAt: t });
    const plan = (await db.plans.toArray()).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
    if (plan) await db.plans.update(plan.id, { rules: { ...plan.rules, insulinResistance: { ...DEFAULT_RULES.insulinResistance, ...plan.rules?.insulinResistance, enabled: hq.ir }, dairyFree: { enabled: hq.dairy } }, updatedAt: t });
    setStep('custody');
  }
  // cykl zaczyna się w poniedziałek; odpowiedź na "czy córka jest u Ciebie" jednoznacznie wyznacza fazę
  const cycleStart = withD === null ? null : (() => {
    const mon = mondayOf(refDate); const w = weekday(refDate);
    return PATTERN_223[w] === (withD ? 1 : 0) ? mon : addDays(mon, -7);
  })();
  async function saveCustody() {
    if (!cycleStart) return;
    await db.custody.put({ id: 'custody', cycleStart, confirmed: true, updatedAt: now() });
    setStep('measure');
  }
  async function finish(save: boolean) {
    const has = Object.values(m).some((v) => v !== undefined);
    if (save && has) await db.measurements.add({ id: uid(), createdAt: now(), updatedAt: now(), date: today(), ...m, source: 'manual' });
    if (save && m.weightKg) await db.morning.put({ date: today(), weightKg: m.weightKg, symptoms: [], createdAt: now(), updatedAt: now() });
    await db.settings.update('settings', { onboarded: true });
  }

  return (
    <div className="mx-auto max-w-lg px-4 safe-t pb-10 space-y-4">
      <h1 className="text-3xl font-bold pt-4">My Body OS</h1>
      {step === 'profile' && (<>
        <p className="text-muted">Dane zostają na tym urządzeniu. Wczytaj swój prywatny plik profilu albo kopię zapasową.</p>
        <Card>
          <label className="block">
            <span className="block font-semibold mb-1">Wczytaj plik (.json)</span>
            <span className="block text-sm text-muted mb-3">Prywatny profil lub kopia zapasowa.</span>
            <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-accent file:text-accent-ink file:px-4 file:py-3 file:font-semibold" />
          </label>
          <input type="password" className={inputCls + ' mt-3'} placeholder="Hasło (tylko dla zaszyfrowanej kopii)" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <Btn kind="soft" onClick={() => setStep('manual')}>Wpisz ręcznie</Btn>
          <Btn kind="soft" onClick={async () => { await applyProfile(DEMO, today()); setStep('custody'); }}>Profil demo</Btn>
        </div>
      </>)}
      {step === 'manual' && (
        <Card className="space-y-3">
          <Field label="Imię"><input className={inputCls} value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Wzrost (cm)"><NumInput value={manual.heightCm} onChange={(v) => setManual({ ...manual, heightCm: v ?? 0 })} /></Field>
            <Field label="Wiek"><NumInput value={manual.ageYears} onChange={(v) => setManual({ ...manual, ageYears: v ?? 0 })} /></Field>
            <Field label="Waga (kg)"><NumInput value={manual.weightKg} onChange={(v) => setManual({ ...manual, weightKg: v ?? 0 })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Płeć"><select className={inputCls} value={manual.sex} onChange={(e) => setManual({ ...manual, sex: e.target.value as 'male' | 'female' })}><option value="male">mężczyzna</option><option value="female">kobieta</option></select></Field>
            <Field label="Waga docelowa (kg)"><NumInput value={manual.goalKg} onChange={(v) => setManual({ ...manual, goalKg: v ?? 0 })} /></Field>
          </div>
          <ActivityForm a={act} onChange={setAct} />
          <div className="rounded-xl bg-card2 p-3 text-sm">
            {est.lines.map((l) => <div key={l}>{l}</div>)}
            <div className="font-semibold mt-1">TDEE ok. {est.tdee} kcal → plan {calc.kcal} kcal (−15%), B {calc.proteinG} g, T {calc.fatG} g, W {calc.carbsG} g</div>
            <div className="text-xs text-muted">Hipoteza startowa. Po 3–4 tygodniach aplikacja przeliczy ją z Twojej wagi i jedzenia.</div>
          </div>
          <Btn className="w-full" onClick={saveManual}>Dalej</Btn>
        </Card>
      )}
      {step === 'health' && (
        <Card className="space-y-3">
          <div className="font-semibold">Zdrowie (dopasuje cele, przepisy i trening)</div>
          <p className="text-xs text-muted">Zostaje tylko na tym telefonie. Możesz zmienić później w zakładce Zdrowie.</p>
          {([['ir', 'Insulinooporność lub cukrzyca (diagnoza lekarza)', 'Pilnuję błonnika i rozkładu węglowodanów; limity ustal ze specjalistą w Ustawieniach planu.'],
            ['dairy', 'Objawy po nabiale albo unikam nabiału', 'Przepisy i propozycje dostaną zamienniki bez mleka.'],
            ['knee', 'Ból lub uraz kolana', 'Ćwiczenia mocno obciążające kolano będą ograniczone do czasu oceny specjalisty.']] as const).map(([k, label, hint]) => (
            <div key={k} className="rounded-xl bg-card2 p-3">
              <div className="text-sm">{label}</div>
              <div className="grid grid-cols-2 gap-2 mt-2">{[false, true].map((v) => <button key={String(v)} onClick={() => setHq({ ...hq, [k]: v })} className={cx('min-h-11 rounded-lg text-sm', hq[k] === v ? 'bg-accent text-accent-ink font-semibold' : 'bg-card')}>{v ? 'Tak' : 'Nie'}</button>)}</div>
              {hq[k] && <div className="text-xs text-muted mt-1">{hint}</div>}
            </div>
          ))}
          <Field label="Inne choroby lub leki, o których coach powinien wiedzieć (opcjonalnie)"><input className={inputCls} value={hq.other} onChange={(e) => setHq({ ...hq, other: e.target.value })} placeholder="np. nadciśnienie" /></Field>
          <p className="text-xs text-muted">Aplikacja nie diagnozuje i nie zastępuje lekarza.</p>
          <Btn className="w-full" onClick={saveHealth}>Dalej</Btn>
        </Card>
      )}
      {step === 'custody' && (
        <Card className="space-y-4">
          <div><div className="font-semibold">Kalendarz opieki 2-2-3</div><div className="text-sm text-muted">Dwa pytania, potem sprawdź podgląd.</div></div>
          <Field label="Data odniesienia"><input type="date" className={inputCls} value={refDate} onChange={(e) => setRefDate(e.target.value || today())} /></Field>
          <div>
            <div className="text-sm text-muted mb-1">Czy {formatPl(refDate)} córka jest u Ciebie?</div>
            <div className="grid grid-cols-2 gap-2">
              <Btn kind={withD === true ? 'primary' : 'soft'} onClick={() => setWithD(true)}>Tak</Btn>
              <Btn kind={withD === false ? 'primary' : 'soft'} onClick={() => setWithD(false)}>Nie</Btn>
            </div>
          </div>
          {cycleStart && (<>
            <div className="text-sm text-muted">Podgląd 14 dni (kolor = córka u Ciebie). Jeśli faza się nie zgadza, zmień odpowiedź lub datę.</div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {range(mondayOf(refDate), 14).map((dt) => {
                const on = PATTERN_223[cycleIndex(cycleStart, dt)] === 1;
                return <div key={dt} className={cx('rounded-lg py-2', on ? 'bg-accent text-accent-ink' : 'bg-card2', dt === refDate && 'ring-2 ring-ink')}>{formatPl(dt)}</div>;
              })}
            </div>
            <Btn className="w-full" onClick={saveCustody}>Zgadza się</Btn>
          </>)}
        </Card>
      )}
      {step === 'measure' && (
        <Card className="space-y-3">
          <div><div className="font-semibold">Aktualne pomiary</div><div className="text-sm text-muted">Wszystkie opcjonalne. Talia na wysokości pępka, ramię bez napinania. Rano, na czczo, po toalecie.</div></div>
          <div className="grid grid-cols-2 gap-2">
            {([['weightKg', 'Waga (kg)'], ['waistCm', 'Talia (cm)'], ['hipsCm', 'Biodra (cm)'], ['chestCm', 'Klatka (cm)'], ['armCm', 'Ramię (cm)'], ['thighCm', 'Udo (cm)']] as const).map(([k, l]) => (
              <Field key={k} label={l}><NumInput value={m[k]} onChange={(v) => setM({ ...m, [k]: v })} /></Field>
            ))}
          </div>
          <Btn className="w-full" onClick={() => finish(true)}>Zapisz i zacznij</Btn>
          <Btn kind="ghost" className="w-full" onClick={() => finish(false)}>Pomiń na teraz</Btn>
        </Card>
      )}
    </div>
  );
}
