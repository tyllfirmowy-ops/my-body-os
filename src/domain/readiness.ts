import type { MorningCheckIn } from './types';
import type { SafetyLevel } from './safety';

export type PlanLevel = 'A' | 'B' | 'C';
export interface Readiness { level: PlanLevel; reasons: string[]; missing: string[] }

/**
 * Transparentne reguły A/B/C. Brak danych nie obniża poziomu (oznaczany jako "brak danych").
 * Uwaga: przewlekły stres 8–9/10 jest punktem wyjścia, dlatego sam stres przełącza na B dopiero od 9.
 */
export function evaluateReadiness(c: Partial<MorningCheckIn> | undefined, safety: SafetyLevel): Readiness {
  const missing: string[] = [];
  if (!c) return { level: 'A', reasons: ['Brak check-inu: domyślny plan A'], missing: ['check-in'] };
  if (c.sleepMinutes === undefined) missing.push('sen');
  if (c.energy === undefined) missing.push('energia');
  if (c.stress === undefined) missing.push('stres');

  const C: string[] = [];
  const B: string[] = [];
  if (safety === 'urgent') C.push('objaw alarmowy');
  if (c.symptoms?.includes('illness')) C.push('infekcja / choroba');
  if (c.energy === 1) C.push('energia 1/5');
  if (c.sleepMinutes !== undefined && c.sleepMinutes < 270) C.push(`sen ${(c.sleepMinutes / 60).toFixed(1)} h`);
  if (c.stress !== undefined && c.stress >= 10) C.push('stres 10/10');
  if (c.availability === 'none') C.push('brak czasu');
  if (c.sleepQuality === 1 && (c.energy ?? 5) <= 2) C.push('bardzo zły sen i niska energia');

  if (c.sleepMinutes !== undefined && c.sleepMinutes >= 270 && c.sleepMinutes < 360) B.push(`krótki sen (${(c.sleepMinutes / 60).toFixed(1)} h)`);
  if (c.sleepQuality !== undefined && c.sleepQuality <= 2) B.push(`jakość snu ${c.sleepQuality}/5`);
  if (c.energy === 2) B.push('energia 2/5');
  if (c.stress === 9) B.push('stres 9/10');
  if (c.availability === 'limited') B.push('mało czasu');

  if (C.length) return { level: 'C', reasons: C, missing };
  if (B.length) return { level: 'B', reasons: B, missing };
  return { level: 'A', reasons: ['brak przesłanek do zmiany planu'], missing };
}

export const PLAN_COPY: Record<PlanLevel, { title: string; actions: string[] }> = {
  A: { title: 'Plan A: normalny dzień', actions: ['Standardowy cel kalorii i 4 posiłki', 'Trening, jeśli przypada', 'Standardowy cel kroków'] },
  B: { title: 'Plan B: ciężki dzień', actions: ['Te same kalorie, proste przygotowane posiłki', 'Trening skrócony (2 serie, bez ostatnich ćwiczeń), jeśli bezpieczny', 'Spokojny spacer opcjonalnie', 'Wcześniej do łóżka'] },
  C: { title: 'Plan C: dzień kryzysowy', actions: ['Odpoczynek, bez obowiązku treningu', 'Regularne, proste posiłki (bez głodówki)', 'Woda', 'Jutro wracasz do zwykłego planu'] },
};
