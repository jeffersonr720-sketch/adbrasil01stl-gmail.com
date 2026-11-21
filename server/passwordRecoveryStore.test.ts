import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LeaderRepository } from './leaderRepository.ts';
import { PasswordRecoveryStore } from './passwordRecoveryStore.ts';
import { isSupabaseTableMissingError } from './supabaseClient.ts';

async function withTempStores(
  fn: (repos: { leaderRepo: LeaderRepository; recoveryStore: PasswordRecoveryStore }) => Promise<void>
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'escala-recovery-test-'));
  try {
    const leaderRepo = new LeaderRepository({ dataDir: dir, supabaseClient: null });
    const recoveryStore = new PasswordRecoveryStore({
      leaderRepo,
      dataDir: dir,
      supabaseClient: null
    });
    await fn({ leaderRepo, recoveryStore });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('PasswordRecoveryStore handles request, 6-digit code issuance, rejection of wrong code, and password reset', async () => {
  await withTempStores(async ({ leaderRepo, recoveryStore }) => {
    const unknown = await recoveryStore.requestRecovery({ identifier: 'naoexiste' });
    assert.equal(unknown.ok, false);

    const requested = await recoveryStore.requestRecovery({
      identifier: 'louvor',
      contactNote: 'WhatsApp 11999990000'
    });
    assert.equal(requested.ok, true);

    const active = await recoveryStore.listActiveRequests();
    assert.equal(active.length, 1);
    assert.equal(active[0].status, 'pending');
    assert.equal(active[0].leaderLogin, 'louvor');

    const issued = await recoveryStore.issueRecoveryCode('ldr-louvor');
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    assert.match(issued.code, /^\d{6}$/);

    // Wrong code fails
    const badConfirm = await recoveryStore.confirmRecoveryReset({
      identifier: 'louvor',
      code: '000000',
      newPassword: 'novaSenha77'
    });
    assert.equal(badConfirm.ok, false);

    // Valid code updates password & completes ticket
    const okConfirm = await recoveryStore.confirmRecoveryReset({
      identifier: 'louvor',
      code: issued.code,
      newPassword: 'novaSenha77'
    });
    assert.equal(okConfirm.ok, true);

    const remaining = await recoveryStore.listActiveRequests();
    assert.equal(remaining.length, 0);

    // Old password fails, new password works
    const oldAuth = await leaderRepo.authenticate('louvor', 'adbrasil123');
    assert.equal(oldAuth.ok, false);
    const newAuth = await leaderRepo.authenticate('louvor', 'novaSenha77');
    assert.equal(newAuth.ok, true);
  });
});

test('isSupabaseTableMissingError detects PostgREST PGRST205 and Postgres 42P01 errors accurately', () => {
  assert.equal(
    isSupabaseTableMissingError({
      code: 'PGRST205',
      message: "Could not find the table 'public.password_resets' in the schema cache"
    }),
    true
  );
  assert.equal(
    isSupabaseTableMissingError({
      code: '42P01',
      message: 'relation "public.leaders" does not exist'
    }),
    true
  );
  assert.equal(
    isSupabaseTableMissingError({
      code: '23505',
      message: 'duplicate key value violates unique constraint'
    }),
    false
  );
  assert.equal(isSupabaseTableMissingError(null), false);
});

