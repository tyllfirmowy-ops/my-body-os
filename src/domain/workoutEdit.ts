import type { PlanItem, WorkoutTemplateRec } from './types';

export type Slot = 'A' | 'B';
export interface LibExercise { id: string; knee: 'none' | 'low' | 'moderate'; namePl?: string }
export interface EffectivePlan { id: string; slot: Slot; name: string; items: PlanItem[]; edited: boolean; custom: boolean }

export const LIMITS = { sets: [1, 6], reps: [1, 30], rest: [30, 300], exercises: [1, 12] } as const;

/** Plan obowiązujący dla slotu: aktywny wariant → edytowany A/B → domyślny z kodu. */
export function effectivePlan(slot: Slot, defaults: Record<Slot, PlanItem[]>, recs: WorkoutTemplateRec[], active?: { A?: string; B?: string }): EffectivePlan {
  const act = active?.[slot] ? recs.find((r) => r.id === active[slot] && r.slot === slot) : undefined;
  if (act) return { id: act.id, slot, name: act.name, items: act.items, edited: true, custom: act.id !== slot };
  const ed = recs.find((r) => r.id === slot);
  return ed ? { id: slot, slot, name: ed.name, items: ed.items, edited: true, custom: false } : { id: slot, slot, name: `Trening ${slot}`, items: defaults[slot], edited: false, custom: false };
}

export function variantsFor(slot: Slot, defaults: Record<Slot, PlanItem[]>, recs: WorkoutTemplateRec[]): EffectivePlan[] {
  const base = effectivePlan(slot, defaults, recs);
  const custom = recs.filter((r) => r.slot === slot && r.id !== slot).sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => ({ id: r.id, slot, name: r.name, items: r.items, edited: true, custom: true }));
  return [base, ...custom];
}

/** Plan sesji: snapshot zapisany przy starcie; starsze sesje (bez snapshotu) → plan domyślny. */
export function sessionPlan(s: { templateId: Slot; plan?: PlanItem[] }, defaults: Record<Slot, PlanItem[]>): PlanItem[] {
  return s.plan?.length ? s.plan : defaults[s.templateId];
}

/**
 * Walidacja planu. Zdrowie ma pierwszeństwo: bez oceny kolana nie można dodać ćwiczenia mocno obciążającego kolano,
 * którego nie było w planie domyślnym (w trakcie treningu i tak działają blokady z safety).
 */
export function validatePlan(name: string, items: PlanItem[], lib: (id: string) => LibExercise | undefined, ctx: { kneeCleared: boolean; defaultIds: string[] }): string[] {
  const e: string[] = [];
  if (!name.trim()) e.push('Podaj nazwę planu.');
  if (items.length < LIMITS.exercises[0]) e.push('Plan musi mieć co najmniej jedno ćwiczenie.');
  if (items.length > LIMITS.exercises[1]) e.push(`Maksymalnie ${LIMITS.exercises[1]} ćwiczeń.`);
  const seen = new Set<string>();
  for (const it of items) {
    const ex = lib(it.exerciseId);
    const n = ex?.namePl ?? it.exerciseId;
    if (!ex) { e.push(`Nieznane ćwiczenie: ${it.exerciseId}.`); continue; }
    if (seen.has(it.exerciseId)) e.push(`${n}: ćwiczenie powtórzone w planie.`);
    seen.add(it.exerciseId);
    if (!Number.isInteger(it.sets) || it.sets < LIMITS.sets[0] || it.sets > LIMITS.sets[1]) e.push(`${n}: serie 1–6.`);
    if (!(it.repMin >= LIMITS.reps[0] && it.repMax <= LIMITS.reps[1] && it.repMin <= it.repMax)) e.push(`${n}: powtórzenia 1–30, minimum ≤ maksimum.`);
    if (!(it.restSec >= LIMITS.rest[0] && it.restSec <= LIMITS.rest[1])) e.push(`${n}: przerwa 30–300 s.`);
    if (!ctx.kneeCleared && ex.knee === 'moderate' && !ctx.defaultIds.includes(it.exerciseId)) e.push(`${n}: mocno obciąża kolano. Najpierw ocena kolana przez specjalistę.`);
  }
  return e;
}

export function moveItem<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a;
}

export const newItem = (exerciseId: string): PlanItem => ({ exerciseId, sets: 2, repMin: 10, repMax: 12, restSec: 90 });
