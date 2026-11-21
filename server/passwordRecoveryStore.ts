import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PasswordResetRequest, PasswordResetStatus } from '../src/types/index.ts';
import type { LeaderRepository } from './leaderRepository.ts';
import { getSupabaseClient, isSupabaseFallbackError } from './supabaseClient.ts';

interface StoredPasswordResetRecord extends PasswordResetRequest {
  codeHash: string | null;
}

interface PasswordResetRow {
  id: string;
  leader_id: string;
  leader_login: string;
  leader_name: string;
  ministry_id: string | null;
  contact_note: string;
  code_hash: string | null;
  status: string;
  created_at: number | string;
  expires_at: number | string | null;
}

const CODE_TTL_MS = 30 * 60 * 1000; // 30 minutos
const TABLE_RETRY_COOLDOWN_MS = 15000;

function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

function sanitizeReset(rec: StoredPasswordResetRecord): PasswordResetRequest {
  const { codeHash: _omitted, ...safe } = rec;
  return safe;
}

function rowToReset(row: PasswordResetRow): StoredPasswordResetRecord {
  const status: PasswordResetStatus =
    row.status === 'code_issued'
      ? 'code_issued'
      : row.status === 'completed'
      ? 'completed'
      : 'pending';
  return {
    id: row.id,
    leaderId: row.leader_id,
    leaderLogin: row.leader_login,
    leaderName: row.leader_name,
    ministryId: row.ministry_id ?? null,
    contactNote: row.contact_note || '',
    codeHash: row.code_hash ?? null,
    status,
    createdAt: Number(row.created_at) || Date.now(),
    expiresAt: row.expires_at !== null && row.expires_at !== undefined ? Number(row.expires_at) : null
  };
}

function resetToRow(rec: StoredPasswordResetRecord): PasswordResetRow {
  return {
    id: rec.id,
    leader_id: rec.leaderId,
    leader_login: rec.leaderLogin,
    leader_name: rec.leaderName,
    ministry_id: rec.ministryId,
    contact_note: rec.contactNote,
    code_hash: rec.codeHash,
    status: rec.status,
    created_at: rec.createdAt,
    expires_at: rec.expiresAt ?? null
  };
}

export class PasswordRecoveryStore {
  private dbPath: string;
  private leaderRepo: LeaderRepository;
  private overrideClient?: SupabaseClient | null;
  private missingTableUntil = 0;
  private warnedMissingTable = false;

  constructor(options: {
    leaderRepo: LeaderRepository;
    dataDir?: string;
    supabaseClient?: SupabaseClient | null;
  }) {
    this.leaderRepo = options.leaderRepo;
    const dataDir = options.dataDir ?? path.resolve(process.cwd(), '.data');
    fs.mkdirSync(dataDir, { recursive: true });
    this.dbPath = path.join(dataDir, 'password-resets.json');
    this.overrideClient = options.supabaseClient;
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
    this.markSupabaseUnavailable('Tabela "password_resets" indisponível ou banco inacessível', error);
    return true;
  }

  private async ensureSupabaseReady(client: SupabaseClient): Promise<boolean> {
    try {
      const { error } = await client.from('password_resets').select('id').limit(1);
      if (error) {
        return this.markSupabaseUnavailable('Tabela "password_resets" ainda não pronta', error);
      }
      return true;
    } catch (err) {
      return this.markSupabaseUnavailable('Falha de conexão com Supabase', err);
    }
  }

  private readLocal(): StoredPasswordResetRecord[] {
    if (!fs.existsSync(this.dbPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(this.dbPath, 'utf8');
      const parsed = JSON.parse(raw) as StoredPasswordResetRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeLocal(records: StoredPasswordResetRecord[]): void {
    fs.writeFileSync(this.dbPath, JSON.stringify(records, null, 2), 'utf8');
  }

  private listActiveLocal(): PasswordResetRequest[] {
    return this.readLocal()
      .filter((r) => r.status !== 'completed')
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(sanitizeReset);
  }

  private saveLocalPending(record: StoredPasswordResetRecord): void {
    const existing = this.readLocal().filter(
      (r) => !(r.leaderId === record.leaderId && r.status !== 'completed')
    );
    existing.unshift(record);
    this.writeLocal(existing);
  }

  private saveLocalIssued(record: StoredPasswordResetRecord): void {
    const existing = this.readLocal();
    const prevNote = existing.find(
      (r) => r.leaderId === record.leaderId && r.status !== 'completed'
    )?.contactNote;
    if (prevNote) record.contactNote = prevNote;
    const filtered = existing.filter(
      (r) => !(r.leaderId === record.leaderId && r.status !== 'completed')
    );
    filtered.unshift(record);
    this.writeLocal(filtered);
  }

  async listActiveRequests(): Promise<PasswordResetRequest[]> {
    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseReady(client))) {
      return this.listActiveLocal();
    }

    const { data, error } = await client
      .from('password_resets')
      .select('*')
      .neq('status', 'completed')
      .order('created_at', { ascending: false });
    if (error) {
      if (this.markMissingTableIfApplicable(error)) {
        return this.listActiveLocal();
      }
      throw new Error(error.message);
    }
    return ((data || []) as PasswordResetRow[]).map(rowToReset).map(sanitizeReset);
  }

  async requestRecovery(params: {
    identifier: string;
    contactNote?: string;
  }): Promise<
    | { ok: true; request: PasswordResetRequest }
    | { ok: false; status: number; reason: string }
  > {
    const clean = params.identifier.trim().toLowerCase();
    if (clean.length < 2) {
      return { ok: false, status: 400, reason: 'Informe seu login ou e-mail cadastrado.' };
    }

    const leader = await this.leaderRepo.findByIdentifier(clean);
    if (!leader) {
      return {
        ok: false,
        status: 404,
        reason: 'Não encontramos nenhum líder cadastrado com este login ou e-mail.'
      };
    }
    if (!leader.active) {
      return {
        ok: false,
        status: 403,
        reason: 'Este acesso está desativado. Procure a Coordenação Geral.'
      };
    }

    const record: StoredPasswordResetRecord = {
      id: `rst-${crypto.randomUUID().slice(0, 8)}`,
      leaderId: leader.id,
      leaderLogin: leader.login,
      leaderName: leader.name,
      ministryId: leader.ministryId,
      contactNote: (params.contactNote || '').trim(),
      codeHash: null,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: null
    };

    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseReady(client))) {
      this.saveLocalPending(record);
      return { ok: true, request: sanitizeReset(record) };
    }

    const { error: delError } = await client
      .from('password_resets')
      .delete()
      .eq('leader_id', leader.id)
      .neq('status', 'completed');
    if (delError && this.markMissingTableIfApplicable(delError)) {
      this.saveLocalPending(record);
      return { ok: true, request: sanitizeReset(record) };
    }

    const { error } = await client.from('password_resets').upsert(resetToRow(record));
    if (error) {
      if (this.markMissingTableIfApplicable(error)) {
        this.saveLocalPending(record);
        return { ok: true, request: sanitizeReset(record) };
      }
      return { ok: false, status: 500, reason: 'Erro ao registrar solicitação no banco.' };
    }
    return { ok: true, request: sanitizeReset(record) };
  }

  async issueRecoveryCode(leaderId: string): Promise<
    | { ok: true; code: string; request: PasswordResetRequest }
    | { ok: false; status: number; reason: string }
  > {
    const leader = await this.leaderRepo.findById(leaderId);
    if (!leader) {
      return { ok: false, status: 404, reason: 'Líder não encontrado.' };
    }
    if (!leader.active) {
      return { ok: false, status: 400, reason: 'Não é possível gerar código para acesso inativo.' };
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const now = Date.now();
    const record: StoredPasswordResetRecord = {
      id: `rst-${crypto.randomUUID().slice(0, 8)}`,
      leaderId: leader.id,
      leaderLogin: leader.login,
      leaderName: leader.name,
      ministryId: leader.ministryId,
      contactNote: '',
      codeHash: hashRecoveryCode(code),
      status: 'code_issued',
      createdAt: now,
      expiresAt: now + CODE_TTL_MS
    };

    const client = this.getClient();
    if (!client || !(await this.ensureSupabaseReady(client))) {
      this.saveLocalIssued(record);
      return { ok: true, code, request: sanitizeReset(record) };
    }

    const { data: prevRows, error: prevErr } = await client
      .from('password_resets')
      .select('contact_note')
      .eq('leader_id', leader.id)
      .neq('status', 'completed')
      .limit(1);
    if (prevErr && this.markMissingTableIfApplicable(prevErr)) {
      this.saveLocalIssued(record);
      return { ok: true, code, request: sanitizeReset(record) };
    }
    if (prevRows && prevRows[0]?.contact_note) {
      record.contactNote = String(prevRows[0].contact_note);
    }

    await client
      .from('password_resets')
      .delete()
      .eq('leader_id', leader.id)
      .neq('status', 'completed');

    const { error } = await client.from('password_resets').upsert(resetToRow(record));
    if (error) {
      if (this.markMissingTableIfApplicable(error)) {
        this.saveLocalIssued(record);
        return { ok: true, code, request: sanitizeReset(record) };
      }
      return { ok: false, status: 500, reason: 'Erro ao gerar código de recuperação.' };
    }
    return { ok: true, code, request: sanitizeReset(record) };
  }

  async confirmRecoveryReset(params: {
    identifier: string;
    code: string;
    newPassword: string;
  }): Promise<{ ok: true; login: string } | { ok: false; status: number; reason: string }> {
    const cleanCode = params.code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return { ok: false, status: 400, reason: 'O código de verificação deve conter 6 dígitos.' };
    }
    if (!params.newPassword || params.newPassword.length < 6) {
      return { ok: false, status: 400, reason: 'A nova senha deve ter pelo menos 6 caracteres.' };
    }

    const leader = await this.leaderRepo.findByIdentifier(params.identifier);
    if (!leader || !leader.active) {
      return { ok: false, status: 404, reason: 'Acesso não encontrado ou inativo.' };
    }

    let client = this.getClient();
    let activeRecord: StoredPasswordResetRecord | undefined;

    if (!client || !(await this.ensureSupabaseReady(client))) {
      client = null;
      activeRecord = this.readLocal().find(
        (r) => r.leaderId === leader.id && r.status === 'code_issued'
      );
    } else {
      const { data, error } = await client
        .from('password_resets')
        .select('*')
        .eq('leader_id', leader.id)
        .eq('status', 'code_issued')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error && this.markMissingTableIfApplicable(error)) {
        client = null;
        activeRecord = this.readLocal().find(
          (r) => r.leaderId === leader.id && r.status === 'code_issued'
        );
      } else if (data && data[0]) {
        activeRecord = rowToReset(data[0] as PasswordResetRow);
      }
    }

    if (!activeRecord || !activeRecord.codeHash) {
      return {
        ok: false,
        status: 400,
        reason: 'Nenhum código de recuperação ativo foi emitido para este login.'
      };
    }

    if (activeRecord.expiresAt && Date.now() > activeRecord.expiresAt) {
      return {
        ok: false,
        status: 400,
        reason: 'Este código expirou. Solicite um novo código à Coordenação Geral.'
      };
    }

    const providedHashBuf = Buffer.from(hashRecoveryCode(cleanCode), 'utf8');
    const expectedHashBuf = Buffer.from(activeRecord.codeHash, 'utf8');
    if (
      providedHashBuf.length !== expectedHashBuf.length ||
      !crypto.timingSafeEqual(providedHashBuf, expectedHashBuf)
    ) {
      return { ok: false, status: 401, reason: 'Código de verificação inválido.' };
    }

    const resetRes = await this.leaderRepo.resetPasswordById(leader.id, params.newPassword);
    if (!resetRes.ok) {
      return resetRes;
    }

    if (!client) {
      const all = this.readLocal().map((r) =>
        r.id === activeRecord!.id ? { ...r, status: 'completed' as const, codeHash: null } : r
      );
      this.writeLocal(all);
    } else {
      await client
        .from('password_resets')
        .update({ status: 'completed', code_hash: null })
        .eq('id', activeRecord.id);
    }

    return { ok: true, login: leader.login };
  }
}
