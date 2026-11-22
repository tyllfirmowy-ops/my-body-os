import { describe, expect, it } from 'vitest';
import { suppression, pickRecommendation, feedbackSummary, HIDE_DAYS } from '../src/domain/feedback';
import { coach, type DaySnapshot } from '../src/domain/coaching';
import { addDays } from '../src/domain/dates';
import type { RecommendationFeedback, RejectReason } from '../src/domain/types';

let n = 0;
const fb = (recId: string, date: string, action: RecommendationFeedback['action'], reason?: RejectReason): RecommendationFeedback =>
  ({ id: String(n), createdAt: n++, updatedAt: 0, recId, date, action, ...(reason ? { reason } : {}) });

describe('3D feedback coacha', () => {
  it('każdy powód ukrywa poradę na inny czas', () => {
    for (const [reason, days] of Object.entries(HIDE_DAYS) as [RejectReason, number][]) {
      const h = [fb('protein', '2026-11-10', 'rejected', reason)];
      expect(suppression('protein', h, '2026-11-10').hidden).toBe(true);
      expect(suppression('protein', h, addDays('2026-11-10', days)).hidden).toBe(true);
      expect(suppression('protein', h, addDays('2026-11-10', days + 1)).hidden).toBe(false);
    }
  });
  it('stare odrzucenie bez powodu = „nie teraz” (tylko dziś)', () => {
    const h = [fb('protein', '2026-11-10', 'rejected')];
    expect(suppression('protein', h, '2026-11-10').hidden).toBe(true);
    expect(suppression('protein', h, '2026-11-11').hidden).toBe(false);
  });
  it('powtarzane odrzucenia wydłużają ukrycie do 30 dni', () => {
    const h = [fb('sleep_regular', '2026-11-01', 'rejected', 'no_time'), fb('sleep_regular', '2026-11-05', 'rejected', 'no_time'), fb('sleep_regular', '2026-11-09', 'rejected', 'no_time')];
    const s = suppression('sleep_regular', h, '2026-11-20');
    expect(s.hidden).toBe(true);
    expect(s.until).toBe('2026-12-09');
    expect(s.rejections).toBe(3);
  });
  it('„nie teraz” nie liczy się do powtórzeń', () => {
    const h = ['01', '02', '03', '04'].map((d) => fb('protein', `2026-11-${d}`, 'rejected', 'not_now'));
    expect(suppression('protein', h, '2026-11-05').hidden).toBe(false);
  });
  it('przywrócenie (reset) kasuje wcześniejsze odrzucenia', () => {
    const h = [fb('protein', '2026-11-01', 'rejected', 'not_fit'), fb('protein', '2026-11-03', 'reset')];
    expect(suppression('protein', h, '2026-11-03').hidden).toBe(false);
  });
  it('porada zdrowotna chowa się najwyżej do końca dnia, nawet przy wielu odrzuceniach', () => {
    const h = ['01', '02', '03'].map((d) => fb('missed_workouts', `2026-11-${d}`, 'rejected', 'not_fit'));
    expect(suppression('missed_workouts', h, '2026-11-03', { health: true }).hidden).toBe(true);
    expect(suppression('missed_workouts', h, '2026-11-04', { health: true }).hidden).toBe(false);
  });
  it('wybór porady pomija ukryte i pokazuje następną; ukryte są listowane', () => {
    const recs = [{ id: 'a', priority: 2 }, { id: 'b', priority: 1 }];
    const r = pickRecommendation(recs, [fb('a', '2026-11-10', 'rejected', 'not_helpful')], '2026-11-12');
    expect(r.rec?.id).toBe('b');
    expect(r.hidden.map((h) => h.rec.id)).toEqual(['a']);
  });
  it('coaching oznacza poradę o bólu jako zdrowotną', () => {
    const days: DaySnapshot[] = ['2026-11-15', '2026-11-17'].map((date) => ({ date, workoutPlanned: true, workoutDone: false, withDaughter: false, evening: { date, workoutMissReason: 'pain', createdAt: 0, updatedAt: 0 } as never }));
    const rec = coach(days, '2026-11-20', 2400).find((r) => r.id === 'missed_workouts');
    expect(rec?.health).toBe(true);
  });
  it('podsumowanie feedbacku', () => {
    const s = feedbackSummary([fb('a', '2026-11-10', 'accepted'), fb('a', '2026-11-11', 'rejected', 'no_time'), fb('a', '2026-11-12', 'rejected'), fb('a', '2026-11-12', 'reset')], '2026-11-01');
    expect(s.a).toEqual({ accepted: 1, rejected: { no_time: 1, not_now: 1 } });
  });
});
