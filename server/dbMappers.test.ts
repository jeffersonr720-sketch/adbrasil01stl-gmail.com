import test from 'node:test';
import assert from 'node:assert/strict';
import type { LeaderUser, Member, Ministry, Schedule, Service } from '../src/types/index.ts';
import type { StoredLeaderRecord } from './authStore.ts';
import {
  leaderToRow,
  memberToRow,
  ministryToRow,
  rowToLeader,
  rowToMember,
  rowToMinistry,
  rowToSchedule,
  rowToService,
  scheduleToRow,
  scopeAppDataForUser,
  serviceToRow
} from './dbMappers.ts';

test('row mappers preserve roundtrip fields for all entities', () => {
  const min: Ministry = {
    id: 'min-louvor',
    name: 'Louvor & Adoração',
    locais: ['Voz Líder', 'Bateria'],
    color: '#2F9B45'
  };
  assert.deepEqual(rowToMinistry(ministryToRow(min, 1)), min);

  const mem: Member = {
    id: 'mem-1',
    name: 'Camila Fernandes',
    cargo: 'Líder',
    phone: '5511999998888',
    ministryId: 'min-louvor',
    locais: ['Voz Líder'],
    email: 'camila@igreja.com.br'
  };
  assert.deepEqual(rowToMember(memberToRow(mem, 0)), mem);

  const srv: Service = {
    id: 'srv-dom-noite',
    label: 'Culto de Domingo Noite (19h)',
    dayOfWeek: 'Domingo',
    time: '19:00'
  };
  assert.deepEqual(rowToService(serviceToRow(srv, 0)), srv);

  const sch: Schedule = {
    id: 'sch-1',
    dateIso: '2026-11-22',
    serviceId: 'srv-dom-noite',
    serviceLabel: 'Culto de Domingo Noite (19h)',
    assignments: {
      'min-louvor': [{ id: 'as-1', memberId: 'mem-1', local: 'Voz Líder', present: true }],
      'min-midia': [{ id: 'as-2', memberId: 'mem-2', local: 'Som', present: false }]
    },
    note: 'Ensaio 18h',
    createdAt: 1700000000000
  };
  assert.deepEqual(rowToSchedule(scheduleToRow(sch)), sch);

  const ldr: StoredLeaderRecord = {
    id: 'ldr-louvor',
    name: 'Camila Fernandes',
    login: 'louvor',
    email: 'camila@igreja.com.br',
    cargo: 'Líder de Louvor',
    role: 'leader',
    ministryId: 'min-louvor',
    active: true,
    createdAt: 1700000000000,
    lastLoginAt: 1700000100000,
    passwordHash: 'salt:hash'
  };
  assert.deepEqual(rowToLeader(leaderToRow(ldr)), ldr);
});

test('scopeAppDataForUser isolates department leaders and grants full access to admin', () => {
  const fullData = {
    churchName: 'AD Brasil',
    ministries: [
      { id: 'min-louvor', name: 'Louvor', locais: ['Voz'] },
      { id: 'min-midia', name: 'Mídia', locais: ['Som'] }
    ],
    members: [
      { id: 'm1', name: 'Ana', cargo: 'Voz', phone: '1', ministryId: 'min-louvor', locais: ['Voz'] },
      { id: 'm2', name: 'Beto', cargo: 'Som', phone: '2', ministryId: 'min-midia', locais: ['Som'] }
    ],
    services: [{ id: 's1', label: 'Domingo 19h' }],
    schedules: [
      {
        id: 'sch-1',
        dateIso: '2026-11-22',
        serviceId: 's1',
        serviceLabel: 'Domingo 19h',
        assignments: {
          'min-louvor': [{ id: 'a1', memberId: 'm1', local: 'Voz', present: true }],
          'min-midia': [{ id: 'a2', memberId: 'm2', local: 'Som', present: false }]
        },
        note: '',
        createdAt: 100
      }
    ]
  };

  const leader: LeaderUser = {
    id: 'ldr-louvor',
    name: 'Camila',
    login: 'louvor',
    email: '',
    cargo: 'Líder',
    role: 'leader',
    ministryId: 'min-louvor',
    active: true,
    createdAt: 100
  };

  const scopedLeader = scopeAppDataForUser(fullData, leader);
  assert.equal(scopedLeader.ministries.length, 1);
  assert.equal(scopedLeader.ministries[0].id, 'min-louvor');
  assert.equal(scopedLeader.members.length, 1);
  assert.equal(scopedLeader.members[0].id, 'm1');
  assert.deepEqual(Object.keys(scopedLeader.schedules[0].assignments), ['min-louvor']);

  const admin: LeaderUser = { ...leader, id: 'ldr-admin', role: 'admin', ministryId: null };
  const scopedAdmin = scopeAppDataForUser(fullData, admin);
  assert.equal(scopedAdmin.ministries.length, 2);
  assert.equal(scopedAdmin.members.length, 2);
  assert.deepEqual(Object.keys(scopedAdmin.schedules[0].assignments), ['min-louvor', 'min-midia']);
});
