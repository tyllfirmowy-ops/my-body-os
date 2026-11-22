import { mean, type DatedValue } from './calc';
import { addDays, type LocalDate } from './dates';

/** Wywiad o ruchu. Wszystkie wartości to deklaracje użytkownika lub średnie z telefonu/zegarka. */
export interface ActivityProfile {
  job: 'desk' | 'mixed' | 'standing' | 'physical';
  stepsPerDay: number;
  workoutsPerWeek: number;
  workoutMin: number;
  workoutType: 'strength' | 'mixed' | 'cardio';
  cardioMinPerWeek: number;   // marsz na bieżni, rower itp. poza treningiem
}

/** Bazowy mnożnik BMR za pracę i styl dnia (zawiera termogenezę poposiłkową ~10% i ~3000 kroków). */
export const JOB_FACTOR: Record<ActivityProfile['job'], number> = { desk: 1.15, mixed: 1.22, standing: 1.3, physical: 1.45 };
export const JOB_LABEL: Record<ActivityProfile['job'], string> = { desk: 'Siedząca (biuro, auto)', mixed: 'Mieszana', standing: 'Stojąca / dużo chodzenia', physical: 'Fizyczna' };
const NET_MET: Record<ActivityProfile['workoutType'], number> = { strength: 2.5, mixed: 3.5, cardio: 4.5 };

export interface EnergyEstimate {
  bmr: number; base: number; steps: number; training: number; cardio: number; tdee: number;
  range: [number, number];
  lines: string[];
}

/**
 * Szacunkowe całkowite zapotrzebowanie (TDEE) = BMR × mnożnik pracy + kroki ponad 3000 + trening + cardio.
 * Koszt chodzenia ~0,5 kcal/kg/km (netto), długość kroku ~0,415 × wzrost. Trening: MET netto × kg × h.
 * To hipoteza startowa (±10–15%); kalibruje ją trend wagi (observedTdee).
 */
export function estimateTdee(bmr: number, weightKg: number, heightCm: number, a: ActivityProfile): EnergyEstimate {
  const base = bmr * JOB_FACTOR[a.job];
  const strideKm = (heightCm * 0.415) / 100000;
  const steps = Math.max(0, a.stepsPerDay - 3000) * strideKm * 0.5 * weightKg;
  const training = (NET_MET[a.workoutType] * weightKg * (a.workoutMin / 60) * a.workoutsPerWeek) / 7;
  const cardio = (2.8 * weightKg * (a.cardioMinPerWeek / 60)) / 7;
  const tdee = base + steps + training + cardio;
  const r = (v: number) => Math.round(v);
  return {
    bmr: r(bmr), base: r(base), steps: r(steps), training: r(training), cardio: r(cardio), tdee: r(tdee),
    range: [Math.round((tdee * 0.9) / 10) * 10, Math.round((tdee * 1.1) / 10) * 10],
    lines: [
      `Przemiana spoczynkowa (BMR): ${r(bmr)} kcal`,
      `Praca i dzień codzienny (×${JOB_FACTOR[a.job]}): +${r(base - bmr)} kcal`,
      `Kroki (${a.stepsPerDay.toLocaleString('pl-PL')}/dzień): +${r(steps)} kcal`,
      `Trening (${a.workoutsPerWeek}×${a.workoutMin} min/tydz.): +${r(training)} kcal/dzień`,
      `Cardio (${a.cardioMinPerWeek} min/tydz.): +${r(cardio)} kcal/dzień`,
    ],
  };
}

export type Pace = 'gentle' | 'standard';
/**
 * Docelowe tempo spadku masy (% masy ciała/tydz.). Helms 2014: 0,5–1%/tydz. dla zachowania mięśni;
 * Garthe 2011: 0,7% vs 1,4% z treningiem siłowym → więcej masy beztłuszczowej i siły przy wolniejszym tempie.
 */
export const PACE_RATE: Record<Pace, number> = { gentle: 0.005, standard: 0.007 };
export const PACE_LABEL: Record<Pace, string> = { gentle: 'Spokojnie (~0,5% masy/tydz.)', standard: 'Standard (~0,7% masy/tydz.)' };

export const bmiOf = (kg: number, cm: number) => kg / (cm / 100) ** 2;
/** Masa referencyjna do białka i tłuszczu: aktualna, a przy BMI > 25 masa odpowiadająca BMI 25 (nie liczymy białka na tkankę tłuszczową). */
export const referenceWeight = (kg: number, cm: number) => Math.min(kg, 25 * (cm / 100) ** 2);
/**
 * Minimum kalorii: dolne wartości z wytycznych AHA/ACC/TOS 2013 (1500 kcal mężczyźni, 1200 kobiety)
 * i nie mniej niż szacowana przemiana spoczynkowa (reguła projektowa: ochrona mięśni, sytości i wytrwałości).
 */
export const kcalFloor = (sex: 'male' | 'female', bmr: number) => Math.max(sex === 'female' ? 1200 : 1500, Math.floor(bmr / 50) * 50);
/**
 * Górny limit deficytu: przy treningu siłowym deficyt > ~500 kcal/dzień blokuje przyrost masy beztłuszczowej (Murphy i Koehler 2022);
 * przy otyłości (BMI ≥ 30) dopuszczamy do 750 kcal (AHA/ACC/TOS 2013: 500–750). Zawsze ≤ 25% TDEE (reguła projektowa).
 */
export const deficitCap = (kg: number, cm: number, tdee: number) => Math.round(Math.min(bmiOf(kg, cm) >= 30 ? 750 : 500, tdee * 0.25));

export interface PlanCalcInput { tdee: number; bmr: number; weightKg: number; heightCm: number; sex: 'male' | 'female'; pace: Pace }
export type PlanBound = 'rate' | 'cap' | 'floor';

/**
 * Indywidualny plan redukcji: deficyt z docelowego tempa (% masy), przycięty limitem deficytu i minimum kalorii.
 * Białko 1,8 g/kg masy referencyjnej (Morton 2018: korzyść do ~1,6 g/kg, górna granica przedziału ~2,2; w deficycie bliżej górnej części),
 * tłuszcz 28% kcal, ale nie mniej niż 0,6 g/kg masy referencyjnej; reszta węglowodany.
 */
export function planFor(i: PlanCalcInput) {
  const wanted = (i.weightKg * PACE_RATE[i.pace] * 7700) / 7;
  const cap = deficitCap(i.weightKg, i.heightCm, i.tdee);
  const floor = kcalFloor(i.sex, i.bmr);
  const byRate = Math.round((i.tdee - Math.min(wanted, cap)) / 50) * 50;
  const kcal = Math.max(floor, byRate);
  const bound: PlanBound = kcal === floor && byRate < floor ? 'floor' : wanted > cap ? 'cap' : 'rate';
  const ref = referenceWeight(i.weightKg, i.heightCm);
  const proteinG = Math.round((ref * 1.8) / 5) * 5;
  const fatG = Math.max(Math.round((kcal * 0.28) / 9 / 5) * 5, Math.round((ref * 0.6) / 5) * 5);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const deficit = Math.round(i.tdee - kcal);
  return { kcal, proteinG, fatG, carbsG, deficit, floor, cap, refWeightKg: Math.round(ref * 10) / 10, bound,
    expectedLossKgWeek: Math.round(((deficit * 7) / 7700) * 100) / 100, wantedDeficit: Math.round(wanted) };
}

export type Reliability = 'high' | 'medium' | 'low' | 'insufficient';
export interface ObservedTdee {
  tdee: number | null; range: [number, number] | null; reliability: Reliability; usableForPlan: boolean;
  completeDays: number; confirmedDays: number; weighIns: number; slopeKgPerWeek: number | null; reason: string;
}

/** Nachylenie trendu wagi (kg/dzień) metodą najmniejszych kwadratów: odporniejsze niż porównanie dwóch tygodni. */
export function weightSlope(weights: DatedValue[], from: LocalDate): number | null {
  if (weights.length < 2) return null;
  const xs = weights.map((w) => (Date.parse(w.date) - Date.parse(from)) / 864e5), ys = weights.map((w) => w.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den > 0 ? num / den : null;
}

/**
 * Zapotrzebowanie z Twoich danych (wstecz): średnie spożycie z KOMPLETNYCH dni − bilans z trendu wagi.
 * Liczymy tylko dni potwierdzone lub prawdopodobnie kompletne; dni niekompletne są pomijane (nie zaniżają średniej).
 * Wiarygodność:
 *  high   – ≥21 dni kompletnych (≥10 potwierdzonych), ≥16 ważeń, okno ≥28 dni,
 *  medium – ≥14 dni kompletnych (≥5 potwierdzonych), ≥10 ważeń,
 *  low    – ≥10 dni kompletnych i ≥8 ważeń (pokazujemy, ale nie używamy do planu),
 *  insufficient – mniej.
 * 7700 kcal/kg to przybliżenie dla tkanki tłuszczowej: służy do oceny przeszłości, nie do prognoz.
 */
export function observedTdee(weights: DatedValue[], days: { date: LocalDate; kcal: number; completeness: string }[], end: LocalDate, windowDays = 28): ObservedTdee {
  const from = addDays(end, -(windowDays - 1));
  const w = weights.filter((x) => x.date >= from && x.date <= end);
  const usable = days.filter((d) => d.date >= from && d.date <= end && (d.completeness === 'confirmed' || d.completeness === 'probable'));
  const confirmed = usable.filter((d) => d.completeness === 'confirmed').length;
  const slope = weightSlope(w, from);
  const base = { completeDays: usable.length, confirmedDays: confirmed, weighIns: w.length, slopeKgPerWeek: slope === null ? null : Math.round(slope * 7 * 100) / 100 };
  const reliability: Reliability =
    windowDays >= 28 && usable.length >= 21 && confirmed >= 10 && w.length >= 16 ? 'high'
    : usable.length >= 14 && confirmed >= 5 && w.length >= 10 ? 'medium'
    : usable.length >= 10 && w.length >= 8 ? 'low' : 'insufficient';
  if (reliability === 'insufficient' || slope === null) {
    return { ...base, tdee: null, range: null, reliability: 'insufficient', usableForPlan: false,
      reason: `Za mało danych: ${usable.length} kompletnych dni (potwierdzonych ${confirmed}), ${w.length} ważeń w ${windowDays} dniach.` };
  }
  const avgIntake = mean(usable.map((d) => d.kcal)).value!;
  const tdee = Math.round((avgIntake - slope * 7700) / 10) * 10;
  const err = reliability === 'high' ? 150 : reliability === 'medium' ? 250 : 400;
  return { ...base, tdee, range: [tdee - err, tdee + err], reliability, usableForPlan: reliability !== 'low',
    reason: `Śr. spożycie ${Math.round(avgIntake)} kcal z ${usable.length} kompletnych dni, trend ${(slope * 7).toFixed(2)} kg/tydz. (${w.length} ważeń). Niedoszacowanie jedzenia zawyża spadek, więc wynik może być zaniżony.` };
}
