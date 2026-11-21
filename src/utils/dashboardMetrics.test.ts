import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDashboardSummary,
  formatLeaderGreetingName,
  formatRelativeNotificationTimePtBr
} from './dashboardMetrics.ts';
import type { LeaderUser, Member, Ministry, Schedule, Service } from '../types/index.ts';

const ministries: Ministry[] = [
  { id: 'min-louvor', name: 'Louvor & Adoração', locais: ['Voz Líder', 'Bateria'] },
  { id: 'min-midia', name: 'Mídia & Transmissão', locais: ['Mesa de Som (FOH)'] }
];

const members: Member[] = [
  { id: 'm1', name: 'Camila', cargo: 'Líder', phone: '11999990001', ministryId: 'min-louvor', locais: ['Voz Líder'] },
  { id: 'm2', name: 'Gabriel', cargo: 'Baterista', phone: '11999990002', ministryId: 'min-louvor', locais: ['Bateria'] },
  { id: 'm3', name: 'Rodrigo', cargo: 'Áudio', phone: '11999990003', ministryId: 'min-midia', locais: ['Mesa de Som (FOH)'] }
];

const services: Service[] = [
  { id: 'srv-dom', label: 'Culto de Domingo Noite (19h)', dayOfWeek: 'Domingo', time: '19:00' },
  { id: 'srv-qua', label: 'Quarta da Vitória (20h)', dayOfWeek: 'Quarta-feira', time: '20:00' }
];

const schedules: Schedule[] = [
  {
    id: 'sch-past',
    dateIso: '2026-11-11',
    serviceId: 'srv-qua',
    serviceLabel: 'Quarta da Vitória (20h)',
    assignments: {
      'min-louvor': [{ id: 'a1', memberId: 'm1', local: 'Voz Líder', present: true }],
      'min-midia': [{ id: 'a2', memberId: 'm3', local: 'Mesa de Som (FOH)', present: false }]
    },
    note: '',
    createdAt: 1000
  },
  {
    id: 'sch-next',
    dateIso: '2026-11-22',
    serviceId: 'srv-dom',
    serviceLabel: 'Culto de Domingo Noite (19h)',
    assignments: {
      'min-louvor': [
        { id: 'a3', memberId: 'm1', local: 'Voz Líder', present: true },
        { id: 'a4', memberId: 'm2', local: 'Bateria', present: false }
      ],
      'min-midia': []
    },
    note: '',
    createdAt: 2000
  }
];

const adminUser: LeaderUser = {
  id: 'u-admin',
  name: 'Pr. Lucas',
  login: 'admin',
  email: 'admin@adbrasil.org',
  cargo: 'Pastor',
  role: 'admin',
  ministryId: null,
  active: true,
  createdAt: 100
};

const louvorLeader: LeaderUser = {
  id: 'u-louvor',
  name: 'Camila',
  login: 'louvor',
  email: 'louvor@adbrasil.org',
  cargo: 'Líder de Louvor',
  role: 'leader',
  ministryId: 'min-louvor',
  active: true,
  createdAt: 100
};

test('buildDashboardSummary computes scoped metrics for department leader without leaking other departments', () => {
  const summary = buildDashboardSummary({
    user: louvorLeader,
    ministries,
    members,
    services,
    schedules,
    todayIso: '2026-11-18'
  });

  assert.equal(summary.volunteers.totalActive, 2);
  assert.equal(summary.volunteers.scheduledInUpcoming, 2);
  assert.equal(summary.volunteers.departmentCount, 1);

  assert.ok(summary.nextService);
  assert.equal(summary.nextService.scheduleId, 'sch-next');
  assert.equal(summary.nextService.totalAssigned, 2);
  assert.equal(summary.nextService.totalPresent, 1);
  assert.equal(summary.nextService.pendingConfirmations, 1);
  assert.equal(summary.nextService.timeLabel, '19:00');

  // Louvor has 1 unconfirmed volunteer in sch-next, and DOES NOT trigger empty_department for min-midia
  assert.equal(summary.pendingAlerts.totalAlerts, 1);
  assert.equal(summary.pendingAlerts.alerts[0].reason, 'unconfirmed_presence');
  assert.equal(summary.pendingAlerts.alerts[0].pendingCount, 1);

  // Weekly series includes both past week (2026-11-08) and next week (2026-11-22)
  assert.equal(summary.weeklyAttendance.length, 4);
  const pastWeek = summary.weeklyAttendance.find((w) => w.weekStartIso === '2026-11-08');
  const nextWeek = summary.weeklyAttendance.find((w) => w.weekStartIso === '2026-11-22');
  assert.equal(pastWeek?.confirmados, 1);
  assert.equal(pastWeek?.pendentes, 0);
  assert.equal(nextWeek?.confirmados, 1);
  assert.equal(nextWeek?.pendentes, 1);
  assert.equal(summary.overallWeeklyRate, 67);
});

test('buildDashboardSummary shows church-wide alerts including empty departments for admin', () => {
  const summary = buildDashboardSummary({
    user: adminUser,
    ministries,
    members,
    services,
    schedules,
    todayIso: '2026-11-18'
  });

  assert.equal(summary.volunteers.totalActive, 3);
  assert.equal(summary.volunteers.departmentCount, 2);
  assert.equal(summary.pendingAlerts.totalAlerts, 2);
  assert.equal(summary.pendingAlerts.highPriorityCount, 1);
  assert.equal(summary.pendingAlerts.alerts[0].reason, 'empty_department');
});

test('buildDashboardSummary detects schedule conflicts and falls back cleanly when no upcoming schedule exists', () => {
  const conflictSchedule: Schedule = {
    id: 'sch-conflict',
    dateIso: '2026-11-25',
    serviceId: 'srv-qua',
    serviceLabel: 'Quarta da Vitória (20h)',
    assignments: {
      'min-louvor': [
        { id: 'c1', memberId: 'm1', local: 'Voz Líder', present: true },
        { id: 'c2', memberId: 'm1', local: 'Bateria', present: true }
      ]
    },
    note: '',
    createdAt: 3000
  };

  const withConflict = buildDashboardSummary({
    user: louvorLeader,
    ministries,
    members,
    services,
    schedules: [conflictSchedule],
    todayIso: '2026-11-18'
  });

  assert.equal(withConflict.pendingAlerts.alerts[0].reason, 'schedule_conflict');
  assert.equal(withConflict.pendingAlerts.highPriorityCount, 1);

  const withoutUpcoming = buildDashboardSummary({
    user: louvorLeader,
    ministries,
    members,
    services,
    schedules: [schedules[0]],
    todayIso: '2026-11-18'
  });

  assert.ok(withoutUpcoming.nextService);
  assert.equal(withoutUpcoming.nextService.hasSchedule, false);
  assert.equal(withoutUpcoming.nextService.serviceLabel, 'Culto de Domingo Noite (19h)');
});

test('formatRelativeNotificationTimePtBr formats Portuguese elapsed times accurately', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeNotificationTimePtBr(now - 20_000, now), 'Agora mesmo');
  assert.equal(formatRelativeNotificationTimePtBr(now - 5 * 60_000, now), 'Há 5 min');
  assert.equal(formatRelativeNotificationTimePtBr(now - 3 * 3_600_000, now), 'Há 3h');
  assert.equal(formatRelativeNotificationTimePtBr(now - 26 * 3_600_000, now), 'Ontem');
});

test('formatLeaderGreetingName preserves honorifics like Pr. and Tia', () => {
  assert.equal(formatLeaderGreetingName('Pr. Lucas Ribeiro'), 'Pr. Lucas');
  assert.equal(formatLeaderGreetingName('Tia Débora Santos'), 'Tia Débora');
  assert.equal(formatLeaderGreetingName('Camila Fernandes'), 'Camila');
  assert.equal(formatLeaderGreetingName(''), 'Líder');
});
