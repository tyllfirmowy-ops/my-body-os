import type { Nutrients, PlanRules, PlanVersion } from './types';

export const DEFAULT_RULES: Required<PlanRules> = {
  insulinResistance: { enabled: false, carbMaxPct: 45, sugarMaxPct: 10, fiberMin: 30, carbsPerMealMaxG: 80 },
  dairyFree: { enabled: false },
};
export const DEFAULT_CYCLING = { enabled: false, trainingExtraKcal: 200 };

export interface DayTargets {
  kcal: number; proteinG: number; fatG: number; carbsG: number; fiberG: number;
  sugarMaxG: number | null; carbsPerMealMaxG: number | null;
  dayType: 'training' | 'rest' | 'flat';
  notes: string[];
}

/**
 * Cele na konkretny dzień. Zasady:
 * - Średnia tygodniowa kalorii = plan.kcal (cykl tylko przesuwa kalorie między dniami, nie zmienia deficytu).
 * - Białko stałe każdego dnia; różnica idzie w węglowodany (paliwo do treningu), tłuszcz bez zmian.
 * - Insulinooporność: górny limit udziału węglowodanów, informacyjny limit cukrów, minimum błonnika, porcja węgli na posiłek.
 * Czysta funkcja: testowalna, bez AI.
 */
export function dayTargets(plan: PlanVersion, isTraining: boolean): DayTargets {
  const cyc = plan.cycling ?? DEFAULT_CYCLING;
  const ir = { ...DEFAULT_RULES.insulinResistance, ...plan.rules?.insulinResistance };
  const notes: string[] = [];
  const perWeekTraining = Math.min(7, plan.workoutsPer14d / 2);
  const restDays = 7 - perWeekTraining;
  let delta = 0;
  let dayType: DayTargets['dayType'] = 'flat';
  if (cyc.enabled && perWeekTraining > 0 && restDays > 0) {
    delta = isTraining ? cyc.trainingExtraKcal : -Math.round((cyc.trainingExtraKcal * perWeekTraining) / restDays);
    dayType = isTraining ? 'training' : 'rest';
    notes.push(isTraining ? `Dzień treningowy: +${delta} kcal z węglowodanów.` : `Dzień bez treningu: ${delta} kcal (średnia tygodnia bez zmian).`);
  }
  const kcal = Math.round(plan.kcal + delta);
  let carbsG = Math.max(0, Math.round((kcal - plan.proteinG * 4 - plan.fatG * 9) / 4));
  let fatG = plan.fatG;
  if (ir.enabled) {
    const maxCarbs = Math.floor((kcal * ir.carbMaxPct) / 100 / 4);
    if (carbsG > maxCarbs) {
      fatG = Math.round(fatG + ((carbsG - maxCarbs) * 4) / 9);
      carbsG = maxCarbs;
      notes.push(`Insulinooporność: węglowodany ≤ ${ir.carbMaxPct}% kcal, nadwyżka przeniesiona do tłuszczu.`);
    }
  }
  const fiberG = Math.max(plan.fiberG[0], ir.enabled ? ir.fiberMin : 0);
  return {
    kcal, proteinG: plan.proteinG, fatG, carbsG, fiberG,
    sugarMaxG: ir.enabled ? Math.round((kcal * ir.sugarMaxPct) / 100 / 4) : null,
    carbsPerMealMaxG: ir.enabled ? ir.carbsPerMealMaxG : null,
    dayType, notes,
  };
}

/** Ostrzeżenia dla posiłku/dnia wg reguł (do wyświetlenia, nie blokują). */
export function ruleWarnings(t: DayTargets, day: Nutrients, mealCarbs: number[]): string[] {
  const w: string[] = [];
  if (t.sugarMaxG !== null && day.sugar !== undefined && day.sugar > t.sugarMaxG) w.push(`Cukry ${Math.round(day.sugar)} g > ${t.sugarMaxG} g (limit informacyjny).`);
  if (t.carbsPerMealMaxG !== null) mealCarbs.forEach((c, i) => { if (c > t.carbsPerMealMaxG!) w.push(`Posiłek ${i + 1}: ${Math.round(c)} g węglowodanów (> ${t.carbsPerMealMaxG} g). Rozłóż je na dwa posiłki albo dodaj białko i warzywa.`); });
  return w;
}
