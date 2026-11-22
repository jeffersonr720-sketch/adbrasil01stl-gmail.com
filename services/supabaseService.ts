import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Assignment, Member, Schedule } from '../src/types/index.ts';
import {
  type MemberRow,
  type ScheduleRow,
  memberToRow,
  rowToMember,
  rowToSchedule,
  scheduleToRow
} from '../server/dbMappers.ts';

export type SupabaseKeyKind = 'service_role' | 'anon' | 'none';

export interface SupabaseEnvConfig {
  url: string;
  key: string;
  keyKind: SupabaseKeyKind;
}

export interface SupabaseConnectionStatus {
  authenticated: boolean;
  keyKind: SupabaseKeyKind;
  urlHost: string | null;
  tablesReady: {
    members: boolean;
    schedules: boolean;
  };
  errorMessage?: string;
}

export type ServiceCrudResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; reason: string; code?: string };

export type CreateMemberInput = Omit<Member, 'id'> & { id?: string; sortOrder?: number };
export type UpdateMemberInput = Partial<Omit<Member, 'id'>>;

export type CreateScheduleInput = Omit<Schedule, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: number;
};
export type UpdateScheduleInput = Partial<Omit<Schedule, 'id' | 'createdAt'>>;

let cachedServiceClient: SupabaseClient | null = null;
let cachedServiceSignature = '';

function cleanEnvString(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '').trim();
  if (
    !trimmed ||
    trimmed.startsWith('MY_SUPABASE') ||
    trimmed.startsWith('YOUR_SUPABASE') ||
    trimmed.includes('your-project.supabase.co')
  ) {
    return '';
  }
  return trimmed;
}

function readEnvValue(keys: string[]): string {
  const procEnv =
    typeof process !== 'undefined' && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};
  const viteEnv =
    typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, unknown> }).env
      ? ((import.meta as { env?: Record<string, unknown> }).env as Record<string, unknown>)
      : {};

  for (const key of keys) {
    const fromProc = cleanEnvString(procEnv[key]);
    if (fromProc) return fromProc;
    const fromVite = cleanEnvString(viteEnv[key]);
    if (fromVite) return fromVite;
  }
  return '';
}

export function resolveSupabaseEnvConfig(): SupabaseEnvConfig | null {
  const url = readEnvValue(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
  const serviceRoleKey = readEnvValue(['SUPABASE_SERVICE_ROLE_KEY']);
  const anonKey = readEnvValue(['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']);

  const key = serviceRoleKey || anonKey;
  const keyKind: SupabaseKeyKind = serviceRoleKey
    ? 'service_role'
    : anonKey
      ? 'anon'
      : 'none';

  if (!url || !key || !/^https?:\/\//i.test(url)) {
    return null;
  }

  return { url, key, keyKind };
}

export function getSupabaseServiceClient(): {
  client: SupabaseClient;
  keyKind: SupabaseKeyKind;
  urlHost: string | null;
} | null {
  const config = resolveSupabaseEnvConfig();
  if (!config) {
    cachedServiceClient = null;
    cachedServiceSignature = '';
    return null;
  }

  const signature = `${config.url}::${config.key}`;
  if (!cachedServiceClient || cachedServiceSignature !== signature) {
    cachedServiceClient = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    cachedServiceSignature = signature;
  }

  let urlHost: string | null = null;
  try {
    urlHost = new URL(config.url).host;
  } catch {
    urlHost = null;
  }

  return {
    client: cachedServiceClient,
    keyKind: config.keyKind,
    urlHost
  };
}

function mapSupabaseErrorStatus(error: { code?: string | null; message?: string | null }): number {
  const code = String(error.code || '').toUpperCase();
  if (code === 'PGRST116') return 404;
  if (code === '42501' || code === 'PGRST301') return 401;
  if (code === '23505') return 409;
  if (code === '23503' || code === '22P02') return 400;
  return 500;
}

export class SupabaseCrudService {
  private injectedClient?: SupabaseClient | null;

  constructor(options: { client?: SupabaseClient | null } = {}) {
    this.injectedClient = options.client;
  }

  private resolveClient(): {
    client: SupabaseClient;
    keyKind: SupabaseKeyKind;
    urlHost: string | null;
  } | null {
    if (this.injectedClient !== undefined) {
      if (!this.injectedClient) return null;
      return {
        client: this.injectedClient,
        keyKind: 'service_role',
        urlHost: 'injected-client'
      };
    }
    return getSupabaseServiceClient();
  }

  private getClientOrError():
    | { ok: true; client: SupabaseClient; keyKind: SupabaseKeyKind }
    | { ok: false; status: number; reason: string; code: string } {
    const resolved = this.resolveClient();
    if (!resolved) {
      return {
        ok: false,
        status: 503,
        code: 'SUPABASE_NOT_CONFIGURED',
        reason:
          'Cliente Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.'
      };
    }
    return { ok: true, client: resolved.client, keyKind: resolved.keyKind };
  }

  /**
   * Valida que as chaves de ambiente estão ativas e que o cliente autenticado
   * consegue consultar as tabelas de membros e escalas no Supabase.
   */
  async verifyConnection(): Promise<SupabaseConnectionStatus> {
    const resolved = this.resolveClient();
    if (!resolved) {
      return {
        authenticated: false,
        keyKind: 'none',
        urlHost: null,
        tablesReady: { members: false, schedules: false },
        errorMessage: 'Variáveis SUPABASE_URL e chave de acesso não configuradas.'
      };
    }

    const { client, keyKind, urlHost } = resolved;

    try {
      const [membersProbe, schedulesProbe] = await Promise.all([
        client.from('members').select('id').limit(1),
        client.from('schedules').select('id').limit(1)
      ]);

      const membersOk = !membersProbe.error;
      const schedulesOk = !schedulesProbe.error;

      if (!membersOk || !schedulesOk) {
        const firstErr = membersProbe.error || schedulesProbe.error;
        return {
          authenticated: false,
          keyKind,
          urlHost,
          tablesReady: { members: membersOk, schedules: schedulesOk },
          errorMessage: firstErr?.message || 'Falha ao autenticar consulta nas tabelas.'
        };
      }

      // Garante que uma sessão com anon key não esteja apenas lendo vazio por bloqueio RLS
      if (keyKind === 'anon') {
        const authSessionRes = await client.auth.getSession();
        if (authSessionRes.error) {
          return {
            authenticated: false,
            keyKind,
            urlHost,
            tablesReady: { members: membersOk, schedules: schedulesOk },
            errorMessage: authSessionRes.error.message
          };
        }
      }

      return {
        authenticated: true,
        keyKind,
        urlHost,
        tablesReady: { members: true, schedules: true }
      };
    } catch (err) {
      return {
        authenticated: false,
        keyKind,
        urlHost,
        tablesReady: { members: false, schedules: false },
        errorMessage: err instanceof Error ? err.message : 'Erro de conexão com o Supabase.'
      };
    }
  }

  // ==================== CRUD: MEMBROS (members) ====================

  async listMembers(filters: { ministryId?: string } = {}): Promise<ServiceCrudResult<Member[]>> {
    const auth = this.getClientOrError();
    if (!auth.ok) return auth;

    let query = auth.client
      .from('members')
      .select('*')
      .order('sort_order', { ascending: true });

    if (filters.ministryId) {
      query = query.eq('ministry_id', filters.ministryId);
    }

    const { data, error } = await query;
    if (error) {
      return {
        ok: false,
        status: mapSupabaseErrorStatus(error),
        code: error.code || undefined,
        reason: error.message
      };
    }

    return {
      ok: true,
      data: ((data || []) as MemberRow[]).map(rowToMember)
    };
  }

  async getMemberById(memberId: string): Promise<ServiceCrudResult<Member>> {
    const auth = this.getClientOrError();
    if (!auth.ok) return auth;

    const cleanId = memberId.trim();
    if (!cleanId) {
      return { ok: false, status: 400, reason: 'ID do voluntário inválido.' };
    }

    const { data, error } = await auth.client
      .from('members')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        status: mapSupabaseErrorStatus(error),
        code: error.code || undefined,
        reason: error.message
      };
    }
    if (!data) {
      return { ok: false, status: 404, reason: 'Voluntário não encontrado.' };
    }

    return { ok: true, data: rowToMember(data as MemberRow) };
  }

  async createMember(input: CreateMemberInput): Promise<ServiceCrudResult<Member>> {
    const auth = this.getClientOrError();
    if (!auth.ok) return auth;

    const name = input.name?.trim();
    const ministryId = input.ministryId?.trim();
    if (!name || !ministryId) {
      return {
        ok: false,
        status: 400,
        reason: 'Informe nome e ministério válidos para cadastrar o voluntário.'
      };
    }

    const member: Member = {
      id: input.id?.trim() || `mem-${crypto.randomUUID().slice(0, 8)}`,
      name,
      cargo: (input.cargo || 'Voluntário').trim(),
      phone: (input.phone || '').trim(),
      ministryId,
      locais: Array.isArray(input.locais) ? input.locais.map((l) => l.trim()).filter(Boolean) : [],
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      ...(input.avatarUrl?.trim() ? { avatarUrl: input.avatarUrl.trim() } : {})
    };

    const row = memberToRow(member, input.sortOrder ?? 0);
    const { data, error } = await auth.client
      .from('members')
      .upsert(row)
      .select('*')
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        status: mapSupabaseErrorStatus(error),
        code: error.code || undefined,
        reason: error.message
      };
    }

    return {
      ok: true,
      data: data ? rowToMember(data as MemberRow) : member
    };
  }

  async updateMember(
    memberId: string,
    patch: UpdateMemberInput
  ): Promise<ServiceCrudResult<Member>> {
    const existingRes = await this.getMemberById(memberId);
    if (!existingRes.ok) return existingRes;

    const auth = this.getClientOrError();
    if (!auth.ok) return auth;

    const existing = existingRes.data;
    const nextName = patch.name !== undefined ? patch.name.trim() : existing.name;
    const nextMinistryId =
      patch.ministryId !== undefined ? patch.ministryId.trim() : existing.ministryId;

    if (!nextName || !nextMinistryId) {
      return { ok: false, status: 400, reason: 'Nome e ministério não podem ficar em branco.' };
    }

    const updated: Member = {
      ...existing,
      name: nextName,
      cargo: patch.cargo !== undefined ? patch.cargo.trim() : existing.cargo,
      phone: patch.phone !== undefined ? patch.phone.trim() : existing.phone,
      ministryId: nextMinistryId,
      locais:
        patch.locais !== undefined
          ? patch.locais.map((l) => l.trim()).filter(Boolean)
          : existing.locais,
      ...(patch.email !== undefined
        ? patch.email.trim()
          ? { email: patch.email.trim() }
          : { email: undefined }
        : existing.email
          ? { email: existing.email }
          : {}),
      ...(patch.avatarUrl !== undefined
        ? patch.avatarUrl.trim()
          ? { avatarUrl: patch.avatarUrl.trim() }
          : { avatarUrl: undefined }
        : existing.avatarUrl
          ? { avatarUrl: existing.avatarUrl }
          : {})
    };

    const { error } = await auth.client
      .from('members')
      .update({
        name: updated.name,
        cargo: updated.cargo,
        phone: updated.phone,
        ministry_id: updated.ministryId,
        locais: updated.locais,
        email: updated.email ?? null,
        avatar_url: updated.avatarUrl ?? null
      })
      .eq('id', existing.id);

    if (error) {
      return {
        ok: false,
        status: mapSupabaseErrorStatus(error),
        code: error.code || undefined,
        reason: error.message
      };
    }

    return { ok: true, data: updated };
  }

  async deleteMember(memberId: string): Promise<ServiceCrudResult<{ id: string }>> {
    const auth = this.getClientOrError();
    if (!auth.ok) return auth;

    const cleanId = memberId.trim();
    if (!cleanId) {
      return { ok: false, status: 400, reason: 'ID do voluntário inválido.' };
    }

    const { error } = await auth.client.from('members').delete().eq('id', cleanId);
    if (error) {
      return {
        ok: false,
        status: mapSupabaseErrorStatus(error),
        code: error.code || undefined,
        reason: error.message
      };
    }

    return { ok: true, data: { id: cleanId } };
  }

  // ==================== CRUD: ESCALAS (schedules) ====================

  async listSchedules(
    filters: { serviceId?: string; limit?: number } = {}
  ): Promise<ServiceCrudResult<Schedule[]>> {
    const auth = this.getClientOrError();
    if (!auth.ok) return auth;

    let query = auth.client
      .from('schedules')
      .select('*')
      .order('date_iso', { ascending: false });

    if (filters.serviceId) {
      query = query.eq('service_id', filters.serviceId);
    }
    if (filters.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) {
      return {
        ok: false,
        status: mapSupabaseErrorStatus(error),
        code: error.code || undefined,
        reason: error.message
      };
    }

    return {
      ok: true,
      data: ((data || []) as ScheduleRow[]).map(rowToSchedule)
    };
  }

  async getScheduleById(scheduleId: string): Promise<ServiceCrudResult<Schedule>> {
    const auth = this.getClientOrError();
    if (!auth.ok) return auth;

    const cleanId = scheduleId.trim();
    if (!cleanId) {
      return { ok: false, status: 400, reason: 'ID da escala inválido.' };
    }

    const { data, error } = await auth.client
      .from('schedules')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        status: mapSupabaseErrorStatus(error),
        code: error.code || undefined,
        reason: error.message
      };
    }
    if (!data) {
      return { ok: false, status: 404, reason: 'Escala não encontrada.' };
    }

    return { ok: true, data: rowToSchedule(data as ScheduleRow) };
  }

  async createSchedule(input: CreateScheduleInput): Promise<ServiceCrudResult<Schedule>> {
    const auth = this.getClientOrError();
    if (!auth.ok) return auth;

    if (!input.dateIso?.trim() || !input.serviceId?.trim() || !input.serviceLabel?.trim()) {
      return {
        ok: false,
        status: 400,
        reason: 'Informe data, culto e descrição válidos para criar a escala.'
      };
    }

    const schedule: Schedule = {
      id: input.id?.trim() || `sch-${crypto.randomUUID().slice(0, 8)}`,
      dateIso: input.dateIso.trim(),
      serviceId: input.serviceId.trim(),
      serviceLabel: input.serviceLabel.trim(),
      assignments: input.assignments || {},
      note: (input.note || '').trim(),
      createdAt: input.createdAt ?? Date.now()
    };

    const { data, error } = await auth.client
      .from('schedules')
      .upsert(scheduleToRow(schedule))
      .select('*')
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        status: mapSupabaseErrorStatus(error),
        code: error.code || undefined,
        reason: error.message
      };
    }

    return {
      ok: true,
      data: data ? rowToSchedule(data as ScheduleRow) : schedule
    };
  }

  async updateSchedule(
    scheduleId: string,
    patch: UpdateScheduleInput
  ): Promise<ServiceCrudResult<Schedule>> {
    const existingRes = await this.getScheduleById(scheduleId);
    if (!existingRes.ok) return existingRes;

    const auth = this.getClientOrError();
    if (!auth.ok) return auth;

    const existing = existingRes.data;
    const updated: Schedule = {
      ...existing,
      dateIso: patch.dateIso !== undefined ? patch.dateIso.trim() : existing.dateIso,
      serviceId: patch.serviceId !== undefined ? patch.serviceId.trim() : existing.serviceId,
      serviceLabel:
        patch.serviceLabel !== undefined ? patch.serviceLabel.trim() : existing.serviceLabel,
      assignments: patch.assignments !== undefined ? patch.assignments : existing.assignments,
      note: patch.note !== undefined ? patch.note.trim() : existing.note
    };

    if (!updated.dateIso || !updated.serviceId || !updated.serviceLabel) {
      return {
        ok: false,
        status: 400,
        reason: 'Data e culto da escala são obrigatórios.'
      };
    }

    const { error } = await auth.client
      .from('schedules')
      .update({
        date_iso: updated.dateIso,
        service_id: updated.serviceId,
        service_label: updated.serviceLabel,
        assignments: updated.assignments,
        note: updated.note
      })
      .eq('id', existing.id);

    if (error) {
      return {
        ok: false,
        status: mapSupabaseErrorStatus(error),
        code: error.code || undefined,
        reason: error.message
      };
    }

    return { ok: true, data: updated };
  }

  async toggleSchedulePresence(
    scheduleId: string,
    ministryId: string,
    assignmentId: string
  ): Promise<ServiceCrudResult<Schedule>> {
    const existingRes = await this.getScheduleById(scheduleId);
    if (!existingRes.ok) return existingRes;

    const existing = existingRes.data;
    const list: Assignment[] = existing.assignments[ministryId] || [];
    const target = list.find((item) => item.id === assignmentId);
    if (!target) {
      return {
        ok: false,
        status: 404,
        reason: 'Posto/voluntário não encontrado nesta escala.'
      };
    }

    const updatedAssignments: Record<string, Assignment[]> = {
      ...existing.assignments,
      [ministryId]: list.map((item) =>
        item.id === assignmentId ? { ...item, present: !item.present } : item
      )
    };

    return this.updateSchedule(scheduleId, { assignments: updatedAssignments });
  }

  async deleteSchedule(scheduleId: string): Promise<ServiceCrudResult<{ id: string }>> {
    const auth = this.getClientOrError();
    if (!auth.ok) return auth;

    const cleanId = scheduleId.trim();
    if (!cleanId) {
      return { ok: false, status: 400, reason: 'ID da escala inválido.' };
    }

    const { error } = await auth.client.from('schedules').delete().eq('id', cleanId);
    if (error) {
      return {
        ok: false,
        status: mapSupabaseErrorStatus(error),
        code: error.code || undefined,
        reason: error.message
      };
    }

    return { ok: true, data: { id: cleanId } };
  }
}

export function createSupabaseCrudService(client?: SupabaseClient | null): SupabaseCrudService {
  return new SupabaseCrudService({ client });
}

export const supabaseService = new SupabaseCrudService();
