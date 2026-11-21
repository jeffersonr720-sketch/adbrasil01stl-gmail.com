import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  LeaderAuthStore,
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken
} from './authStore.ts';

function withTempStore(fn: (store: LeaderAuthStore) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'escala-auth-test-'));
  try {
    const store = new LeaderAuthStore(dir);
    fn(store);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('scrypt password hashing and verification', () => {
  const hashed = hashPassword('adbrasil123');
  assert.ok(hashed.includes(':'));
  assert.equal(verifyPassword('adbrasil123', hashed), true);
  assert.equal(verifyPassword('senhaerrada', hashed), false);
});

test('HMAC session tokens validate and reject tampering or expiration', () => {
  const secret = 'test-secret-with-enough-length-12345';
  const now = 1_700_000_000_000;
  const token = signSessionToken({ id: 'ldr-louvor', role: 'leader' }, secret, now);

  const valid = verifySessionToken(token, secret, now + 1000);
  assert.equal(valid?.sub, 'ldr-louvor');
  assert.equal(valid?.role, 'leader');

  // Tampered signature
  const tampered = token.slice(0, -3) + 'xxx';
  assert.equal(verifySessionToken(tampered, secret, now + 1000), null);

  // Expired token (> 7 days)
  assert.equal(verifySessionToken(token, secret, now + 8 * 24 * 60 * 60 * 1000), null);
});

test('LeaderAuthStore seeds default leaders and authenticates by login or email', () => {
  withTempStore((store) => {
    const leaders = store.listLeaders();
    assert.equal(leaders.length, 6);
    assert.equal('passwordHash' in leaders[0], false);

    // Auth by login
    const louvorRes = store.authenticate('louvor', 'adbrasil123');
    assert.equal(louvorRes.ok, true);
    if (louvorRes.ok) {
      assert.equal(louvorRes.user.ministryId, 'min-louvor');
      assert.equal(store.verifyToken(louvorRes.token)?.id, 'ldr-louvor');
    }

    // Auth by email
    const emailRes = store.authenticate('beatriz.midia@igreja.com.br', 'adbrasil123');
    assert.equal(emailRes.ok, true);

    // Wrong password
    const badRes = store.authenticate('louvor', 'errada');
    assert.equal(badRes.ok, false);
  });
});

test('LeaderAuthStore supports password change and admin leader lifecycle', () => {
  withTempStore((store) => {
    const chgBad = store.changePassword('ldr-louvor', 'errada', 'novasenha123');
    assert.equal(chgBad.ok, false);

    const chgOk = store.changePassword('ldr-louvor', 'adbrasil123', 'novasenha123');
    assert.equal(chgOk.ok, true);

    assert.equal(store.authenticate('louvor', 'adbrasil123').ok, false);
    assert.equal(store.authenticate('louvor', 'novasenha123').ok, true);

    // Create new leader
    const created = store.createLeader({
      name: 'Lucas Som',
      login: 'lucas.som',
      email: 'lucas.som@igreja.com.br',
      cargo: 'Líder Adjunto de Mídia',
      role: 'leader',
      ministryId: 'min-midia',
      password: 'sompassword1'
    });
    assert.equal(created.ok, true);
    assert.equal(store.authenticate('lucas.som', 'sompassword1').ok, true);

    // Deactivate leader prevents login
    if (created.ok) {
      const deactivated = store.updateLeader(created.leader.id, { active: false }, 'ldr-admin');
      assert.equal(deactivated.ok, true);
      const blocked = store.authenticate('lucas.som', 'sompassword1');
      assert.equal(blocked.ok, false);
    }
  });
});
