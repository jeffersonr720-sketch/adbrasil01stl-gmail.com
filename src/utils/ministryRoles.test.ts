import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addQuickMinistryRole,
  applyMinistryRoleChanges,
  createRoleDraftsFromLocais,
  normalizeRoleName,
  validateRoleDrafts,
  validateRoleName
} from './ministryRoles';
import type { Member, Ministry, Schedule } from '../types';

const sampleMinistry: Ministry = {
  id: 'min-louvor',
  name: 'Louvor & Adoração',
  color: '#2F9B45',
  locais: ['Voz Líder', 'Backing Vocal 1', 'Bateria']
};

const sampleMembers: Member[] = [
  {
    id: 'mem-1',
    name: 'Camila',
    cargo: 'Líder',
    phone: '111',
    ministryId: 'min-louvor',
    locais: ['Voz Líder', 'Backing Vocal 1']
  },
  {
    id: 'mem-2',
    name: 'Gabriel',
    cargo: 'Músico',
    phone: '222',
    ministryId: 'min-louvor',
    locais: ['Bateria']
  },
  {
    id: 'mem-3',
    name: 'Beatriz',
    cargo: 'Mídia',
    phone: '333',
    ministryId: 'min-midia',
    locais: ['Backing Vocal 1']
  }
];

const sampleSchedules: Schedule[] = [
  {
    id: 'sch-1',
    dateIso: '2026-11-22',
    serviceId: 'srv-1',
    serviceLabel: 'Domingo Noite',
    assignments: {
      'min-louvor': [
        { id: 'a1', memberId: 'mem-1', local: 'Backing Vocal 1', present: true },
        { id: 'a2', memberId: 'mem-2', local: 'Bateria', present: false }
      ],
      'min-midia': [
        { id: 'a3', memberId: 'mem-3', local: 'Backing Vocal 1', present: false }
      ]
    },
    note: '',
    createdAt: 1000
  }
];

test('normalizeRoleName collapses extra spaces and trims', () => {
  assert.equal(normalizeRoleName('  Voz   Líder  '), 'Voz Líder');
});

test('validateRoleName blocks empty, short, and case-insensitive duplicates', () => {
  assert.ok(validateRoleName(' ', ['Voz Líder']));
  assert.ok(validateRoleName('A', ['Voz Líder']));
  assert.ok(validateRoleName('voz líder', ['Voz Líder', 'Bateria']));
  assert.equal(validateRoleName('voz líder', ['Voz Líder', 'Bateria'], 0), null);
  assert.equal(validateRoleName('Percussão', ['Voz Líder', 'Bateria']), null);
});

test('validateRoleDrafts catches empty list, short role, and duplicate names', () => {
  assert.ok(validateRoleDrafts([]));
  assert.ok(validateRoleDrafts([{ id: '1', originalName: null, name: 'X' }]));
  assert.ok(
    validateRoleDrafts([
      { id: '1', originalName: 'Bateria', name: 'Bateria' },
      { id: '2', originalName: null, name: 'bateria' }
    ])
  );
  assert.equal(
    validateRoleDrafts([
      { id: '1', originalName: 'Bateria', name: 'Bateria Acústica' },
      { id: '2', originalName: null, name: 'Percussão' }
    ]),
    null
  );
});

test('applyMinistryRoleChanges renames and removes roles cleanly while propagating to members and schedules', () => {
  const drafts = createRoleDraftsFromLocais(sampleMinistry.locais);
  // Rename Backing Vocal 1 -> Backing Vocal Soprano, remove Bateria, add Percussão
  const editedDrafts = [
    drafts[0],
    { ...drafts[1], name: 'Backing Vocal Soprano' },
    { id: 'new-1', originalName: null, name: 'Percussão' }
  ];

  const result = applyMinistryRoleChanges({
    ministry: sampleMinistry,
    drafts: editedDrafts,
    members: sampleMembers,
    schedules: sampleSchedules
  });

  assert.deepEqual(result.updatedMinistry.locais, [
    'Voz Líder',
    'Backing Vocal Soprano',
    'Percussão'
  ]);
  assert.deepEqual(result.renames, [{ from: 'Backing Vocal 1', to: 'Backing Vocal Soprano' }]);
  assert.deepEqual(result.removed, ['Bateria']);

  // Camila updated to Backing Vocal Soprano; Gabriel cleared of removed Bateria; Beatriz (other ministry) untouched
  assert.deepEqual(result.updatedMembers[0].locais, ['Voz Líder', 'Backing Vocal Soprano']);
  assert.deepEqual(result.updatedMembers[1].locais, []);
  assert.deepEqual(result.updatedMembers[2].locais, ['Backing Vocal 1']);

  // Schedule assignment in min-louvor renamed; min-midia untouched
  assert.equal(result.updatedSchedules[0].assignments['min-louvor'][0].local, 'Backing Vocal Soprano');
  assert.equal(result.updatedSchedules[0].assignments['min-midia'][0].local, 'Backing Vocal 1');
});

test('addQuickMinistryRole appends unique role and rejects duplicates', () => {
  const ok = addQuickMinistryRole(sampleMinistry, '  Saxofone  ');
  assert.equal(ok.error, undefined);
  assert.equal(ok.normalizedName, 'Saxofone');
  assert.deepEqual(ok.updatedMinistry?.locais, [
    'Voz Líder',
    'Backing Vocal 1',
    'Bateria',
    'Saxofone'
  ]);

  const dup = addQuickMinistryRole(sampleMinistry, 'bateria');
  assert.ok(dup.error);
  assert.equal(dup.updatedMinistry, undefined);
});
