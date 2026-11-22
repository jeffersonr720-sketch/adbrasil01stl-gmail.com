import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LeaderNotification,
  LeaderUser,
  NotificationCategory,
  NotificationTargetTab
} from '../src/types/index.ts';
import { getSupabaseClient, isSupabaseFallbackError } from './supabaseClient.ts';

const TABLE_RETRY_COOLDOWN_MS = 15000;
const MAX_LOCAL_NOTIFICATIONS = 200;

interface NotificationRow {
  id: string;
  category: NotificationCategory;
  ministry_id: string | null;
  title: string;
  message: string;
  target_tab: NotificationTargetTab;
  target_id: string | null;
  actor_name: string;
  read_by: unknown;
  created_at: number | string;
}

export interface CreateNotificationInput {
  category: NotificationCategory;
  ministryId: string | null;
  title: string;
  message: string;
  targetTab: NotificationTargetTab;
  targetId?: string | null;
  actorName: string;
  createdAt?: number;
}

export function filterNotificationsForUser(
  notifications: LeaderNotification[],
  user: LeaderUser | null
): LeaderNotification[] {
  if (!user || !user.active) return [];
  const list =
    user.role === 'admin'
      ? notifications
      : notifications.filter(
          (item) => item.ministryId === null || item.ministryId === user.ministryId
        );

  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

export function countUnreadNotificationsForUser(
  notifications: LeaderNotification[],
  user: LeaderUser | null
): number {
  if (!user || !user.active) return 0;
  return filterNotificationsForUser(notifications, user).filter(
    (item) => !item.readBy.includes(user.id)
  ).length;
}

function rowToNotification(row: NotificationRow): LeaderNotification {
  return {
    id: String(row.id),
    category: row.category,
    ministryId: row.ministry_id ?? null,
    title: String(row.title),
    message: String(row.message),
    targetTab: row.target_tab || 'schedules',
    targetId: row.target_id ?? null,
    actorName: String(row.actor_name || 'Coordenação Geral'),
    readBy: Array.isArray(row.read_by) ? row.read_by.map(String) : [],
    createdAt: Number(row.created_at) || Date.now()
  };
}

function notificationToRow(item: LeaderNotification): NotificationRow {
  return {
    id: item.id,
    category: item.category,
    ministry_id: item.ministryId,
    title: item.title,
    message: item.message,
    target_tab: item.targetTab,
    target_id: item.targetId ?? null,
    actor_name: item.actorName,
    read_by: item.readBy,
    created_at: item.createdAt
  };
}

export function getInitialSeedNotifications(nowMs: number = Date.now()): LeaderNotification[] {
  return [
    {
      id: 'notif-seed-culto-domingo',
      category: 'service',
      ministryId: null,
      title: 'Culto de Domingo Noite confirmado',
      message: 'Reunião de oração com as equipes às 18h15 antes do culto das 19h.',
      targetTab: 'schedules',
      targetId: 'sch-proximo-domingo-noite',
      actorName: 'Pr. Lucas Ribeiro',
      createdAt: nowMs - 25 * 60_000,
      readBy: []
    },
    {
      id: 'notif-seed-culto-jovens',
      category: 'service',
      ministryId: null,
      title: 'Culto de Jovens Conectados (19h30)',
      message: 'Passagem de som programada para 18h00 no templo principal.',
      targetTab: 'services',
      targetId: 'srv-sabado-jovens',
      actorName: 'Pr. Lucas Ribeiro',
      createdAt: nowMs - 2 * 3_600_000,
      readBy: []
    },
    {
      id: 'notif-seed-louvor',
      category: 'schedule',
      ministryId: 'min-louvor',
      title: 'Pendência na escala de Louvor & Adoração',
      message: '1 músico ainda aguarda confirmação de presença para o Culto de Domingo Noite.',
      targetTab: 'schedules',
      targetId: 'sch-proximo-domingo-noite',
      actorName: 'Camila Fernandes',
      createdAt: nowMs - 45 * 60_000,
      readBy: []
    },
    {
      id: 'notif-seed-midia',
      category: 'ministry',
      ministryId: 'min-midia',
      title: 'Postos de Mídia & Transmissão revisados',
      message: 'Função "Transmissão Online / Live" atualizada para o culto de sábado.',
      targetTab: 'ministries',
      targetId: 'min-midia',
      actorName: 'Beatriz Lima',
      createdAt: nowMs - 90 * 60_000,
      readBy: []
    },
    {
      id: 'notif-seed-recepcao',
      category: 'schedule',
      ministryId: 'min-recepcao',
      title: 'Equipe de Recepção escalada',
      message: 'Portas A e B confirmadas para o próximo culto de domingo.',
      targetTab: 'schedules',
      targetId: 'sch-proximo-domingo-noite',
      actorName: 'Juliana Barbosa',
      createdAt: nowMs - 3 * 3_600_000,
      readBy: []
    },
    {
      id: 'notif-seed-infantil',
      category: 'schedule',
      ministryId: 'min-infantil',
      title: 'Escala do Ministério Infantil aberta',
      message: 'Confira os voluntários de Berçário e Maternal para o próximo fim de semana.',
      targetTab: 'schedules',
      targetId: 'sch-sabado-jovens',
      actorName: 'Tia Débora Santos',
      createdAt: nowMs - 5 * 3_600_000,
      readBy: []
    },
    {
      id: 'notif-seed-diaconato',
      category: 'schedule',
      ministryId: 'min-diaconato',
      title: 'Apoio ao Altar e Santa Ceia',
      message: 'Escala do Diaconato atualizada para o culto de domingo às 19h.',
      targetTab: 'schedules',
      targetId: 'sch-proximo-domingo-noite',
      actorName: 'Diácono Paulo Andrade',
      createdAt: nowMs - 6 * 3_600_000,
      readBy: []
    }
  ];
}

export class NotificationStore {
  private dbPath: string;
  private overrideClient?: SupabaseClient | null;
  private missingTableUntil = 0;
  private warnedMissingTable = false;

  constructor(options: { dataDir?: string; supabaseClient?: SupabaseClient | null } = {}) {
    const dataDir = options.dataDir ?? path.resolve(process.cwd(), '.data');
    fs.mkdirSync(dataDir, { recursive: true });
    this.dbPath = path.join(dataDir, 'notifications.json');
    this.overrideClient = options.supabaseClient;
  }

  resetSupabaseCooldown(): void {
    this.missingTableUntil = 0;
  }

  private getClient(): SupabaseClient | null {
    if (Date.now() < this.missingTableUntil) {
      return null;
    }
    if (this.overrideClient !== undefined) {
      return this.overrideClient;
    }
    return getSupabaseClient();
  }

  private markSupabaseUnavailable(label: string, error?: unknown): false {
    this.missingTableUntil = Date.now() + TABLE_RETRY_COOLDOWN_MS;
    if (!this.warnedMissingTable) {
      this.warnedMissingTable = true;
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code || '')
          : '';
      console.warn(
        `[Supabase] ${label}${code ? ` (${code})` : ''}; usando notificações locais.`
      );
    }
    return false;
  }

  private markMissingTableIfApplicable(
    error: { code?: string | null; message?: string | null } | null | undefined
  ): boolean {
    if (!isSupabaseFallbackError(error)) return false;
    this.markSupabaseUnavailable('Tabela notifications indisponível ou inacessível', error);
    return true;
  }

  private readLocalDb(): LeaderNotification[] {
    if (!fs.existsSync(this.dbPath)) {
      const seed = getInitialSeedNotifications();
      fs.writeFileSync(this.dbPath, JSON.stringify(seed, null, 2), 'utf8');
      return seed;
    }
    const raw = fs.readFileSync(this.dbPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LeaderNotification[]) : [];
  }

  private writeLocalDb(items: LeaderNotification[]): void {
    const trimmed = [...items]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_LOCAL_NOTIFICATIONS);
    fs.writeFileSync(this.dbPath, JSON.stringify(trimmed, null, 2), 'utf8');
  }

  private async ensureSupabaseReady(client: SupabaseClient): Promise<boolean> {
    try {
      const { data, error } = await client.from('notifications').select('id').limit(1);
      if (error) {
        return this.markSupabaseUnavailable('Tabela notifications ainda não pronta', error);
      }
      if (!data || data.length === 0) {
        const seed = getInitialSeedNotifications();
        const { error: seedError } = await client
          .from('notifications')
          .upsert(seed.map(notificationToRow));
        if (seedError) {
          return this.markSupabaseUnavailable(
            'Não foi possível inicializar notificações no Supabase',
            seedError
          );
        }
      }
      return true;
    } catch (err) {
      return this.markSupabaseUnavailable('Falha de conexão com Supabase', err);
    }
  }

  private async getReadySupabaseClient(): Promise<SupabaseClient | null> {
    const client = this.getClient();
    if (!client) return null;
    const ready = await this.ensureSupabaseReady(client);
    return ready ? client : null;
  }

  private async listAll(): Promise<LeaderNotification[]> {
    const client = await this.getReadySupabaseClient();
    if (!client) {
      return this.readLocalDb();
    }

    const { data, error } = await client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      if (this.markMissingTableIfApplicable(error)) {
        return this.readLocalDb();
      }
      throw new Error(error.message);
    }

    return ((data || []) as NotificationRow[]).map(rowToNotification);
  }

  async listForUser(user: LeaderUser): Promise<{
    notifications: LeaderNotification[];
    unreadCount: number;
  }> {
    const all = await this.listAll();
    const notifications = filterNotificationsForUser(all, user);
    const unreadCount = notifications.filter((item) => !item.readBy.includes(user.id)).length;
    return { notifications, unreadCount };
  }

  async createNotification(input: CreateNotificationInput): Promise<LeaderNotification> {
    const notification: LeaderNotification = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      category: input.category,
      ministryId: input.ministryId,
      title: input.title,
      message: input.message,
      targetTab: input.targetTab,
      targetId: input.targetId ?? null,
      actorName: input.actorName || 'Coordenação Geral',
      createdAt: input.createdAt ?? Date.now(),
      readBy: []
    };

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const current = this.readLocalDb();
      this.writeLocalDb([notification, ...current]);
      return notification;
    }

    const { error } = await client
      .from('notifications')
      .upsert(notificationToRow(notification));

    if (error) {
      if (this.markMissingTableIfApplicable(error)) {
        const current = this.readLocalDb();
        this.writeLocalDb([notification, ...current]);
        return notification;
      }
      throw new Error(error.message);
    }

    return notification;
  }

  async markAsRead(
    notificationId: string,
    user: LeaderUser
  ): Promise<
    | { ok: true; notification: LeaderNotification }
    | { ok: false; status: number; reason: string }
  > {
    const all = await this.listAll();
    const target = all.find((item) => item.id === notificationId);
    if (!target) {
      return { ok: false, status: 404, reason: 'Notificação não encontrada.' };
    }

    const canAccess =
      user.role === 'admin' ||
      target.ministryId === null ||
      target.ministryId === user.ministryId;
    if (!canAccess) {
      return { ok: false, status: 403, reason: 'Sem permissão para acessar esta notificação.' };
    }

    const nextReadBy = target.readBy.includes(user.id)
      ? target.readBy
      : [...target.readBy, user.id];
    const updated: LeaderNotification = { ...target, readBy: nextReadBy };

    const client = await this.getReadySupabaseClient();
    if (!client) {
      this.writeLocalDb(all.map((item) => (item.id === notificationId ? updated : item)));
      return { ok: true, notification: updated };
    }

    const { error } = await client
      .from('notifications')
      .update({ read_by: nextReadBy })
      .eq('id', notificationId);

    if (error) {
      if (this.markMissingTableIfApplicable(error)) {
        this.writeLocalDb(all.map((item) => (item.id === notificationId ? updated : item)));
        return { ok: true, notification: updated };
      }
      return { ok: false, status: 500, reason: 'Erro ao atualizar notificação.' };
    }

    return { ok: true, notification: updated };
  }

  async markAllAsRead(user: LeaderUser): Promise<{ ok: true; updatedCount: number }> {
    const all = await this.listAll();
    const visible = filterNotificationsForUser(all, user);
    const unread = visible.filter((item) => !item.readBy.includes(user.id));
    if (unread.length === 0) {
      return { ok: true, updatedCount: 0 };
    }

    const unreadIds = new Set(unread.map((u) => u.id));
    const nextAll = all.map((item) =>
      unreadIds.has(item.id)
        ? { ...item, readBy: [...item.readBy, user.id] }
        : item
    );

    const client = await this.getReadySupabaseClient();
    if (!client) {
      this.writeLocalDb(nextAll);
      return { ok: true, updatedCount: unread.length };
    }

    const rowsToUpdate = nextAll
      .filter((item) => unreadIds.has(item.id))
      .map(notificationToRow);

    const { error } = await client.from('notifications').upsert(rowsToUpdate);
    if (error) {
      if (this.markMissingTableIfApplicable(error)) {
        this.writeLocalDb(nextAll);
        return { ok: true, updatedCount: unread.length };
      }
      throw new Error(error.message);
    }

    return { ok: true, updatedCount: unread.length };
  }
}
