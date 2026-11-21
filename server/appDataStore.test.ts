import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LeaderUser } from '../src/types/index.ts';
import { AppDataStore } from './appDataStore.ts';

const adminUser: LeaderUser = {
  id: 'ldr-admin',
  name: 'Pr. Lucas',
  login: 'admin',
  email: 'admin@igreja.com.br',
  cargo: 'Coordenação Geral',
  role: 'admin',
  ministryId: null,
  active: true,
  createdAt: 100
};

const louvorLeader: LeaderUser = {
  id: 'ldr-louvor',
  name: 'Camila',
  login: 'louvor',
  email: 'louvor@igreja.com.br',
  cargo: 'Líder de Louvor',
  role: 'leader',
  ministryId: 'min-louvor',
  active: true,
  createdAt: 100
};

async function withTempStore(fn: (store: AppDataStore, dir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'escala-appstore-test-'));
  try {
    const store = new AppDataStore({ dataDir: dir, supabaseClient: null });
    await fn(store, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('AppDataStore seeds initial data and scopes reads by department role', async () => {
  await withTempStore(async (store) => {
    const adminData = await store.getDataForUser(adminUser);
    assert.equal(adminData.ministries.length, 5);
    assert.equal(adminData.members.length, 11);
    assert.equal(adminData.services.length, 4);
    assert.equal(adminData.schedules.length, 4);

    const leaderData = await store.getDataForUser(louvorLeader);
    assert.equal(leaderData.ministries.length, 1);
    assert.equal(leaderData.ministries[0].id, 'min-louvor');
    assert.ok(leaderData.members.every((m) => m.ministryId === 'min-louvor'));
    for (const sch of leaderData.schedules) {
      assert.deepEqual(Object.keys(sch.assignments), ['min-louvor']);
    }
  });
});

test('AppDataStore enforces RBAC and propagates role changes across members and schedules', async () => {
  await withTempStore(async (store, dir) => {
    // Leader cannot add ministry or service or church name
    const badChurch = await store.setChurchName('Outra Igreja', louvorLeader);
    assert.equal(badChurch.ok, false);
    if (!badChurch.ok) assert.equal(badChurch.status, 403);

    const badMin = await store.addMinistry({ name: 'Novo', locais: ['Posto 1'] }, louvorLeader);
    assert.equal(badMin.ok, false);

    // Leader CAN add role to own department, and cannot add role to another department
    const deniedRole = await store.addMinistryRole('min-midia', 'Iluminação', louvorLeader);
    assert.equal(deniedRole.ok, false);
    if (!deniedRole.ok) assert.equal(deniedRole.status, 403);

    const addedRole = await store.addMinistryRole('min-louvor', 'Saxofone', louvorLeader);
    assert.equal(addedRole.ok, true);

    // Rename "Bateria" -> "Bateria Eletrônica" via saveMinistryRoles and confirm propagation across restarts
    const before = await store.getDataForUser(louvorLeader);
    const louvorMin = before.ministries[0];
    const drafts = louvorMin.locais.map((loc, idx) => ({
      id: `d-${idx}`,
      originalName: loc,
      name: loc === 'Bateria' ? 'Bateria Eletrônica' : loc
    }));

    const savedRoles = await store.saveMinistryRoles(
      { ministryId: 'min-louvor', drafts },
      louvorLeader
    );
    assert.equal(savedRoles.ok, true);

    // Re-open store from disk to verify persistence
    const reopened = new AppDataStore({ dataDir: dir, supabaseClient: null });
    const afterAdmin = await reopened.getDataForUser(adminUser);
    const reloadedLouvor = afterAdmin.ministries.find((m) => m.id === 'min-louvor')!;
    assert.ok(reloadedLouvor.locais.includes('Saxofone'));
    assert.ok(reloadedLouvor.locais.includes('Bateria Eletrônica'));
    assert.ok(!reloadedLouvor.locais.includes('Bateria'));

    const drummer = afterAdmin.members.find((m) => m.id === 'mem-3')!;
    assert.ok(drummer.locais.includes('Bateria Eletrônica'));

    const sundaySch = afterAdmin.schedules.find((s) => s.id === 'sch-proximo-domingo-noite')!;
    assert.ok(sundaySch.assignments['min-louvor'].some((a) => a.local === 'Bateria Eletrônica'));
    // Other departments remain intact!
    assert.ok((sundaySch.assignments['min-midia'] || []).length > 0);
  });
});

test('AppDataStore persists schedule mutations without clobbering other departments', async () => {
  await withTempStore(async (store) => {
    const leaderData = await store.getDataForUser(louvorLeader);
    const targetSchedule = leaderData.schedules[0];

    const updated = await store.updateSchedule(
      {
        ...targetSchedule,
        note: 'Observação atualizada pelo Louvor',
        assignments: {
          'min-louvor': [
            { id: 'as-new', memberId: 'mem-2', local: 'Voz Líder', present: false }
          ],
          // Attempted spoofed write to another department must be ignored
          'min-midia': []
        }
      },
      louvorLeader
    );
    assert.equal(updated.ok, true);

    const adminAfter = await store.getDataForUser(adminUser);
    const fullTarget = adminAfter.schedules.find((s) => s.id === targetSchedule.id)!;
    assert.equal(fullTarget.note, 'Observação atualizada pelo Louvor');
    assert.equal(fullTarget.assignments['min-louvor'].length, 1);
    // Midia assignments preserved!
    assert.ok((fullTarget.assignments['min-midia'] || []).length > 0);
  });
});
