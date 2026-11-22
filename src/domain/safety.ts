import type { MorningCheckIn, SymptomFlag } from './types';

export type SafetyLevel = 'urgent' | 'stop_legs' | 'caution_legs' | 'none';
export interface SafetyAlert { code: string; level: SafetyLevel; title: string; text: string }

const URGENT: SymptomFlag[] = ['chest_pain', 'fainting', 'severe_dyspnea'];
const KNEE_RED: SymptomFlag[] = ['knee_swelling', 'knee_locking', 'knee_instability', 'cannot_bear_weight', 'knee_worse_after_exercise', 'new_sharp_pain'];

export const SYMPTOM_LABELS: Record<SymptomFlag, string> = {
  chest_pain: 'Ból w klatce piersiowej',
  fainting: 'Omdlenie / prawie omdlenie',
  severe_dyspnea: 'Nagła, ciężka duszność',
  knee_swelling: 'Obrzęk kolana',
  knee_locking: 'Blokowanie kolana',
  knee_instability: 'Uciekanie / niestabilność kolana',
  cannot_bear_weight: 'Nie mogę normalnie obciążyć nogi',
  knee_worse_after_exercise: 'Kolano gorzej po ostatnim treningu',
  new_sharp_pain: 'Nowy, silny ból',
  illness: 'Infekcja / gorączka / choroba',
  drowsy_driving: 'Senność za kierownicą',
};

/** Blokady bezpieczeństwa: mają pierwszeństwo przed planem A/B/C. Czysta funkcja, bez AI. */
export function evaluateSafety(c: Partial<MorningCheckIn> | undefined, kneeCleared: boolean): { level: SafetyLevel; alerts: SafetyAlert[] } {
  const alerts: SafetyAlert[] = [];
  const s = c?.symptoms ?? [];
  if (s.some((x) => URGENT.includes(x))) {
    alerts.push({
      code: 'urgent', level: 'urgent', title: 'Objaw alarmowy',
      text: 'Nie trenuj. Przy bólu w klatce piersiowej, omdleniu lub nagłej ciężkiej duszności wezwij pomoc: 112. Jeśli objaw minął, skontaktuj się dziś z lekarzem.',
    });
  }
  const red = s.filter((x) => KNEE_RED.includes(x));
  if (red.length || (c?.kneePain ?? 0) >= 6) {
    alerts.push({
      code: 'knee_stop', level: 'stop_legs', title: 'Przerwij obciążanie kolana',
      text: red.includes('cannot_bear_weight') || red.includes('knee_locking') || red.includes('knee_swelling')
        ? 'Obrzęk, blokowanie lub brak możliwości obciążenia nogi wymagają szybkiej konsultacji (lekarz, ortopeda lub fizjoterapeuta). Dziś bez ćwiczeń na nogi.'
        : 'Dziś bez ćwiczeń obciążających kolano. Jeśli objaw utrzyma się 2–3 dni lub narasta, umów konsultację ortopedyczną lub fizjoterapeutyczną.',
    });
  } else if ((c?.kneePain ?? 0) >= 3) {
    alerts.push({
      code: 'knee_caution', level: 'caution_legs', title: 'Kolano: ostrożnie',
      text: 'Pomiń wstawanie na ławkę. Pozostałe ćwiczenia nóg tylko, jeśli ból w trakcie nie przekracza 3/10 i nie rośnie następnego dnia.',
    });
  }
  if (s.includes('drowsy_driving')) {
    alerts.push({ code: 'drowsy', level: 'none', title: 'Senność za kierownicą', text: 'Jeśli czujesz senność w trakcie jazdy, zatrzymaj się w bezpiecznym miejscu i odpocznij. Zgłoś to lekarzowi, to ważny objaw.' });
  }
  if (!kneeCleared && !alerts.some((a) => a.level === 'stop_legs')) {
    alerts.push({ code: 'knee_not_cleared', level: 'none', title: 'Kolano bez oceny specjalisty', text: 'Do czasu oceny fizjoterapeuty lub ortopedy plan nóg zostaje w wersji ostrożnej (bez przysiadów, wykroków i skoków).' });
  }
  const order: SafetyLevel[] = ['urgent', 'stop_legs', 'caution_legs', 'none'];
  const level = order.find((l) => alerts.some((a) => a.level === l)) ?? 'none';
  return { level, alerts };
}
