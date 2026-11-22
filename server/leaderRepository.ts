import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateLeaderPayload,
  LeaderUser,
  UpdateLeaderPayload
} from '../src/types/index.ts';
import {
  buildDefaultSeedLeaders,
  hashPassword,
  LeaderAuthStore,
  sanitizeLeader,
  signSessionToken,
  type StoredLeaderRecord,
  verifyPassword,
  verifySessionToken
} from './authStore.ts';
import { leaderToRow, type LeaderRow, rowToLeader } from './dbMappers.ts';
import { getSupabaseClient, isSupabaseFallbackError } from './supabaseClient.ts';

const TABLE_RETRY_COOLDOWN_MS = 15000;

export class LeaderRepository {
  private localStore: LeaderAuthStore;
  private overrideClient?: SupabaseClient | null;
  private missingTableUntil = 0;
  private warnedMissingTable = false;

  constructor(options: { dataDir?: string; supabaseClient?: SupabaseClient | null } = {}) {
    this.localStore = new LeaderAuthStore(options.dataDir);
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
        `[Supabase] ${label}${code ? ` (${code})` : ''}; usando armazenamento local temporário.`
      );
    }
    return false;
  }

  private markMissingTableIfApplicable(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
    if (!isSupabaseFallbackError(error)) return false;
    this.markSupabaseUnavailable('Tabela "leaders" indisponível ou banco inacessível', error);
    return true;
  }

  private async ensureSupabaseSeeded(client: SupabaseClient): Promise<boolean> {
    try {
      const { data, error } = await client.from('leaders').select('id').limit(1);
      if (error) {
        return this.markSupabaseUnavailable('Tabela "leaders" ainda não pronta', error);
      }
      if (data && data.length > 0) return true;

      const defaults = buildDefaultSeedLeaders().map(leaderToRow);
      const { error: insertError } = await client.from('leaders').upsert(defaults);
      if (insertError) {
        return this.markSupabaseUnavailable('Não foi possível inicializar "leaders"', insertError);
      }
      return true;
    } catch (err) {
      return this.markSupabaseUnavailable('Falha de conexão com Supabase', err);
    }
  }

  private async getReadySupabaseClient(): Promise<SupabaseClient | null> {
    const client = this.getClient();
    if (!client) return null;
    const ready = await this.ensureSupabaseSeeded(client);
    return ready ? client : null;
  }

  async listLeaders(): Promise<LeaderUser[]> {
    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseSeeded(client))) {
      return this.localStore.listLeaders();
    }
    const { data, error } = await client
      .from('leaders')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      if (this.markMissingTableIfApplicable(error)) return this.localStore.listLeaders();
      throw new Error(error.message);
    }
    return ((data || []) as LeaderRow[]).map(rowToLeader).map(sanitizeLeader);
  }

  async findById(id: string): Promise<LeaderUser | null> {
    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseSeeded(client))) {
      return this.localStore.findById(id);
    }
    const { data, error } = await client.from('leaders').select('*').eq('id', id).maybeSingle();
    if (error && this.markMissingTableIfApplicable(error)) {
      return this.localStore.findById(id);
    }
    if (!data) return null;
    return sanitizeLeader(rowToLeader(data as LeaderRow));
  }

  async findByIdentifier(identifier: string): Promise<LeaderUser | null> {
    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseSeeded(client))) {
      return this.localStore.findByIdentifier(identifier);
    }
    const normalized = identifier.trim().toLowerCase();
    if (!normalized) return null;
    const { data, error } = await client.from('leaders').select('*');
    if (error) {
      if (this.markMissingTableIfApplicable(error)) {
        return this.localStore.findByIdentifier(identifier);
      }
      throw new Error(error.message);
    }
    const records = ((data || []) as LeaderRow[]).map(rowToLeader);
    const found = records.find(
      (l) => l.login.toLowerCase() === normalized || (l.email && l.email.toLowerCase() === normalized)
    );
    return found ? sanitizeLeader(found) : null;
  }

  async resetPasswordById(
    userId: string,
    newPassword: string
  ): Promise<{ ok: true } | { ok: false; reason: string; status: number }> {
    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseSeeded(client))) {
      return this.localStore.resetPasswordById(userId, newPassword);
    }
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, reason: 'A nova senha deve ter pelo menos 6 caracteres.', status: 400 };
    }
    const { error } = await client
      .from('leaders')
      .update({ password_hash: hashPassword(newPassword) })
      .eq('id', userId);
    if (error) {
      if (this.markMissingTableIfApplicable(error)) {
        return this.localStore.resetPasswordById(userId, newPassword);
      }
      return { ok: false, reason: 'Erro ao redefinir senha no banco.', status: 500 };
    }
    return { ok: true };
  }

  async authenticate(
    identifier: string,
    password: string
  ): Promise<{ ok: true; user: LeaderUser; token: string } | { ok: false; reason: string; status: number }> {
    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseSeeded(client))) {
      return this.localStore.authenticate(identifier, password);
    }

    const normalized = identifier.trim().toLowerCase();
    if (!normalized || !password) {
      return { ok: false, reason: 'Informe login e senha para acessar.', status: 400 };
    }

    const { data, error } = await client.from('leaders').select('*');
    if (error) {
      if (this.markMissingTableIfApplicable(error)) {
        return this.localStore.authenticate(identifier, password);
      }
      return { ok: false, reason: 'Erro ao validar acesso no servidor.', status: 500 };
    }

    const records = ((data || []) as LeaderRow[]).map(rowToLeader);
    const record = records.find(
      (l) => l.login.toLowerCase() === normalized || (l.email && l.email.toLowerCase() === normalized)
    );

    if (!record || !verifyPassword(password, record.passwordHash)) {
      return { ok: false, reason: 'Login ou senha incorretos.', status: 401 };
    }
    if (!record.active) {
      return {
        ok: false,
        reason: 'Este acesso está desativado. Procure a Coordenação Geral.',
        status: 403
      };
    }

    const now = Date.now();
    await client.from('leaders').update({ last_login_at: now }).eq('id', record.id);
    const safeUser = sanitizeLeader({ ...record, lastLoginAt: now });
    const token = signSessionToken(safeUser, this.localStore.getSecret());
    return { ok: true, user: safeUser, token };
  }

  async verifyToken(token: string): Promise<LeaderUser | null> {
    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseSeeded(client))) {
      return this.localStore.verifyToken(token);
    }

    const payload = verifySessionToken(token, this.localStore.getSecret());
    if (!payload) return null;
    const found = await this.findById(payload.sub);
    if (!found || !found.active) return null;
    return found;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ ok: true } | { ok: false; reason: string; status: number }> {
    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseSeeded(client))) {
      return this.localStore.changePassword(userId, currentPassword, newPassword);
    }

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return { ok: false, reason: 'A nova senha deve ter pelo menos 6 caracteres.', status: 400 };
    }

    const { data, error: fetchError } = await client.from('leaders').select('*').eq('id', userId).maybeSingle();
    if (fetchError && this.markMissingTableIfApplicable(fetchError)) {
      return this.localStore.changePassword(userId, currentPassword, newPassword);
    }
    if (!data) {
      return { ok: false, reason: 'Usuário não encontrado.', status: 404 };
    }

    const record = rowToLeader(data as LeaderRow);
    if (!verifyPassword(currentPassword, record.passwordHash)) {
      return { ok: false, reason: 'A senha atual está incorreta.', status: 401 };
    }

    const { error } = await client
      .from('leaders')
      .update({ password_hash: hashPassword(newPassword) })
      .eq('id', userId);
    if (error) {
      return { ok: false, reason: 'Erro ao atualizar a senha.', status: 500 };
    }
    return { ok: true };
  }

  async createLeader(
    payload: CreateLeaderPayload
  ): Promise<{ ok: true; leader: LeaderUser } | { ok: false; reason: string; status: number }> {
    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseSeeded(client))) {
      return this.localStore.createLeader(payload);
    }

    const cleanLogin = payload.login.trim().toLowerCase();
    const cleanEmail = payload.email.trim().toLowerCase();
    if (!payload.name.trim() || !cleanLogin || !payload.password || payload.password.length < 6) {
      return {
        ok: false,
        reason: 'Preencha nome, login válido e senha com no mínimo 6 caracteres.',
        status: 400
      };
    }

    if (!/^[a-z0-9._-]+$/.test(cleanLogin)) {
      return {
        ok: false,
        reason: 'Login inválido. Use letras, números, ponto, hífen ou _.',
        status: 400
      };
    }

    await this.ensureSupabaseSeeded(client);
    const { data: existingData } = await client.from('leaders').select('*');
    const existing = ((existingData || []) as LeaderRow[]).map(rowToLeader);
    const duplicate = existing.find(
      (l) =>
        l.login.toLowerCase() === cleanLogin ||
        (cleanEmail && l.email && l.email.toLowerCase() === cleanEmail)
    );
    if (duplicate) {
      return { ok: false, reason: 'Já existe um líder cadastrado com este login ou e-mail.', status: 409 };
    }

    const newRecord: StoredLeaderRecord = {
      id: `ldr-${crypto.randomUUID().slice(0, 8)}`,
      name: payload.name.trim(),
      login: cleanLogin,
      email: cleanEmail,
      cargo: payload.cargo.trim() || (payload.role === 'admin' ? 'Coordenação Geral' : 'Líder de Departamento'),
      role: payload.role,
      ministryId: payload.role === 'admin' ? null : payload.ministryId,
      active: true,
      createdAt: Date.now(),
      passwordHash: hashPassword(payload.password)
    };

    const { error } = await client.from('leaders').upsert(leaderToRow(newRecord));
    if (error) {
      return { ok: false, reason: 'Erro ao salvar líder no banco.', status: 500 };
    }
    return { ok: true, leader: sanitizeLeader(newRecord) };
  }

  async updateLeader(
    targetId: string,
    payload: UpdateLeaderPayload,
    actingUserId: string
  ): Promise<{ ok: true; leader: LeaderUser } | { ok: false; reason: string; status: number }> {
    const client = await this.getReadySupabaseClient();
    if (!client) {
      return this.localStore.updateLeader(targetId, payload, actingUserId);
    }

    const { data: existingData, error: fetchError } = await client.from('leaders').select('*');
    if (fetchError && this.markMissingTableIfApplicable(fetchError)) {
      return this.localStore.updateLeader(targetId, payload, actingUserId);
    }
    const leaders = ((existingData || []) as LeaderRow[]).map(rowToLeader);
    const target = leaders.find((l) => l.id === targetId);
    if (!target) {
      return { ok: false, reason: 'Líder não encontrado.', status: 404 };
    }

    if (payload.login !== undefined) {
      const cleanLogin = payload.login.trim().toLowerCase();
      if (!/^[a-z0-9._-]+$/.test(cleanLogin) || cleanLogin.length < 3) {
        return { ok: false, reason: 'Login inválido (mínimo 3 caracteres sem espaços).', status: 400 };
      }
      const conflict = leaders.find((l) => l.id !== targetId && l.login.toLowerCase() === cleanLogin);
      if (conflict) {
        return { ok: false, reason: 'Este login já está em uso por outro líder.', status: 409 };
      }
      target.login = cleanLogin;
    }

    if (payload.email !== undefined) {
      const cleanEmail = payload.email.trim().toLowerCase();
      if (cleanEmail) {
        const conflict = leaders.find(
          (l) => l.id !== targetId && l.email && l.email.toLowerCase() === cleanEmail
        );
        if (conflict) {
          return { ok: false, reason: 'Este e-mail já está em uso por outro líder.', status: 409 };
        }
      }
      target.email = cleanEmail;
    }

    if (payload.name !== undefined && payload.name.trim()) {
      target.name = payload.name.trim();
    }
    if (payload.cargo !== undefined) {
      target.cargo = payload.cargo.trim();
    }
    if (payload.role !== undefined) {
      if (target.id === actingUserId && payload.role !== 'admin') {
        return {
          ok: false,
          reason: 'Você não pode remover seu próprio acesso de Coordenação Geral.',
          status: 400
        };
      }
      target.role = payload.role;
      if (payload.role === 'admin') {
        target.ministryId = null;
      }
    }
    if (payload.ministryId !== undefined && target.role !== 'admin') {
      target.ministryId = payload.ministryId;
    }
    if (payload.active !== undefined) {
      if (target.id === actingUserId && !payload.active) {
        return {
          ok: false,
          reason: 'Você não pode desativar o seu próprio usuário conectado.',
          status: 400
        };
      }
      target.active = payload.active;
    }
    if (payload.password !== undefined && payload.password.length > 0) {
      if (payload.password.length < 6) {
        return { ok: false, reason: 'A nova senha deve ter pelo menos 6 caracteres.', status: 400 };
      }
      target.passwordHash = hashPassword(payload.password);
    }

    const { error } = await client.from('leaders').upsert(leaderToRow(target));
    if (error) {
      return { ok: false, reason: 'Erro ao atualizar líder no banco.', status: 500 };
    }
    return { ok: true, leader: sanitizeLeader(target) };
  }

  async deleteLeader(
    targetId: string,
    actingUserId: string
  ): Promise<{ ok: true } | { ok: false; reason: string; status: number }> {
    const client = await this.getReadySupabaseClient();
    if (!client) {
      return this.localStore.deleteLeader(targetId, actingUserId);
    }

    if (targetId === actingUserId) {
      return { ok: false, reason: 'Você não pode excluir o seu próprio acesso.', status: 400 };
    }

    const { data: existingData, error: fetchError } = await client.from('leaders').select('*');
    if (fetchError && this.markMissingTableIfApplicable(fetchError)) {
      return this.localStore.deleteLeader(targetId, actingUserId);
    }
    const leaders = ((existingData || []) as LeaderRow[]).map(rowToLeader);
    const target = leaders.find((l) => l.id === targetId);
    if (!target) {
      return { ok: false, reason: 'Líder não encontrado.', status: 404 };
    }

    const activeAdmins = leaders.filter((l) => l.role === 'admin' && l.active);
    if (target.role === 'admin' && activeAdmins.length <= 1) {
      return {
        ok: false,
        reason: 'Deve existir ao menos um administrador ativo no sistema.',
        status: 400
      };
    }

    const { error } = await client.from('leaders').delete().eq('id', targetId);
    if (error) {
      return { ok: false, reason: 'Erro ao excluir líder.', status: 500 };
    }
    return { ok: true };
  }
}
