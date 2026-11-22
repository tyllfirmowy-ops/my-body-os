import { macroKcal } from './calc';
import { KCAL_FLOOR } from './adaptation';

export interface PlanEditInput { kcal: number; proteinG: number; fatG: number; carbsG: number; reason: string; specialistApproved: boolean }
export interface PlanEditContext { weightKg: number; goalKg: number; tdee: number | null; daysSinceLastChange: number | null }
export interface PlanEditCheck { errors: string[]; warnings: string[]; macroKcal: number; deficitPct: number | null; canSave: boolean }

/**
 * Walidacja ręcznej zmiany planu (czysta funkcja).
 * Błędy blokują zapis; ostrzeżenia wymagają tylko świadomego zatwierdzenia.
 */
export function validatePlanEdit(i: PlanEditInput, c: PlanEditContext): PlanEditCheck {
  const errors: string[] = []; const warnings: string[] = [];
  const mk = macroKcal(i.proteinG, i.fatG, i.carbsG);
  if (![i.kcal, i.proteinG, i.fatG, i.carbsG].every((v) => Number.isFinite(v) && v >= 0)) errors.push('Wszystkie wartości muszą być liczbami ≥ 0.');
  if (i.kcal < 1200 || i.kcal > 5000) errors.push('Kalorie poza zakresem 1200–5000 kcal.');
  if (Math.abs(mk - i.kcal) > Math.max(50, i.kcal * 0.03)) errors.push(`Makro daje ${Math.round(mk)} kcal, a cel to ${i.kcal} kcal (różnica > 3%). Użyj „Dopasuj węglowodany”.`);
  if (i.kcal < KCAL_FLOOR && !i.specialistApproved) errors.push(`Poniżej ${KCAL_FLOOR} kcal tylko po konsultacji ze specjalistą (zaznacz potwierdzenie).`);
  if (!i.reason.trim()) errors.push('Podaj powód zmiany (zapisze się w historii planu).');
  const pPerKg = i.proteinG / Math.max(1, c.goalKg);
  if (pPerKg < 1.2) warnings.push(`Białko ${pPerKg.toFixed(1)} g/kg masy docelowej: na redukcji z treningiem zwykle zaleca się więcej (ok. 1,6–2,2).`);
  if (pPerKg > 2.6) warnings.push(`Białko ${pPerKg.toFixed(1)} g/kg masy docelowej: więcej niż potrzeba, kosztem innych makro.`);
  if (i.fatG < c.weightKg * 0.5 || i.fatG * 9 < i.kcal * 0.2) warnings.push('Tłuszcz poniżej ~20% kcal lub 0,5 g/kg: zbyt mało na dłuższą metę.');
  let deficitPct: number | null = null;
  if (c.tdee) {
    deficitPct = Math.round(((c.tdee - i.kcal) / c.tdee) * 100);
    if (deficitPct > 25) warnings.push(`Deficyt ~${deficitPct}% szacowanego TDEE: agresywny, rośnie ryzyko spadku siły i głodu.`);
    if (deficitPct < 5) warnings.push(`Deficyt ~${deficitPct}%: redukcja będzie bardzo wolna albo żadna.`);
  }
  if (c.daysSinceLastChange !== null && c.daysSinceLastChange < 14) warnings.push(`Poprzednia zmiana ${c.daysSinceLastChange} dni temu: nowa przerwie 14-dniową obserwację efektu.`);
  return { errors, warnings, macroKcal: Math.round(mk), deficitPct, canSave: errors.length === 0 };
}

/** Węglowodany dobrane tak, by makro dało dokładnie zadane kcal. */
export function fillCarbs(kcal: number, proteinG: number, fatG: number): number {
  return Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
}
