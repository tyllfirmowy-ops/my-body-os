import { describe, expect, it } from 'vitest';
import { nextBestAction, type NbaInput } from '../src/domain/nextAction';
import type { RecommendationFeedback } from '../src/domain/types';

const base: NbaInput = { today: '2026-11-25', hour: 9, safetyLevel: 'none', alerts: [], doneToday: false, entriesToday: 0, returnMode: false, weeklyDue: false, feedback: [] };
const fb = (recId: string, action: RecommendationFeedback['action'], reason?: RecommendationFeedback['reason'], date = '2026-11-25'): RecommendationFeedback => ({ id: recId + date + action, createdAt: 1, updatedAt: 1, recId, date, action, ...(reason ? { reason } : {}) });
const rec = { id: 'protein', title: 'Więcej białka', action: 'Dodaj jajka do śniadania.' };

describe('NextBestAction', () => {
  it('alert pilny wygrywa ze wszystkim i nie da się go odłożyć', () => {
    const a = nextBestAction({ ...base, safetyLevel: 'urgent', alerts: [{ code: 'chest', level: 'urgent', title: 'Ból w klatce', text: 'Zadzwoń 112.' }], todayWorkout: { templateId: 'A' }, inProgress: { templateId: 'A' }, rec, feedback: [fb('nba_health', 'rejected')] });
    expect(a?.kind).toBe('health'); expect(a?.dismissible).toBe(false); expect(a?.importance).toBe('urgent');
  });
  it('blokada nóg przy dzisiejszym treningu przed treningiem w trakcie', () => {
    const a = nextBestAction({ ...base, alerts: [{ code: 'knee_red', level: 'stop_legs', title: 'Kolano', text: 'Obrzęk.' }], safetyLevel: 'stop_legs', todayWorkout: { templateId: 'A' }, inProgress: { templateId: 'A' } });
    expect(a?.kind).toBe('training_block'); expect(a?.dismissible).toBe(false);
  });
  it('blokada nóg bez treningu dziś nie zasłania innych działań', () => {
    const a = nextBestAction({ ...base, hour: 13, alerts: [{ code: 'knee_red', level: 'stop_legs', title: 'Kolano', text: 'Obrzęk.' }], safetyLevel: 'stop_legs' });
    expect(a?.kind).toBe('log_food');
  });
  it('trening w trakcie przed zaplanowanym treningiem i jedzeniem', () => {
    expect(nextBestAction({ ...base, hour: 15, inProgress: { templateId: 'B' }, todayWorkout: { templateId: 'B' } })?.kind).toBe('resume_workout');
  });
  it('zaplanowany trening; plan C zamienia go w regenerację', () => {
    expect(nextBestAction({ ...base, todayWorkout: { templateId: 'A' } })?.title).toBe('Dzisiaj trening A');
    expect(nextBestAction({ ...base, todayWorkout: { templateId: 'A' }, readiness: 'B' })?.title).toBe('Dzisiaj trening A w krótszej wersji');
    expect(nextBestAction({ ...base, todayWorkout: { templateId: 'A' }, readiness: 'C' })?.kind).toBe('recovery');
  });
  it('krótki sen: trening bez zwiększania obciążenia', () => {
    expect(nextBestAction({ ...base, todayWorkout: { templateId: 'A' }, sleepMinutes: 300 })?.text).toMatch(/bez zwiększania obciążenia/);
  });
  it('zrobiony trening nie jest proponowany ponownie', () => {
    expect(nextBestAction({ ...base, todayWorkout: { templateId: 'A' }, doneToday: true })?.kind).toBe('walk');
  });
  it('brak wpisów jedzenia: sugestia dopiero od 11:00, bez zakładania, że nic nie zjedzono', () => {
    expect(nextBestAction({ ...base, hour: 10 })?.kind).toBe('walk');
    const a = nextBestAction({ ...base, hour: 11 });
    expect(a?.kind).toBe('log_food'); expect(a?.text).toMatch(/nie znaczy, że nic nie było/);
    expect(nextBestAction({ ...base, hour: 14, entriesToday: 1 })?.kind).toBe('walk');
  });
  it('porada coacha po jedzeniu, przed neutralną zachętą', () => {
    expect(nextBestAction({ ...base, hour: 14, rec })?.kind).toBe('log_food');
    const a = nextBestAction({ ...base, hour: 14, entriesToday: 2, rec });
    expect(a?.kind).toBe('coach'); expect(a?.recId).toBe('protein');
  });
  it('powrót po przerwie, a po „Wracam” następne działanie (bez nadrabiania)', () => {
    const a = nextBestAction({ ...base, hour: 14, returnMode: true, todayWorkout: { templateId: 'A' } });
    expect(a?.kind).toBe('return'); expect(a?.cta?.label).toBe('Wracam');
    expect(nextBestAction({ ...base, hour: 14, returnMode: true, todayWorkout: { templateId: 'A' }, feedback: [fb('return', 'accepted')] })?.kind).toBe('start_workout');
    // porada coacha „return” nie dubluje karty powrotu
    expect(nextBestAction({ ...base, entriesToday: 1, rec: { id: 'return', title: 'x', action: 'y' } })?.kind).toBe('walk');
  });
  it('odłożona zwykła sugestia znika do końca dnia i wraca następnego', () => {
    const f = [fb('nba_log_food', 'rejected', 'not_now')];
    expect(nextBestAction({ ...base, hour: 13, feedback: f })?.kind).toBe('walk');
    expect(nextBestAction({ ...base, today: '2026-11-26', hour: 13, feedback: f })?.kind).toBe('log_food');
  });
  it('wielokrotnie odrzucana sugestia jest chowana na dłużej (pamięć odrzuceń)', () => {
    const f = ['2026-11-20', '2026-11-22', '2026-11-24'].map((dt) => fb('nba_walk', 'rejected', 'not_helpful', dt));
    expect(nextBestAction({ ...base, entriesToday: 1, feedback: f })).toBeUndefined();
  });
  it('raport tygodnia przed treningiem i jedzeniem, po treningu w trakcie', () => {
    expect(nextBestAction({ ...base, hour: 20, weeklyDue: true })?.kind).toBe('weekly_report');
    expect(nextBestAction({ ...base, hour: 20, weeklyDue: true, todayWorkout: { templateId: 'B' } })?.kind).toBe('weekly_report');
    expect(nextBestAction({ ...base, hour: 20, weeklyDue: true, inProgress: { templateId: 'B' } })?.kind).toBe('resume_workout');
  });
  it('zawsze najwyżej jedna akcja i każda ma tytuł, opis i źródło', () => {
    const a = nextBestAction({ ...base, hour: 14, rec, todayWorkout: { templateId: 'A' }, weeklyDue: true, returnMode: true });
    expect(a && a.title && a.text && a.source).toBeTruthy();
  });
});
