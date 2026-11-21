import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  NotificationStore,
  countUnreadNotificationsForUser,
  filterNotificationsForUser
} from './notificationStore.ts';
import type { LeaderUser } from '../src/types/index.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'escala-notif-test-'));
}

const adminUser: LeaderUser = {
  id: 'leader-admin',
  name: 'Pr. Lucas Ribeiro',
  login: 'admin',
  email: 'admin@igreja.com.br',
  cargo: 'Coordenação Geral',
  role: 'admin',
  ministryId: null,
  active: true,
  createdAt: 100
};

const louvorUser: LeaderUser = {
  id: 'leader-louvor',
  name: 'Camila Fernandes',
  login: 'louvor',
  email: 'louvor@igreja.com.br',
  cargo: 'Líder de Louvor',
  role: 'leader',
  ministryId: 'min-louvor',
  active: true,
  createdAt: 100
};

const midiaUser: LeaderUser = {
  id: 'leader-midia',
  name: 'Beatriz Lima',
  login: 'midia',
  email: 'midia@igreja.com.br',
  cargo: 'Líder de Mídia',
  role: 'leader',
  ministryId: 'min-midia',
  active: true,
  createdAt: 100
};

test('NotificationStore scopes notifications by RBAC: leaders see services + own department only', async () => {
  const dir = createTempDir();
  const store = new NotificationStore({ dataDir: dir, supabaseClient: null });

  await store.createNotification({
    category: 'service',
    ministryId: null,
    title: 'Culto Especial de Missões',
    message: 'Novo culto cadastrado para o próximo mês.',
    targetTab: 'services',
    actorName: 'Pr. Lucas Ribeiro'
  });

  await store.createNotification({
    category: 'schedule',
    ministryId: 'min-louvor',
    title: 'Escala de Louvor alterada',
    message: 'Baterista atualizado.',
    targetTab: 'schedules',
    actorName: 'Camila Fernandes'
  });

  await store.createNotification({
    category: 'ministry',
    ministryId: 'min-midia',
    title: 'Novo posto na Mídia',
    message: 'Operador de Drone adicionado.',
    targetTab: 'ministries',
    actorName: 'Beatriz Lima'
  });

  const louvorRes = await store.listForUser(louvorUser);
  const midiaRes = await store.listForUser(midiaUser);
  const adminRes = await store.listForUser(adminUser);

  assert.ok(louvorRes.notifications.some((n) => n.title === 'Culto Especial de Missões'));
  assert.ok(louvorRes.notifications.some((n) => n.title === 'Escala de Louvor alterada'));
  assert.equal(
    louvorRes.notifications.some((n) => n.ministryId === 'min-midia'),
    false
  );

  assert.ok(midiaRes.notifications.some((n) => n.title === 'Culto Especial de Missões'));
  assert.ok(midiaRes.notifications.some((n) => n.title === 'Novo posto na Mídia'));
  assert.equal(
    midiaRes.notifications.some((n) => n.ministryId === 'min-louvor'),
    false
  );

  assert.ok(adminRes.notifications.some((n) => n.title === 'Novo posto na Mídia'));
  assert.ok(adminRes.notifications.some((n) => n.title === 'Escala de Louvor alterada'));
});

test('NotificationStore tracks read state independently per leader and enforces permissions on markAsRead', async () => {
  const dir = createTempDir();
  const store = new NotificationStore({ dataDir: dir, supabaseClient: null });

  const midiaNotif = await store.createNotification({
    category: 'member',
    ministryId: 'min-midia',
    title: 'Voluntário adicionado na Mídia',
    message: 'Novo operador cadastrado.',
    targetTab: 'members',
    actorName: 'Beatriz Lima'
  });

  // Louvor leader cannot mark a Mídia-only notification as read
  const forbidden = await store.markAsRead(midiaNotif.id, louvorUser);
  assert.equal(forbidden.ok, false);
  if (!forbidden.ok) {
    assert.equal(forbidden.status, 403);
  }

  // Mídia leader marks all as read; Admin still sees unread count intact
  const beforeAdminUnread = (await store.listForUser(adminUser)).unreadCount;
  await store.markAllAsRead(midiaUser);
  const afterMidia = await store.listForUser(midiaUser);
  const afterAdminUnread = (await store.listForUser(adminUser)).unreadCount;

  assert.equal(afterMidia.unreadCount, 0);
  assert.equal(afterAdminUnread, beforeAdminUnread);
  assert.equal(countUnreadNotificationsForUser(afterMidia.notifications, midiaUser), 0);
  assert.equal(filterNotificationsForUser(afterMidia.notifications, null).length, 0);
});
