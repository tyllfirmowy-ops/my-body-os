// Lokalne daty jako 'YYYY-MM-DD' w strefie Europe/Warsaw. Arytmetyka dni na UTC (odporna na zmianę czasu).
export const TZ = 'Europe/Warsaw';
export type LocalDate = string;

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export function toLocalDate(instant: Date = new Date()): LocalDate {
  return dateFmt.format(instant);
}
export const today = () => toLocalDate(new Date());

function parse(d: LocalDate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}
export function addDays(d: LocalDate, n: number): LocalDate {
  return new Date(parse(d) + n * 86400000).toISOString().slice(0, 10);
}
export function diffDays(from: LocalDate, to: LocalDate): number {
  return Math.round((parse(to) - parse(from)) / 86400000);
}
/** 0 = poniedziałek … 6 = niedziela */
export function weekday(d: LocalDate): number {
  return (new Date(parse(d)).getUTCDay() + 6) % 7;
}
export function mondayOf(d: LocalDate): LocalDate {
  return addDays(d, -weekday(d));
}
export function range(from: LocalDate, days: number): LocalDate[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}
export const WEEKDAYS_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
export function formatPl(d: LocalDate): string {
  const [, m, day] = d.split('-');
  return `${WEEKDAYS_PL[weekday(d)]} ${Number(day)}.${m}`;
}

/** Offset strefy (minuty) dla danego momentu. */
function tzOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  return Math.round((asUtc - Math.floor(utcMs / 60000) * 60000) / 60000);
}
/** Lokalny czas warszawski -> znacznik UTC (ms). */
export function zonedToUtc(d: LocalDate, hhmm: string): number {
  const [y, m, day] = d.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, day, h, mi);
  const off1 = tzOffsetMinutes(guess - tzOffsetMinutes(guess) * 60000);
  return guess - off1 * 60000;
}

/** Długość snu w minutach. Jeśli godzina zaśnięcia > godziny pobudki, zaśnięcie było poprzedniego dnia. */
export function sleepMinutes(wakeDate: LocalDate, bedTime: string, wakeTime: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(bedTime) || !/^\d{2}:\d{2}$/.test(wakeTime)) return null;
  const bedDate = bedTime > wakeTime ? addDays(wakeDate, -1) : wakeDate;
  const mins = (zonedToUtc(wakeDate, wakeTime) - zonedToUtc(bedDate, bedTime)) / 60000;
  return mins > 0 && mins < 24 * 60 ? mins : null;
}

/** Minuty od północy dla godziny zaśnięcia, z nocą "przesuniętą" (np. 01:00 -> 25:00) do analizy regularności. */
export function bedtimeMinutesShifted(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const v = h * 60 + m;
  return v < 12 * 60 ? v + 24 * 60 : v;
}
