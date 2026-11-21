import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRelativeServiceDatePtBr, getMobileScheduleStatus } from './mobileHelpers';

test('formatRelativeServiceDatePtBr produces clear relative labels in Portuguese', () => {
  const today = formatRelativeServiceDatePtBr('2026-11-16', '2026-11-16');
  assert.equal(today.relativeLabel, 'Hoje');
  assert.equal(today.isToday, true);
  assert.equal(today.isPast, false);
  assert.equal(today.dayMonth, '16/11');
  assert.equal(today.weekdayShort, 'Seg');

  const tomorrow = formatRelativeServiceDatePtBr('2026-11-17', '2026-11-16');
  assert.equal(tomorrow.relativeLabel, 'Amanhã');
  assert.equal(tomorrow.isToday, false);

  const inSixDays = formatRelativeServiceDatePtBr('2026-11-22', '2026-11-16');
  assert.equal(inSixDays.relativeLabel, 'Em 6 dias');
  assert.equal(inSixDays.weekdayShort, 'Dom');

  const farFuture = formatRelativeServiceDatePtBr('2026-12-25', '2026-11-16');
  assert.equal(farFuture.relativeLabel, 'Sex · 25/12');

  const yesterday = formatRelativeServiceDatePtBr('2026-11-15', '2026-11-16');
  assert.equal(yesterday.relativeLabel, 'Ontem');
  assert.equal(yesterday.isPast, true);
});

test('getMobileScheduleStatus returns intuitive Portuguese status and tone', () => {
  const pending = getMobileScheduleStatus(0, 0);
  assert.equal(pending.tone, 'pending');
  assert.equal(pending.label, 'Escala pendente');
  assert.equal(pending.shortLabel, 'Falta escalar');

  const partial = getMobileScheduleStatus(4, 2);
  assert.equal(partial.tone, 'partial');
  assert.equal(partial.label, '2 de 4 confirmados');
  assert.equal(partial.percent, 50);

  const complete = getMobileScheduleStatus(3, 3);
  assert.equal(complete.tone, 'complete');
  assert.equal(complete.label, '3 de 3 confirmados');
  assert.equal(complete.shortLabel, '3/3 · Completa');
  assert.equal(complete.percent, 100);
});
