import { blockAverages, mean, round, type DatedValue } from './calc';
import { addDays, type LocalDate } from './dates';
import type { DaySnapshot, Recommendation } from './coaching';
import type { AdaptResult } from './adaptation';

export interface WeeklyStats {
  from: LocalDate; to: LocalDate;
  weightAvg: number | null; weightN: number; weightPrevAvg: number | null; weightChange: number | null;
  trend14: number | null; trend28: number | null; waistChange: number | null;
  kcalAvg: number | null; kcalTargetAvg: number | null; proteinAvg: number | null; intakeDays: number; completeIntakeDays: number;
  stepsAvg: number | null; workoutsDone: number; workoutsPlanned: number;
  sleepAvgH: number | null; sleepQ: number | null; stressAvg: number | null; energyAvg: number | null;
  digestiveDays: number; kneeMax: number | null; completeDays: number;
  len: number; dietYes: number; dietPartial: number; dietAnswered: number; stepsGoalDays: number; stepsDays: number;
  activeKcalAvg: number | null; restingHrAvg: number | null; restingHrFirst: number | null; restingHrLast: number | null; periodChange: number | null;
}

export function weeklyStats(days: DaySnapshot[], weights: DatedValue[], waists: DatedValue[], end: LocalDate, len = 7, stepGoal = 8000): WeeklyStats {
  const from = addDays(end, -(len - 1));
  const wk = days.filter((d) => d.date >= from && d.date <= end);
  const [b0, b1, b2, , w4] = blockAverages(weights, end, 5);
  const wNow = waists.filter((w) => w.date >= from && w.date <= end).at(-1);
  const wPrev = waists.filter((w) => w.date < from).at(-1);
  const sleep = mean(wk.map((d) => d.morning?.sleepMinutes)).value;
  return {
    from, to: end,
    weightAvg: round(b0.value, 2), weightN: b0.n, weightPrevAvg: round(b1.value, 2),
    weightChange: b0.value !== null && b1.value !== null ? round(b0.value - b1.value, 2) : null,
    trend14: b0.value !== null && b2.value !== null ? round(b0.value - b2.value, 2) : null,
    trend28: b0.value !== null && w4.value !== null ? round(b0.value - w4.value, 2) : null,
    waistChange: wNow && wPrev ? round(wNow.value - wPrev.value, 1) : null,
    kcalAvg: round(mean(wk.map((d) => d.kcal)).value, 0), proteinAvg: round(mean(wk.map((d) => d.protein)).value, 0),
    intakeDays: wk.filter((d) => d.kcal !== undefined).length,
    completeIntakeDays: wk.filter((d) => d.completeness === 'confirmed' || d.completeness === 'probable').length,
    kcalTargetAvg: round(mean(wk.filter((d) => d.kcal !== undefined).map((d) => d.target)).value, 0),
    stepsAvg: round(mean(wk.map((d) => d.evening?.steps)).value, 0),
    workoutsDone: wk.filter((d) => d.workoutDone).length, workoutsPlanned: wk.filter((d) => d.workoutPlanned || d.workoutDone).length,
    sleepAvgH: sleep !== null ? round(sleep / 60, 1) : null, sleepQ: round(mean(wk.map((d) => d.morning?.sleepQuality)).value, 1),
    stressAvg: round(mean(wk.map((d) => d.morning?.stress ?? d.evening?.stress)).value, 1),
    energyAvg: round(mean(wk.map((d) => d.morning?.energy)).value, 1),
    digestiveDays: wk.filter((d) => (d.evening?.digestive ?? 0) >= 2).length,
    kneeMax: wk.some((d) => d.morning?.kneePain !== undefined || d.evening?.kneePain !== undefined)
      ? Math.max(...wk.map((d) => Math.max(d.morning?.kneePain ?? 0, d.evening?.kneePain ?? 0))) : null,
    completeDays: wk.filter((d) => d.morning && d.evening && d.kcal !== undefined).length,
    len,
    dietYes: wk.filter((d) => d.evening?.dietAdherence === 'yes').length,
    dietPartial: wk.filter((d) => d.evening?.dietAdherence === 'partial').length,
    dietAnswered: wk.filter((d) => d.evening?.dietAdherence).length,
    stepsGoalDays: wk.filter((d) => (d.evening?.steps ?? 0) >= stepGoal).length,
    stepsDays: wk.filter((d) => d.evening?.steps !== undefined).length,
    activeKcalAvg: round(mean(wk.map((d) => d.evening?.activeKcal)).value, 0),
    restingHrAvg: round(mean(wk.map((d) => d.evening?.restingHr)).value, 0),
    restingHrFirst: round(mean(wk.slice(0, 7).map((d) => d.evening?.restingHr)).value, 0),
    restingHrLast: round(mean(wk.slice(-7).map((d) => d.evening?.restingHr)).value, 0),
    periodChange: (() => {
      const a = mean(weights.filter((w) => w.date >= from && w.date <= addDays(from, 6)).map((w) => w.value));
      const b = mean(weights.filter((w) => w.date > addDays(end, -7) && w.date <= end).map((w) => w.value));
      return len > 7 && a.n >= 3 && b.n >= 3 ? round(b.value! - a.value!, 2) : null;
    })(),
  };
}

const f = (v: number | null, unit = '', digits?: number) => (v === null ? 'brak danych' : `${digits !== undefined ? v.toFixed(digits) : v}${unit}`);
const signed = (v: number | null, unit: string) => (v === null ? 'brak danych' : `${v > 0 ? '+' : ''}${v.toFixed(2)}${unit}`);

export function weeklyMarkdown(s: WeeklyStats, adapt: AdaptResult, recs: Recommendation[], kcalTarget: number): string {
  const works: string[] = [];
  const limits: string[] = [];
  if (s.proteinAvg !== null && s.proteinAvg >= 150) works.push(`białko średnio ${s.proteinAvg} g`); else if (s.proteinAvg !== null) limits.push(`białko ${s.proteinAvg} g (cel 165 g)`);
  if (s.workoutsDone > 0) works.push(`${s.workoutsDone} trening(i)`);
  if (s.intakeDays >= Math.ceil(s.len * 0.7)) works.push(`dziennik jedzenia ${s.intakeDays}/${s.len} dni`); else limits.push(`dziennik jedzenia tylko ${s.intakeDays}/${s.len} dni`);
  if (s.dietAnswered && s.dietYes / s.dietAnswered >= 0.7) works.push(`dieta zgodnie z planem w ${s.dietYes}/${s.dietAnswered} dni`); else if (s.dietAnswered) limits.push(`dieta zgodnie z planem tylko w ${s.dietYes}/${s.dietAnswered} dni`);
  if (s.sleepAvgH !== null && s.sleepAvgH < 7) limits.push(`sen ${s.sleepAvgH} h`);
  if (s.weightN < 4) limits.push(`ważenia ${s.weightN}/7 (mało wiarygodne)`);
  const enough = s.weightN >= 4 && s.intakeDays >= Math.ceil(s.len * 0.7);
  const main = recs[0];
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}% (${a}/${b})` : 'brak danych');
  const title = s.len >= 28 ? 'Raport miesięczny (28 dni)' : s.len === 14 ? 'Raport 14-dniowy' : 'Raport tygodniowy';
  return [
    `# ${title} ${s.from} – ${s.to}`, '',
    ...(s.len > 7 ? ['## Realizacja planu',
      `- Dieta zgodnie z planem: ${pct(s.dietYes, s.dietAnswered)}${s.dietPartial ? `, częściowo: ${s.dietPartial} dni` : ''}`,
      `- Treningi: ${pct(s.workoutsDone, s.workoutsPlanned)}`,
      `- Dni z celem kroków: ${pct(s.stepsGoalDays, s.stepsDays)}`,
      `- Dni z kompletnymi danymi: ${pct(s.completeDays, s.len)}`,
      `- Zmiana masy (pierwszy vs ostatni tydzień): ${signed(s.periodChange, ' kg')}`,
      `- Tętno spoczynkowe: ${s.restingHrFirst ?? '—'} → ${s.restingHrLast ?? '—'} bpm, aktywne kcal z zegarka śr.: ${f(s.activeKcalAvg)} (tylko informacyjnie)`, ''] : []),
    '## 1. Co się zmieniło?',
    `- Średnia masa (ostatnie 7 dni): ${f(s.weightAvg, ' kg')} (${s.weightN} ważeń), zmiana tyg.: ${signed(s.weightChange, ' kg')}`,
    `- Trend 14 dni: ${signed(s.trend14, ' kg')}, 28 dni: ${signed(s.trend28, ' kg')}`,
    `- Talia: ${s.waistChange === null ? 'brak danych' : signed(s.waistChange, ' cm')}`,
    `- Kalorie: ${f(s.kcalAvg, ' kcal')} (cel tych dni ${s.kcalTargetAvg ?? kcalTarget}; kompletne dni ${s.completeIntakeDays}/${s.intakeDays}), białko: ${f(s.proteinAvg, ' g')}, kroki: ${f(s.stepsAvg)}`,
    `- Treningi: ${s.workoutsDone}/${s.workoutsPlanned} zaplanowanych`,
    `- Sen: ${f(s.sleepAvgH, ' h')}, jakość ${f(s.sleepQ, '/5')}, stres ${f(s.stressAvg, '/10')}, energia ${f(s.energyAvg, '/5')}`,
    `- Objawy trawienne: ${s.digestiveDays} dni, kolano maks.: ${f(s.kneeMax, '/10')}`, '',
    '## 2. Co działa?', works.length ? works.map((w) => `- ${w}`).join('\n') : '- Za mało danych, by ocenić.', '',
    '## 3. Co najbardziej ogranicza postęp?', limits.length ? `- ${limits[0]}` : '- Nic wyraźnego w danych.', '',
    '## 4. Czy plan jest skuteczny?', `- ${adapt.message}`, '',
    '## 5. Czy mamy wystarczające dane?', `- ${enough ? 'Tak' : 'Nie'}: kompletne dni ${s.completeDays}/${s.len}, ważenia w ost. tygodniu ${s.weightN}/7, dziennik ${s.intakeDays}/${s.len}.`, '',
    `## 6. Co zmieniamy w kolejnym ${s.len >= 28 ? 'miesiącu' : 'tygodniu'}?`, adapt.proposal ? `- Propozycja (wymaga Twojej akceptacji): ${adapt.proposal.kind === 'kcal' ? `${adapt.proposal.newKcal} kcal` : `+${adapt.proposal.stepsDelta} kroków`}. ${adapt.proposal.reason}` : '- Bez zmian w planie.', '',
    '## 7. Jeden główny priorytet', `- ${main ? `${main.title}: ${main.action}` : 'Poranny check-in z ważeniem codziennie.'}`, '',
  ].join('\n');
}

export function aiContext(p: {
  stats: WeeklyStats; adapt: AdaptResult; recs: Recommendation[]; plan: { kcal: number; proteinG: number; fatG: number; carbsG: number; validFrom: string };
  profile: { heightCm: number; age: number; goals: string; sex?: 'male' | 'female' }; health?: string[]; days: number; kcalFloor?: number;
}): string {
  return [
    `Kontekst z aplikacji My Body OS (dane własne, ostatnie ${p.days} dni). Nie jestem pacjentem w trakcie diagnozy; proszę o ocenę planu.`,
    `Profil: ${p.profile.sex === 'female' ? 'kobieta' : 'mężczyzna'}, ${p.profile.age} lat, ${p.profile.heightCm} cm. Cele: ${p.profile.goals}.`,
    `Plan od ${p.plan.validFrom}: ${p.plan.kcal} kcal, B ${p.plan.proteinG} g, T ${p.plan.fatG} g, W ${p.plan.carbsG} g.`,
    `Waga śr. 7 dni: ${f(p.stats.weightAvg, ' kg')} (${p.stats.weightN}/7 ważeń), zmiana tyg.: ${signed(p.stats.weightChange, ' kg')}, trend 14d: ${signed(p.stats.trend14, ' kg')}, 28d: ${signed(p.stats.trend28, ' kg')}.`,
    `Talia: ${p.stats.waistChange === null ? 'brak' : signed(p.stats.waistChange, ' cm')}. Kcal śr.: ${f(p.stats.kcalAvg)} (${p.stats.intakeDays}/7 dni). Białko: ${f(p.stats.proteinAvg, ' g')}. Kroki: ${f(p.stats.stepsAvg)}.`,
    `Treningi: ${p.stats.workoutsDone}/${p.stats.workoutsPlanned}. Sen ${f(p.stats.sleepAvgH, ' h')}, jakość ${f(p.stats.sleepQ, '/5')}, stres ${f(p.stats.stressAvg, '/10')}.`,
    `Kompletność: ${p.stats.completeDays}/7 pełnych dni.`,
    `Silnik reguł: ${p.adapt.message}`,
    p.recs.length ? `Wykryte problemy: ${p.recs.slice(0, 3).map((r) => r.title).join('; ')}.` : 'Wykryte problemy: brak.',
    p.health?.length ? `Ograniczenia zdrowotne: ${p.health.join('; ')}.` : 'Ograniczenia zdrowotne: pominięte przez użytkownika.',
    `Pytanie: czy rekomendujesz jedną korektę planu na kolejne 14 dni? Uwzględnij, że zmiany kalorii mają być małe (150–200 kcal) i nie poniżej ${p.kcalFloor ?? 2100} kcal bez konsultacji.`,
  ].join('\n');
}
