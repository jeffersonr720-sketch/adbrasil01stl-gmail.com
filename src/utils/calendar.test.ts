import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthCalendarGrid,
  navigateMonth,
  getMonthTitlePtBr,
  formatFullDatePtBr,
  getMonthScheduleStats,
  getSchedulePresenceSummary
} from './calendar';
import { Schedule } from '../types';

const sampleSchedules: Schedule[] = [
  {
    id: 's1',
    dateIso: '2026-11-15',
    serviceId: 'srv-1',
    serviceLabel: 'Culto de Domingo Noite (19h)',
    assignments: {
      'min-1': [
        { id: 'a1', memberId: 'm1', local: 'Voz', present: true },
        { id: 'a2', memberId: 'm2', local: 'Teclado', present: false }
      ]
    },
    note: '',
    createdAt: 100
  },
  {
    id: 's2',
    dateIso: '2026-11-15',
    serviceId: 'srv-2',
    serviceLabel: 'Culto de Domingo Manhã (10h)',
    assignments: {
      'min-1': [{ id: 'a3', memberId: 'm3', local: 'Bateria', present: true }]
    },
    note: '',
    createdAt: 200
  },
  {
    id: 's3',
    dateIso: '2026-12-02',
    serviceId: 'srv-3',
    serviceLabel: 'Quarta da Vitória',
    assignments: {
      'min-1': [{ id: 'a4', memberId: 'm1', local: 'Voz', present: true }]
    },
    note: '',
    createdAt: 300
  }
];

test('navigateMonth wraps across year boundaries cleanly', () => {
  assert.deepEqual(navigateMonth(2026, 0, -1), { year: 2025, monthIndex: 11 });
  assert.deepEqual(navigateMonth(2026, 11, 1), { year: 2027, monthIndex: 0 });
  assert.deepEqual(navigateMonth(2026, 10, 1), { year: 2026, monthIndex: 11 });
});

test('getMonthTitlePtBr and formatFullDatePtBr format Portuguese labels', () => {
  assert.equal(getMonthTitlePtBr(2026, 10), 'Novembro 2026');
  assert.equal(formatFullDatePtBr('2026-11-22'), 'Domingo, 22 de Novembro');
});

test('buildMonthCalendarGrid maps schedules to exact dates and marks today', () => {
  // November 2026 starts on Sunday (Nov 1) and has 30 days -> 35 cells
  const grid = buildMonthCalendarGrid(2026, 10, sampleSchedules, '2026-11-16');

  assert.equal(grid.length, 35);
  assert.equal(grid[0].dateIso, '2026-11-01');
  assert.equal(grid[0].isCurrentMonth, true);

  const nov15 = grid.find((c) => c.dateIso === '2026-11-15');
  assert.ok(nov15);
  assert.equal(nov15.schedules.length, 2);
  // Sorted alphabetically by serviceLabel
  assert.equal(nov15.schedules[0].serviceLabel, 'Culto de Domingo Manhã (10h)');

  const nov16 = grid.find((c) => c.dateIso === '2026-11-16');
  assert.ok(nov16);
  assert.equal(nov16.isToday, true);
  assert.equal(nov16.schedules.length, 0);

  // Trailing cells belong to December 2026
  const dec2 = grid.find((c) => c.dateIso === '2026-12-02');
  assert.ok(dec2);
  assert.equal(dec2.isCurrentMonth, false);
  assert.equal(dec2.schedules.length, 1);
});

test('getMonthScheduleStats and getSchedulePresenceSummary compute counts accurately', () => {
  const stats = getMonthScheduleStats(2026, 10, sampleSchedules);
  assert.equal(stats.totalSchedules, 2);
  assert.equal(stats.totalAssigned, 3);
  assert.equal(stats.totalPresent, 2);

  const summary = getSchedulePresenceSummary(sampleSchedules[0]);
  assert.equal(summary.totalAssigned, 2);
  assert.equal(summary.totalPresent, 1);
  assert.equal(summary.percent, 50);
});
