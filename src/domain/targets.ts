import type { LocalDate } from './dates';
import type { Nutrients, PlanRules, PlanVersion } from './types';

export const DEFAULT_RULES: Required<PlanRules> = {
  insulinResistance: { enabled: false, carbMaxPct: 45, sugarMaxPct: 10, fiberMin: 30, carbsPerMealMaxG: 80, shiftExcessToFat: false },
  dairyFree: { enabled: false },
};
export const DEFAULT_CYCLING = { enabled: false, trainingExtraKcal: 200 };

export interface DayTargets {
  kcal: number; proteinG: number; fatG: number; carbsG: number; fiberG: number;
  sugarMaxG: number | null; carbsPerMealMaxG: number | null; carbMaxG: number | null;
  dayType: 'training' | 'rest' | 'flat';
  notes: string[];
}

/** Odjęcie na dzień bez treningu tak, by budżet 14 dni = 14 × plan.kcal przy N treningach z planu. */
export function restDelta(extra: number, trainingsPer14: number): number {
  const n = Math.max(0, Math.min(13, trainingsPer14));
  return n === 0 ? 0 : -Math.round((extra * n) / (14 - n));
}

/**
 * Cele na konkretny dzień (czysta funkcja).
 * - Cykl kcal (opcja): dzień treningowy +extra z węglowodanów, dni bez treningu restDelta; budżet 14-dniowy bez zmian.
 *   Dzień ZAPLANOWANY jako treningowy zachowuje cel treningowy także, gdy trening odwołano (bez karania).
 * - Białko i tłuszcz stałe.
 * - Insulinooporność (opcja): domyślnie tylko ostrzeżenia (udział węgli, cukry, węgle na posiłek, minimum błonnika).
 *   Przeniesienie nadwyżki węgli do tłuszczu wyłącznie po świadomym włączeniu shiftExcessToFat.
 */
export function dayTargets(plan: PlanVersion, isTrainingDay: boolean): DayTargets {
  const cyc = { ...DEFAULT_CYCLING, ...plan.cycling };
  const ir = { ...DEFAULT_RULES.insulinResistance, ...plan.rules?.insulinResistance };
  const notes: string[] = [];
  let delta = 0;
  let dayType: DayTargets['dayType'] = 'flat';
  if (cyc.enabled && plan.workoutsPer14d > 0 && plan.workoutsPer14d < 14) {
    delta = isTrainingDay ? cyc.trainingExtraKcal : restDelta(cyc.trainingExtraKcal, plan.workoutsPer14d);
    dayType = isTrainingDay ? 'training' : 'rest';
    notes.push(isTrainingDay ? `Dzień treningowy: +${delta} kcal z węglowodanów.` : `Dzień bez treningu: ${delta} kcal (budżet 14 dni bez zmian).`);
  }
  const kcal = Math.round(plan.kcal + delta);
  // węglowodany z planu (szanuje ręczną edycję) ± różnica cyklu przeliczona na węgle
  let carbsG = Math.max(0, plan.carbsG + Math.round(delta / 4));
  let fatG = plan.fatG;
  let carbMaxG: number | null = null;
  if (ir.enabled) {
    carbMaxG = Math.floor((kcal * ir.carbMaxPct) / 100 / 4);
    if (carbsG > carbMaxG) {
      if (ir.shiftExcessToFat) {
        fatG = Math.round(fatG + ((carbsG - carbMaxG) * 4) / 9);
        notes.push(`Ustawienie indywidualne: węglowodany ograniczone do ${ir.carbMaxPct}% kcal, nadwyżka w tłuszczu.`);
        carbsG = carbMaxG;
      } else {
        notes.push(`Węglowodany to ${Math.round((carbsG * 400) / kcal)}% kcal (próg informacyjny ${ir.carbMaxPct}%). Plan bez zmian; wybieraj produkty pełnoziarniste i rozkładaj węgle na posiłki.`);
      }
    }
  }
  const fiberG = Math.max(plan.fiberG[0], ir.enabled ? ir.fiberMin : 0);
  return {
    kcal, proteinG: plan.proteinG, fatG, carbsG, fiberG, carbMaxG,
    sugarMaxG: ir.enabled ? Math.round((kcal * ir.sugarMaxPct) / 100 / 4) : null,
    carbsPerMealMaxG: ir.enabled ? ir.carbsPerMealMaxG : null,
    dayType, notes,
  };
}

/** Wersja planu obowiązująca danego dnia (historia: późniejsze zmiany nie nadpisują przeszłości). */
export function planOn(plans: PlanVersion[], date: LocalDate): PlanVersion | undefined {
  const sorted = [...plans].sort((a, b) => a.validFrom.localeCompare(b.validFrom) || a.createdAt - b.createdAt);
  let cur: PlanVersion | undefined;
  for (const p of sorted) if (p.validFrom <= date) cur = p;
  return cur ?? sorted[0];
}

/** Ostrzeżenia dla dnia wg reguł (informacyjne, nie blokują). */
export function ruleWarnings(t: DayTargets, day: Nutrients, mealCarbs: number[]): string[] {
  const w: string[] = [];
  if (t.sugarMaxG !== null && day.sugar !== undefined && day.sugar > t.sugarMaxG) w.push(`Cukry ${Math.round(day.sugar)} g > ${t.sugarMaxG} g (limit informacyjny).`);
  if (t.carbsPerMealMaxG !== null) mealCarbs.forEach((c, i) => { if (c > t.carbsPerMealMaxG!) w.push(`Posiłek ${i + 1}: ${Math.round(c)} g węglowodanów (> ${t.carbsPerMealMaxG} g). Rozłóż je na dwa posiłki albo dodaj białko i warzywa.`); });
  return w;
}
