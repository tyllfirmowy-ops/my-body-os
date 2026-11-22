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
export const PACE_DEFICIT: Record<Pace, number> = { gentle: 0.15, standard: 0.2 };

/** Plan z TDEE: deficyt 15–20%, białko 1,7 g/kg masy docelowej, tłuszcz ~28% kcal, reszta węglowodany. */
export function planFromTdee(tdee: number, goalKg: number, pace: Pace, floor = 2100) {
  const kcal = Math.max(floor, Math.round((tdee * (1 - PACE_DEFICIT[pace])) / 50) * 50);
  const proteinG = Math.round((goalKg * 1.7) / 5) * 5;
  const fatG = Math.round((kcal * 0.28) / 9 / 5) * 5;
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const deficit = tdee - kcal;
  return { kcal, proteinG, fatG, carbsG, deficit, expectedLossKgWeek: Math.round(((deficit * 7) / 7700) * 100) / 100 };
}

/**
 * Zapotrzebowanie wyliczone z Twoich danych (wstecz): średnie spożycie + bilans ze zmiany trendu wagi.
 * Wymaga ≥21 dni, ≥14 dni z kompletnym dziennikiem i ≥4 ważeń w pierwszym i ostatnim tygodniu.
 * 7700 kcal/kg to przybliżenie dla tkanki tłuszczowej; służy do oceny przeszłości, nie do prognoz.
 */
export function observedTdee(weights: DatedValue[], intake: { date: LocalDate; kcal: number }[], end: LocalDate, days = 28) {
  const from = addDays(end, -(days - 1));
  const first = weights.filter((w) => w.date >= from && w.date <= addDays(from, 6));
  const last = weights.filter((w) => w.date > addDays(end, -7) && w.date <= end);
  const eaten = intake.filter((d) => d.date >= from && d.date <= end);
  if (days < 21 || first.length < 4 || last.length < 4 || eaten.length < 14) {
    return { tdee: null as number | null, reason: `Za mało danych (ważenia: ${first.length}+${last.length}, dni z dziennikiem: ${eaten.length}/${days}).` };
  }
  const change = mean(last.map((w) => w.value)).value! - mean(first.map((w) => w.value)).value!;
  const avgIntake = mean(eaten.map((d) => d.kcal)).value!;
  const tdee = Math.round(avgIntake - (change * 7700) / (days - 7));
  return { tdee, reason: `Śr. spożycie ${Math.round(avgIntake)} kcal, zmiana trendu ${change.toFixed(2)} kg w ${days - 7} dni.` };
}
