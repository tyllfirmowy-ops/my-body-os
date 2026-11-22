import { addDays, diffDays, type LocalDate } from './dates';
import type { RecommendationFeedback, RejectReason } from './types';

export const REASON_LABEL: Record<RejectReason, string> = {
  not_now: 'Nie teraz', no_time: 'Brak czasu', not_helpful: 'Nie pomaga mi', not_fit: 'Nie pasuje do mojej sytuacji', health: 'Problem zdrowotny', other: 'Inny powód',
};
/** Na ile dni ukryć poradę po odrzuceniu (dzień odrzucenia = 0, czyli „do końca dnia”). */
export const HIDE_DAYS: Record<RejectReason, number> = { not_now: 0, no_time: 3, not_helpful: 14, not_fit: 30, health: 14, other: 7 };
const REPEAT_WINDOW = 30, REPEAT_COUNT = 3, REPEAT_HIDE = 30;

export interface Suppression { hidden: boolean; until?: LocalDate; reason?: RejectReason; rejections: number }

/**
 * Czy pokazać poradę: uwzględnia ostatnią reakcję i powtarzane odrzucenia.
 * Porady zdrowotne (health) chowają się najwyżej do końca dnia. Ostrzeżenia bezpieczeństwa nie przechodzą przez tę funkcję.
 */
export function suppression(recId: string, fb: RecommendationFeedback[], today: LocalDate, opts: { health?: boolean } = {}): Suppression {
  const own = fb.filter((f) => f.recId === recId && f.date <= today).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const resetIdx = own.map((f) => f.action).lastIndexOf('reset');
  const active = own.slice(resetIdx + 1);
  const last = active[active.length - 1];
  const rejects = active.filter((f) => f.action === 'rejected' && (f.reason ?? 'not_now') !== 'not_now' && diffDays(f.date, today) <= REPEAT_WINDOW);
  if (!last) return { hidden: false, rejections: 0 };
  if (last.action === 'accepted') return { hidden: last.date === today, until: last.date, rejections: rejects.length };
  const reason = last.reason ?? 'not_now';
  let days = opts.health ? 0 : HIDE_DAYS[reason];
  if (!opts.health && rejects.length >= REPEAT_COUNT) days = Math.max(days, REPEAT_HIDE);
  const until = addDays(last.date, days);
  return { hidden: today <= until, until, reason, rejections: rejects.length };
}

/** Pierwsza porada, której użytkownik nie ukrył. */
export function pickRecommendation<T extends { id: string; health?: boolean }>(recs: T[], fb: RecommendationFeedback[], today: LocalDate): { rec?: T; hidden: { rec: T; s: Suppression }[] } {
  const hidden: { rec: T; s: Suppression }[] = [];
  let rec: T | undefined;
  for (const r of recs) {
    const s = suppression(r.id, fb, today, { health: r.health });
    if (s.hidden) { if (s.reason) hidden.push({ rec: r, s }); } else if (!rec) rec = r;
  }
  return { rec, hidden };
}

/** Podsumowanie feedbacku (np. do raportu): ile razy i z jakiego powodu odrzucano porady. */
export function feedbackSummary(fb: RecommendationFeedback[], since: LocalDate) {
  const out: Record<string, { accepted: number; rejected: Partial<Record<RejectReason, number>> }> = {};
  for (const f of fb) {
    if (f.date < since || f.action === 'reset') continue;
    const o = (out[f.recId] ??= { accepted: 0, rejected: {} });
    if (f.action === 'accepted') o.accepted++;
    else { const r = f.reason ?? 'not_now'; o.rejected[r] = (o.rejected[r] ?? 0) + 1; }
  }
  return out;
}
