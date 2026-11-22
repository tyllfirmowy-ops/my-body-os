import { describe, expect, it } from 'vitest';
import { weeklyReview } from '../src/domain/weeklyReview';
import { COOLDOWN, WARMUP } from '../src/data/warmup';

const S = (id: string, date: string) => ({ id, date, status: 'completed' });
const set = (sessionId: string, exerciseId: string, weightKg: number, reps: number) => ({ sessionId, exerciseId, weightKg, reps, done: true });

describe('Podsumowanie tygodnia', () => {
  // 2026-11-23 poniedziałek
  const sessions = [S('p', '2026-11-18'), S('c', '2026-11-24')];
  it('lepsza najlepsza seria niż tydzień temu: więcej powtórzeń albo większy ciężar', () => {
    const r = weeklyReview(sessions, [set('p', 'a', 40, 10), set('c', 'a', 40, 12), set('p', 'b', 20, 12), set('c', 'b', 22, 8), set('p', 'x', 10, 10), set('c', 'x', 10, 10)], '2026-11-26');
    expect(r.done).toBe(1); expect(r.prevDone).toBe(1); expect(r.compared).toBe(3);
    expect(r.improved.map((x) => x.exerciseId)).toEqual(['a', 'b']);
  });
  it('ćwiczenie bez danych z poprzedniego tygodnia nie jest porównywane (brak danych ≠ spadek)', () => {
    const r = weeklyReview(sessions, [set('c', 'a', 40, 12)], '2026-11-26');
    expect(r.compared).toBe(0); expect(r.improved).toEqual([]);
  });
  it('trening porzucony się nie liczy', () => {
    const r = weeklyReview([...sessions, { id: 'z', date: '2026-11-25', status: 'abandoned' }], [set('z', 'a', 99, 9)], '2026-11-26');
    expect(r.done).toBe(1); expect(r.improved).toEqual([]);
  });
});

describe('Rozgrzewka i rozciąganie', () => {
  it('bez przysiadów, wykroków i skoków (oszczędnie dla kolana); każde ma dawkę i czucie', () => {
    for (const it of [...WARMUP, ...COOLDOWN]) {
      expect(it.name + it.steps.join(' ')).not.toMatch(/przysiad|wykrok|skok|pajac/i);
      expect(it.dose.length).toBeGreaterThan(0); expect(it.focus.length).toBeGreaterThan(10);
    }
    expect(new Set([...WARMUP, ...COOLDOWN].map((x) => x.id)).size).toBe(WARMUP.length + COOLDOWN.length);
  });
});
