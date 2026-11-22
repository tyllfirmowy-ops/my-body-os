import { describe, expect, it } from 'vitest';
import { activeCheckin, checkinEffects, reminderIcs, reportDue, type WeeklyCheckin } from '../src/domain/weeklyCheckin';
import { planWeekly } from '../src/domain/schedule';

const at = (d: string, h: number, m = 0) => { const [y, mo, da] = d.split('-').map(Number); return new Date(y, mo - 1, da, h, m); };
const ck = (weekStart: string, over: Partial<WeeklyCheckin> = {}): WeeklyCheckin => ({ id: weekStart, weekStart, mood: 4, diet: 'ok', hunger: false, changes: [], createdAt: 0, updatedAt: 0, ...over });

describe('Przypomnienie o raporcie tygodnia', () => {
  // 2026-11-16 pon – 2026-11-22 nd
  it('niedziela przed 20:00: nic; od 20:00: raport za kończący się tydzień', () => {
    expect(reportDue(at('2026-11-22', 19, 59), [ck('2026-11-09')]).show).toBe(false);
    expect(reportDue(at('2026-11-22', 20, 0), [ck('2026-11-09')])).toEqual({ weekStart: '2026-11-16', show: true });
  });
  it('poniedziałek: przed 12:00 nic, od 12:00 przypomnienie za poprzedni tydzień', () => {
    expect(reportDue(at('2026-11-23', 11, 59), []).show).toBe(false);
    expect(reportDue(at('2026-11-23', 12, 0), [])).toEqual({ weekStart: '2026-11-16', show: true });
  });
  it('raz dziennie: odłożone dziś wraca jutro po 12:00; wypełnione nie wraca', () => {
    expect(reportDue(at('2026-11-24', 15), [], { snoozedOn: '2026-11-24' }).show).toBe(false);
    expect(reportDue(at('2026-11-25', 12, 30), [], { snoozedOn: '2026-11-24' }).show).toBe(true);
    expect(reportDue(at('2026-11-25', 12, 30), [ck('2026-11-16')]).show).toBe(false);
  });
  it('niewypełniony raport przypomina codziennie aż do kolejnej niedzieli 20:00', () => {
    expect(reportDue(at('2026-11-29', 19, 0), [])).toEqual({ weekStart: '2026-11-16', show: true });
  });
  it('kolejna niedziela 20:00 przechodzi na nowy tydzień', () => {
    expect(reportDue(at('2026-11-29', 20, 30), [ck('2026-11-16')])).toEqual({ weekStart: '2026-11-23', show: true });
  });
  it('nowy użytkownik nie dostaje raportu za tydzień sprzed założenia konta', () => {
    expect(reportDue(at('2026-11-23', 13), [], { startedOn: '2026-11-23' }).show).toBe(false);
    expect(reportDue(at('2026-11-22', 21), [], { startedOn: '2026-11-20' }).show).toBe(true);
  });
});

describe('Skutki raportu', () => {
  it('ciężka dieta z głodem → wejście silnika kalorii; sama ciężka dieta → prostsze posiłki', () => {
    expect(checkinEffects(ck('w', { diet: 'hard', hunger: true })).strongHunger).toBe(true);
    const e = checkinEffects(ck('w', { diet: 'hard', hunger: false }));
    expect(e.strongHunger).toBe(false); expect(e.simplerMeals).toBe(true);
  });
  it('słabe samopoczucie albo „mniej treningów” → lżejszy tydzień; kolano „wyraźnie” → ostrożność', () => {
    expect(checkinEffects(ck('w', { mood: 2 })).lighterWeek).toBe(true);
    expect(checkinEffects(ck('w', { changes: ['fewer_workouts'] })).lighterWeek).toBe(true);
    expect(checkinEffects(ck('w', { knee: 'clear' })).kneeCaution).toBe(true);
    expect(checkinEffects(ck('w', { knee: 'mild' })).kneeCaution).toBe(false);
  });
  it('bez problemów: jedno zdanie „bez zmian”; brak raportu = brak skutków (nie kara)', () => {
    expect(checkinEffects(ck('w')).lines).toEqual(['Bez zmian: plan zostaje taki, jaki jest.']);
    expect(checkinEffects(undefined)).toMatchObject({ strongHunger: false, lighterWeek: false, lines: [] });
  });
  it('obowiązuje raport z poprzedniego albo bieżącego tygodnia, starszy już nie', () => {
    expect(activeCheckin([ck('2026-11-16')], '2026-11-25')?.id).toBe('2026-11-16');
    expect(activeCheckin([ck('2026-11-09')], '2026-11-25')).toBeUndefined();
  });
  it('lżejszy tydzień: cel tylko dla wskazanego tygodnia', () => {
    const p = planWeekly({ from: '2026-11-23', horizon: 14, sessions: [], perWeek: 3, perWeekFor: (ws) => (ws === '2026-11-23' ? 2 : undefined) });
    expect(p.filter((x) => x.date <= '2026-11-29')).toHaveLength(2);
    expect(p.filter((x) => x.date >= '2026-11-30')).toHaveLength(3);
  });
  it('plik kalendarza: co tydzień w niedzielę 20:30 z powiadomieniem', () => {
    const ics = reminderIcs('2026-11-29', 'https://x.example/');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU');
    expect(ics).toContain('DTSTART;TZID=Europe/Warsaw:20261129T203000');
    expect(ics).toContain('BEGIN:VALARM');
  });
});
