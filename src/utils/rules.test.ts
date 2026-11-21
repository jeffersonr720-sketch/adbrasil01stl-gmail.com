import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatWhatsAppMessage,
  getWhatsAppShareUrl,
  detectScheduleConflicts,
  calculateMemberStats,
  exportSchedulesToCsv,
  getInitialSeedData
} from './rules';
import { Schedule } from '../types';

test('formatWhatsAppMessage formats schedule correctly with emojis and headers', () => {
  const seed = getInitialSeedData();
  const schedule = seed.schedules[0];
  const message = formatWhatsAppMessage(schedule, seed.ministries, seed.members, 'Igreja Vida Plena');

  assert.ok(message.includes('ESCALA DE VOLUNTÁRIOS - IGREJA VIDA PLENA'));
  assert.ok(message.includes('Culto de Domingo Noite (19h)'));
  assert.ok(message.includes('LOUVOR & ADORAÇÃO'));
  assert.ok(message.includes('Voz Líder'));
  assert.ok(message.includes('Camila Fernandes'));
  assert.ok(message.includes('Reunião de oração'));
});

test('detectScheduleConflicts finds members assigned to multiple positions', () => {
  const seed = getInitialSeedData();
  const scheduleWithConflict: Schedule = {
    id: 'test-sch',
    dateIso: '2026-11-15',
    serviceId: 'srv-1',
    serviceLabel: 'Culto Noturno',
    assignments: {
      'min-louvor': [
        { id: 'as-1', memberId: 'mem-3', local: 'Bateria', present: true }
      ],
      'min-midia': [
        { id: 'as-2', memberId: 'mem-3', local: 'Mesa de Som (FOH)', present: true }
      ]
    },
    note: '',
    createdAt: Date.now()
  };

  const conflicts = detectScheduleConflicts(scheduleWithConflict, seed.members);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].memberId, 'mem-3');
  assert.equal(conflicts[0].locais.length, 2);
  assert.ok(conflicts[0].locais.includes('Bateria'));
  assert.ok(conflicts[0].locais.includes('Mesa de Som (FOH)'));
});

test('calculateMemberStats accurately calculates attendance rate', () => {
  const schedules: Schedule[] = [
    {
      id: 'sch-1',
      dateIso: '2026-11-01',
      serviceId: 'srv-1',
      serviceLabel: 'Culto 1',
      assignments: {
        'min-1': [{ id: 'a1', memberId: 'mem-test', local: 'Voz', present: true }]
      },
      note: '',
      createdAt: 1
    },
    {
      id: 'sch-2',
      dateIso: '2026-11-08',
      serviceId: 'srv-1',
      serviceLabel: 'Culto 2',
      assignments: {
        'min-1': [{ id: 'a2', memberId: 'mem-test', local: 'Voz', present: false }]
      },
      note: '',
      createdAt: 2
    }
  ];

  const stats = calculateMemberStats('mem-test', schedules);
  assert.equal(stats.totalAssigned, 2);
  assert.equal(stats.totalPresent, 1);
  assert.equal(stats.attendanceRate, 50);
});

test('exportSchedulesToCsv generates valid CSV with UTF-8 BOM', () => {
  const seed = getInitialSeedData();
  const csv = exportSchedulesToCsv(seed.schedules, seed.ministries, seed.members);

  assert.ok(csv.startsWith('\uFEFFData,Culto,Ministério'));
  assert.ok(csv.includes('Culto de Domingo Noite (19h)'));
  assert.ok(csv.includes('Louvor & Adoração'));
  assert.ok(csv.includes('Camila Fernandes'));
  assert.ok(csv.includes('Confirmado'));
});

