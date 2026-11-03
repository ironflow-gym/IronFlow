import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthCalendarDates, monthStart, shiftMonth } from '../src/monthCalendar.ts';
test('November 2026 has a Monday-first grid with the first on Sunday', () => {
 const dates = monthCalendarDates('2026-11-17');
 assert.equal(dates.length,42); assert.equal(dates[0],'2026-10-26'); assert.equal(dates[6],'2026-11-01'); assert.equal(dates[41],'2026-12-06');
 assert.equal(new Set(dates).size,42);
});
test('month changes clamp to the first and cross leap years and year boundaries', () => {
 assert.equal(shiftMonth('2026-12-31',1),'2027-01-01');
 assert.equal(shiftMonth('2026-01-31',-1),'2025-12-01');
 assert.equal(shiftMonth('2024-01-31',1),'2024-02-01');
 assert.ok(monthCalendarDates('2024-02-01').includes('2024-02-29'));
 assert.equal(monthStart('2026-11-30'),'2026-11-01');
});
