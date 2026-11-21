import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLogin,
  validateLoginCredentials,
  validateLeaderFormInput,
  validatePasswordChange,
  validateRecoveryRequestInput,
  validateRecoveryConfirmInput,
  canManageMinistry,
  canManageServicesAndMinistries,
  canManageLeaderAccounts,
  getScopedMinistries,
  getScopedMembers,
  scopeScheduleForUser,
  scopeSchedulesForUser,
  mergeScheduleAssignmentsForUser,
  canDeleteFullSchedule,
  findMatchingSchedule,
  getDefaultLeaderPresets
} from './authRules';
import type { LeaderUser, Member, Ministry, Schedule } from '../types';

const adminUser: LeaderUser = {
  id: 'ldr-admin',
  name: 'Pr. Lucas Ribeiro',
  login: 'admin',
  email: 'lucas.pastor@igreja.com.br',
  cargo: 'Pastor Titular',
  role: 'admin',
  ministryId: null,
  active: true,
  createdAt: 1000
};

const louvorLeader: LeaderUser = {
  id: 'ldr-louvor',
  name: 'Camila Fernandes',
  login: 'louvor',
  email: 'camila.louvor@igreja.com.br',
  cargo: 'Líder de Louvor',
  role: 'leader',
  ministryId: 'min-louvor',
  active: true,
  createdAt: 1000
};

const inactiveLeader: LeaderUser = {
  ...louvorLeader,
  id: 'ldr-inactive',
  active: false
};

const sampleMinistries: Ministry[] = [
  { id: 'min-louvor', name: 'Louvor & Adoração', locais: ['Voz Líder', 'Bateria'] },
  { id: 'min-midia', name: 'Mídia & Transmissão', locais: ['Mesa de Som (FOH)'] }
];

const sampleMembers: Member[] = [
  { id: 'mem-1', name: 'Camila', cargo: 'Líder', phone: '111', ministryId: 'min-louvor', locais: ['Voz Líder'] },
  { id: 'mem-2', name: 'Gabriel', cargo: 'Músico', phone: '222', ministryId: 'min-louvor', locais: ['Bateria'] },
  { id: 'mem-3', name: 'Beatriz', cargo: 'Líder', phone: '333', ministryId: 'min-midia', locais: ['Mesa de Som (FOH)'] }
];

const sampleSchedule: Schedule = {
  id: 'sch-1',
  dateIso: '2026-11-22',
  serviceId: 'srv-dom-noite',
  serviceLabel: 'Culto de Domingo Noite (19h)',
  assignments: {
    'min-louvor': [{ id: 'a1', memberId: 'mem-1', local: 'Voz Líder', present: true }],
    'min-midia': [{ id: 'a2', memberId: 'mem-3', local: 'Mesa de Som (FOH)', present: false }]
  },
  note: 'Orar às 18h15',
  createdAt: 1000
};

test('normalizeLogin trims whitespace and lowercases login', () => {
  assert.equal(normalizeLogin('  LouVor  '), 'louvor');
  assert.equal(normalizeLogin('Admin@Igreja.COM.BR '), 'admin@igreja.com.br');
});

test('validateLoginCredentials rejects empty or short values', () => {
  assert.ok(validateLoginCredentials('', 'adbrasil123'));
  assert.ok(validateLoginCredentials('louvor', ''));
  assert.ok(validateLoginCredentials('louvor', '123'));
  assert.equal(validateLoginCredentials('louvor', 'adbrasil123'), null);
});

test('validateLeaderFormInput validates login pattern, department assignment, and password length', () => {
  assert.ok(
    validateLeaderFormInput({
      name: '',
      login: 'louvor',
      password: 'password123',
      requirePassword: true,
      role: 'leader',
      ministryId: 'min-louvor'
    })
  );

  assert.ok(
    validateLeaderFormInput({
      name: 'Carlos',
      login: 'carlos space',
      password: 'password123',
      requirePassword: true,
      role: 'leader',
      ministryId: 'min-louvor'
    })
  );

  assert.ok(
    validateLeaderFormInput({
      name: 'Carlos',
      login: 'carlos',
      password: 'password123',
      requirePassword: true,
      role: 'leader',
      ministryId: null
    })
  );

  assert.ok(
    validateLeaderFormInput({
      name: 'Carlos',
      login: 'carlos',
      password: '123',
      requirePassword: true,
      role: 'leader',
      ministryId: 'min-louvor'
    })
  );

  assert.equal(
    validateLeaderFormInput({
      name: 'Carlos Silva',
      login: 'carlos.som',
      password: 'password123',
      requirePassword: true,
      role: 'leader',
      ministryId: 'min-midia'
    }),
    null
  );
});

test('validatePasswordChange verifies length, difference, and confirmation match', () => {
  assert.ok(validatePasswordChange('', 'nova123', 'nova123'));
  assert.ok(validatePasswordChange('atual123', '123', '123'));
  assert.ok(validatePasswordChange('atual123', 'atual123', 'atual123'));
  assert.ok(validatePasswordChange('atual123', 'nova123', 'outra123'));
  assert.equal(validatePasswordChange('atual123', 'nova123', 'nova123'), null);
});

test('RBAC permission helpers scope department leaders to their own ministry', () => {
  assert.equal(canManageMinistry(adminUser, 'min-louvor'), true);
  assert.equal(canManageMinistry(adminUser, 'min-midia'), true);
  assert.equal(canManageServicesAndMinistries(adminUser), true);
  assert.equal(canManageLeaderAccounts(adminUser), true);

  assert.equal(canManageMinistry(louvorLeader, 'min-louvor'), true);
  assert.equal(canManageMinistry(louvorLeader, 'min-midia'), false);
  assert.equal(canManageServicesAndMinistries(louvorLeader), false);
  assert.equal(canManageLeaderAccounts(louvorLeader), false);

  assert.equal(canManageMinistry(inactiveLeader, 'min-louvor'), false);
  assert.equal(canManageMinistry(null, 'min-louvor'), false);
});

test('getScopedMinistries and getScopedMembers strictly isolate department leader data', () => {
  assert.equal(getScopedMinistries(sampleMinistries, adminUser).length, 2);
  assert.equal(getScopedMembers(sampleMembers, adminUser).length, 3);

  const leaderMinistries = getScopedMinistries(sampleMinistries, louvorLeader);
  assert.deepEqual(leaderMinistries.map((m) => m.id), ['min-louvor']);

  const leaderMembers = getScopedMembers(sampleMembers, louvorLeader);
  assert.deepEqual(leaderMembers.map((m) => m.id), ['mem-1', 'mem-2']);

  assert.equal(getScopedMinistries(sampleMinistries, inactiveLeader).length, 0);
  assert.equal(getScopedMembers(sampleMembers, null).length, 0);
});

test('scopeScheduleForUser hides other department assignments from department leaders', () => {
  const adminView = scopeSchedulesForUser([sampleSchedule], adminUser)[0];
  assert.deepEqual(Object.keys(adminView.assignments).sort(), ['min-louvor', 'min-midia']);

  const leaderView = scopeScheduleForUser(sampleSchedule, louvorLeader);
  assert.deepEqual(Object.keys(leaderView.assignments), ['min-louvor']);
  assert.equal(leaderView.assignments['min-louvor'].length, 1);
  assert.equal(leaderView.assignments['min-midia'], undefined);

  const infantilLeader: LeaderUser = { ...louvorLeader, ministryId: 'min-infantil' };
  const emptyDeptView = scopeScheduleForUser(sampleSchedule, infantilLeader);
  assert.deepEqual(Object.keys(emptyDeptView.assignments), ['min-infantil']);
  assert.equal(emptyDeptView.assignments['min-infantil'].length, 0);
});

test('mergeScheduleAssignmentsForUser preserves other departments when a leader saves edits', () => {
  const leaderEdited = {
    'min-louvor': [
      { id: 'a1', memberId: 'mem-1', local: 'Voz Líder', present: true },
      { id: 'a3', memberId: 'mem-2', local: 'Bateria', present: false }
    ]
  };

  const merged = mergeScheduleAssignmentsForUser(sampleSchedule.assignments, leaderEdited, louvorLeader);
  assert.equal(merged['min-louvor'].length, 2);
  assert.equal(merged['min-midia'].length, 1);
  assert.equal(merged['min-midia'][0].memberId, 'mem-3');

  const adminReplaced = mergeScheduleAssignmentsForUser(sampleSchedule.assignments, leaderEdited, adminUser);
  assert.equal(adminReplaced['min-midia'], undefined);
});

test('canDeleteFullSchedule protects shared schedules while allowing single-dept or admin deletes', () => {
  assert.equal(canDeleteFullSchedule(sampleSchedule, adminUser), true);
  assert.equal(canDeleteFullSchedule(sampleSchedule, louvorLeader), false);

  const louvorOnlySchedule: Schedule = {
    ...sampleSchedule,
    assignments: {
      'min-louvor': [{ id: 'a1', memberId: 'mem-1', local: 'Voz Líder', present: true }],
      'min-midia': []
    }
  };
  assert.equal(canDeleteFullSchedule(louvorOnlySchedule, louvorLeader), true);
  assert.ok(findMatchingSchedule([sampleSchedule], '2026-11-22', 'srv-dom-noite'));
  assert.equal(findMatchingSchedule([sampleSchedule], '2026-11-23', 'srv-dom-noite'), undefined);
});

test('getDefaultLeaderPresets exposes admin and all 5 default ministries without passwords', () => {
  const presets = getDefaultLeaderPresets();
  assert.equal(presets.length, 6);
  assert.ok(presets.some((p) => p.login === 'admin'));
  assert.ok(presets.some((p) => p.login === 'louvor'));
  assert.ok(presets.some((p) => p.login === 'midia'));
  for (const preset of presets) {
    assert.equal('password' in preset, false);
    assert.ok(preset.departmentLabel.length > 0);
  }
});

test('validateRecoveryRequestInput and validateRecoveryConfirmInput enforce fields and 6-digit code', () => {
  assert.ok(validateRecoveryRequestInput(''));
  assert.ok(validateRecoveryRequestInput('a'));
  assert.equal(validateRecoveryRequestInput('louvor'), null);

  assert.ok(
    validateRecoveryConfirmInput({
      identifier: 'louvor',
      code: '123',
      newPassword: 'password123',
      confirmPassword: 'password123'
    })
  );
  assert.ok(
    validateRecoveryConfirmInput({
      identifier: 'louvor',
      code: '123456',
      newPassword: '123',
      confirmPassword: '123'
    })
  );
  assert.ok(
    validateRecoveryConfirmInput({
      identifier: 'louvor',
      code: '123456',
      newPassword: 'password123',
      confirmPassword: 'password999'
    })
  );
  assert.equal(
    validateRecoveryConfirmInput({
      identifier: 'louvor',
      code: '123456',
      newPassword: 'password123',
      confirmPassword: 'password123'
    }),
    null
  );
});
