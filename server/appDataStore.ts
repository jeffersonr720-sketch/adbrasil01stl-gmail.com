import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LeaderUser,
  Member,
  Ministry,
  Schedule,
  Service
} from '../src/types/index.ts';
import {
  canDeleteFullSchedule,
  canManageMinistry,
  canManageServicesAndMinistries,
  mergeScheduleAssignmentsForUser
} from '../src/utils/authRules.ts';
import {
  addQuickMinistryRole,
  applyMinistryRoleChanges,
  type RoleDraftItem,
  validateRoleDrafts
} from '../src/utils/ministryRoles.ts';
import { getInitialSeedData } from '../src/utils/rules.ts';
import {
  type AppDomainState,
  type AppSettingsRow,
  type MemberRow,
  type MinistryRow,
  type ScheduleRow,
  type ServiceRow,
  memberToRow,
  ministryToRow,
  rowToMember,
  rowToMinistry,
  rowToSchedule,
  rowToService,
  scheduleToRow,
  scopeAppDataForUser,
  serviceToRow
} from './dbMappers.ts';
import { getSupabaseClient, isSupabaseFallbackError } from './supabaseClient.ts';

export const DEFAULT_CHURCH_NAME = 'Assembleia de Deus • AD Brasil';
const TABLE_RETRY_COOLDOWN_MS = 15000;

export type RepoResult<T> =
  | ({ ok: true } & T)
  | { ok: false; status: number; reason: string };

export class AppDataStore {
  private dbPath: string;
  private overrideClient?: SupabaseClient | null;
  private missingTableUntil = 0;
  private warnedMissingTable = false;

  constructor(options: { dataDir?: string; supabaseClient?: SupabaseClient | null } = {}) {
    const dataDir = options.dataDir ?? path.resolve(process.cwd(), '.data');
    fs.mkdirSync(dataDir, { recursive: true });
    this.dbPath = path.join(dataDir, 'app-data.json');
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
    this.markSupabaseUnavailable('Tabelas do aplicativo indisponíveis ou banco inacessível', error);
    return true;
  }

  private readLocalDb(): AppDomainState {
    if (!fs.existsSync(this.dbPath)) {
      const seed = getInitialSeedData();
      const initial: AppDomainState = {
        churchName: DEFAULT_CHURCH_NAME,
        ...seed
      };
      fs.writeFileSync(this.dbPath, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(this.dbPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppDomainState>;
    const seed = getInitialSeedData();
    return {
      churchName: parsed.churchName || DEFAULT_CHURCH_NAME,
      ministries: Array.isArray(parsed.ministries) ? parsed.ministries : seed.ministries,
      members: Array.isArray(parsed.members) ? parsed.members : seed.members,
      services: Array.isArray(parsed.services) ? parsed.services : seed.services,
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : seed.schedules
    };
  }

  private writeLocalDb(state: AppDomainState): void {
    fs.writeFileSync(this.dbPath, JSON.stringify(state, null, 2), 'utf8');
  }

  private async ensureSupabaseSeeded(client: SupabaseClient): Promise<boolean> {
    try {
      const { data: existingMins, error: checkError } = await client
        .from('ministries')
        .select('id')
        .limit(1);

      if (checkError) {
        return this.markSupabaseUnavailable('Tabelas do aplicativo ainda não prontas', checkError);
      }

      const { data: settingsRow } = await client
        .from('app_settings')
        .select('id, church_name')
        .eq('id', 'default')
        .maybeSingle();

      if (!settingsRow) {
        await client.from('app_settings').upsert({
          id: 'default',
          church_name: DEFAULT_CHURCH_NAME
        });
      }

      if (existingMins && existingMins.length > 0) {
        return true;
      }

      const seed = getInitialSeedData();
      if (seed.ministries.length > 0) {
        const { error } = await client
          .from('ministries')
          .upsert(seed.ministries.map((m, idx) => ministryToRow(m, idx)));
        if (error) {
          return this.markSupabaseUnavailable('Não foi possível inicializar departamentos', error);
        }
      }
      if (seed.services.length > 0) {
        const { error } = await client
          .from('services')
          .upsert(seed.services.map((s, idx) => serviceToRow(s, idx)));
        if (error) {
          return this.markSupabaseUnavailable('Não foi possível inicializar cultos', error);
        }
      }
      if (seed.members.length > 0) {
        const { error } = await client
          .from('members')
          .upsert(seed.members.map((m, idx) => memberToRow(m, idx)));
        if (error) {
          return this.markSupabaseUnavailable('Não foi possível inicializar voluntários', error);
        }
      }
      if (seed.schedules.length > 0) {
        const { error } = await client
          .from('schedules')
          .upsert(seed.schedules.map((s) => scheduleToRow(s)));
        if (error) {
          return this.markSupabaseUnavailable('Não foi possível inicializar escalas', error);
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
    const ready = await this.ensureSupabaseSeeded(client);
    return ready ? client : null;
  }

  async getFullData(): Promise<AppDomainState> {
    const client = await this.getReadySupabaseClient();
    if (!client) {
      return this.readLocalDb();
    }

    const [settingsRes, minsRes, memsRes, srvsRes, schsRes] = await Promise.all([
      client.from('app_settings').select('id, church_name').eq('id', 'default').maybeSingle(),
      client.from('ministries').select('*').order('sort_order', { ascending: true }),
      client.from('members').select('*').order('sort_order', { ascending: true }),
      client.from('services').select('*').order('sort_order', { ascending: true }),
      client.from('schedules').select('*').order('created_at', { ascending: false })
    ]);

    if (minsRes.error) throw new Error(minsRes.error.message);
    if (memsRes.error) throw new Error(memsRes.error.message);
    if (srvsRes.error) throw new Error(srvsRes.error.message);
    if (schsRes.error) throw new Error(schsRes.error.message);

    const settings = settingsRes.data as AppSettingsRow | null;
    return {
      churchName: settings?.church_name || DEFAULT_CHURCH_NAME,
      ministries: ((minsRes.data || []) as MinistryRow[]).map(rowToMinistry),
      members: ((memsRes.data || []) as MemberRow[]).map(rowToMember),
      services: ((srvsRes.data || []) as ServiceRow[]).map(rowToService),
      schedules: ((schsRes.data || []) as ScheduleRow[]).map(rowToSchedule)
    };
  }

  async getDataForUser(user: LeaderUser): Promise<AppDomainState> {
    const full = await this.getFullData();
    return scopeAppDataForUser(full, user);
  }

  async setChurchName(
    churchName: string,
    actingUser: LeaderUser
  ): Promise<RepoResult<{ churchName: string }>> {
    if (!canManageServicesAndMinistries(actingUser)) {
      return { ok: false, status: 403, reason: 'Apenas a Coordenação Geral pode editar o nome da igreja.' };
    }
    const clean = churchName.trim();
    if (clean.length < 2) {
      return { ok: false, status: 400, reason: 'Informe um nome válido para a igreja.' };
    }

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      db.churchName = clean;
      this.writeLocalDb(db);
      return { ok: true, churchName: clean };
    }

    const { error } = await client
      .from('app_settings')
      .upsert({ id: 'default', church_name: clean });
    if (error) {
      return { ok: false, status: 500, reason: 'Não foi possível salvar o nome da igreja.' };
    }
    return { ok: true, churchName: clean };
  }

  async addMinistry(
    payload: Omit<Ministry, 'id'> & { id?: string },
    actingUser: LeaderUser
  ): Promise<RepoResult<{ ministry: Ministry }>> {
    if (!canManageServicesAndMinistries(actingUser)) {
      return { ok: false, status: 403, reason: 'Apenas a Coordenação Geral pode criar departamentos.' };
    }
    const name = payload.name.trim();
    if (!name) {
      return { ok: false, status: 400, reason: 'Informe o nome do departamento.' };
    }
    const ministry: Ministry = {
      id: payload.id || `min-${crypto.randomUUID().slice(0, 8)}`,
      name,
      locais: Array.isArray(payload.locais) ? payload.locais : [],
      ...(payload.color ? { color: payload.color } : {})
    };

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      db.ministries.push(ministry);
      this.writeLocalDb(db);
      return { ok: true, ministry };
    }

    const { count } = await client.from('ministries').select('id', { count: 'exact', head: true });
    const { error } = await client
      .from('ministries')
      .upsert(ministryToRow(ministry, count || 0));
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao salvar departamento no banco.' };
    }
    return { ok: true, ministry };
  }

  async updateMinistry(
    ministry: Ministry,
    actingUser: LeaderUser
  ): Promise<RepoResult<{ ministry: Ministry }>> {
    if (!canManageMinistry(actingUser, ministry.id)) {
      return { ok: false, status: 403, reason: 'Sem permissão para editar este departamento.' };
    }

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      const idx = db.ministries.findIndex((m) => m.id === ministry.id);
      if (idx < 0) return { ok: false, status: 404, reason: 'Departamento não encontrado.' };
      db.ministries[idx] = ministry;
      this.writeLocalDb(db);
      return { ok: true, ministry };
    }

    const { error } = await client
      .from('ministries')
      .update({
        name: ministry.name,
        locais: ministry.locais,
        color: ministry.color ?? null
      })
      .eq('id', ministry.id);
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao atualizar departamento no banco.' };
    }
    return { ok: true, ministry };
  }

  async saveMinistryRoles(
    params: {
      ministryId: string;
      drafts: RoleDraftItem[];
      name?: string;
      color?: string;
    },
    actingUser: LeaderUser
  ): Promise<
    RepoResult<{
      ministry: Ministry;
      updatedMembers: Member[];
      updatedSchedules: Schedule[];
    }>
  > {
    if (!canManageMinistry(actingUser, params.ministryId)) {
      return { ok: false, status: 403, reason: 'Sem permissão para editar os postos deste departamento.' };
    }

    const draftError = validateRoleDrafts(params.drafts);
    if (draftError) {
      return { ok: false, status: 400, reason: draftError };
    }

    const full = await this.getFullData();
    const target = full.ministries.find((m) => m.id === params.ministryId);
    if (!target) {
      return { ok: false, status: 404, reason: 'Departamento não encontrado.' };
    }

    const { updatedMinistry, updatedMembers, updatedSchedules } = applyMinistryRoleChanges({
      ministry: {
        ...target,
        name: params.name !== undefined && params.name.trim() ? params.name.trim() : target.name,
        color: params.color !== undefined ? params.color : target.color
      },
      drafts: params.drafts,
      members: full.members,
      schedules: full.schedules
    });

    const client = await this.getReadySupabaseClient();
    if (!client) {
      this.writeLocalDb({
        ...full,
        ministries: full.ministries.map((m) => (m.id === params.ministryId ? updatedMinistry : m)),
        members: updatedMembers,
        schedules: updatedSchedules
      });
      return {
        ok: true,
        ministry: updatedMinistry,
        updatedMembers: scopeAppDataForUser({ ...full, members: updatedMembers }, actingUser).members,
        updatedSchedules: scopeAppDataForUser({ ...full, schedules: updatedSchedules }, actingUser).schedules
      };
    }

    const { error: minErr } = await client
      .from('ministries')
      .update({
        name: updatedMinistry.name,
        locais: updatedMinistry.locais,
        color: updatedMinistry.color ?? null
      })
      .eq('id', updatedMinistry.id);
    if (minErr) {
      return { ok: false, status: 500, reason: 'Erro ao salvar postos do departamento.' };
    }

    const changedMembers = updatedMembers.filter((m, idx) => m !== full.members[idx]);
    if (changedMembers.length > 0) {
      const { error: memErr } = await client
        .from('members')
        .upsert(changedMembers.map((m) => memberToRow(m)));
      if (memErr) {
        return { ok: false, status: 500, reason: 'Erro ao atualizar funções dos voluntários.' };
      }
    }

    const changedSchedules = updatedSchedules.filter((s, idx) => s !== full.schedules[idx]);
    if (changedSchedules.length > 0) {
      const { error: schErr } = await client
        .from('schedules')
        .upsert(changedSchedules.map((s) => scheduleToRow(s)));
      if (schErr) {
        return { ok: false, status: 500, reason: 'Erro ao atualizar funções nas escalas.' };
      }
    }

    return {
      ok: true,
      ministry: updatedMinistry,
      updatedMembers: scopeAppDataForUser({ ...full, members: updatedMembers }, actingUser).members,
      updatedSchedules: scopeAppDataForUser({ ...full, schedules: updatedSchedules }, actingUser).schedules
    };
  }

  async addMinistryRole(
    ministryId: string,
    roleName: string,
    actingUser: LeaderUser
  ): Promise<RepoResult<{ ministry: Ministry; normalizedName: string }>> {
    if (!canManageMinistry(actingUser, ministryId)) {
      return { ok: false, status: 403, reason: 'Sem permissão para criar funções neste departamento.' };
    }

    const full = await this.getFullData();
    const target = full.ministries.find((m) => m.id === ministryId);
    if (!target) {
      return { ok: false, status: 404, reason: 'Departamento não encontrado.' };
    }

    const res = addQuickMinistryRole(target, roleName);
    if (res.error || !res.updatedMinistry || !res.normalizedName) {
      return { ok: false, status: 400, reason: res.error || 'Nome de posto inválido.' };
    }

    const updatedMin = res.updatedMinistry;
    const client = await this.getReadySupabaseClient();
    if (!client) {
      this.writeLocalDb({
        ...full,
        ministries: full.ministries.map((m) => (m.id === ministryId ? updatedMin : m))
      });
      return { ok: true, ministry: updatedMin, normalizedName: res.normalizedName };
    }

    const { error } = await client
      .from('ministries')
      .update({ locais: updatedMin.locais })
      .eq('id', ministryId);
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao adicionar posto no banco.' };
    }
    return { ok: true, ministry: updatedMin, normalizedName: res.normalizedName };
  }

  async deleteMinistry(
    ministryId: string,
    actingUser: LeaderUser
  ): Promise<RepoResult<{ deletedId: string; ministryName?: string }>> {
    if (!canManageServicesAndMinistries(actingUser)) {
      return { ok: false, status: 403, reason: 'Apenas a Coordenação Geral pode remover departamentos.' };
    }

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      const target = db.ministries.find((m) => m.id === ministryId);
      db.ministries = db.ministries.filter((m) => m.id !== ministryId);
      db.members = db.members.filter((m) => m.ministryId !== ministryId);
      this.writeLocalDb(db);
      return { ok: true, deletedId: ministryId, ministryName: target?.name };
    }

    const { data: existing } = await client
      .from('ministries')
      .select('name')
      .eq('id', ministryId)
      .maybeSingle();
    const { error } = await client.from('ministries').delete().eq('id', ministryId);
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao excluir departamento.' };
    }
    return {
      ok: true,
      deletedId: ministryId,
      ministryName: existing?.name ? String(existing.name) : undefined
    };
  }

  async addMember(
    payload: Omit<Member, 'id'> & { id?: string },
    actingUser: LeaderUser
  ): Promise<RepoResult<{ member: Member }>> {
    if (!canManageMinistry(actingUser, payload.ministryId)) {
      return { ok: false, status: 403, reason: 'Você só pode cadastrar voluntários no seu departamento.' };
    }
    const name = payload.name.trim();
    if (!name) {
      return { ok: false, status: 400, reason: 'Informe o nome do voluntário.' };
    }

    const member: Member = {
      ...payload,
      id: payload.id || `mem-${crypto.randomUUID().slice(0, 8)}`,
      name
    };

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      db.members.push(member);
      this.writeLocalDb(db);
      return { ok: true, member };
    }

    const { count } = await client.from('members').select('id', { count: 'exact', head: true });
    const { error } = await client.from('members').upsert(memberToRow(member, count || 0));
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao cadastrar voluntário no banco.' };
    }
    return { ok: true, member };
  }

  async updateMember(
    member: Member,
    actingUser: LeaderUser
  ): Promise<RepoResult<{ member: Member }>> {
    if (!canManageMinistry(actingUser, member.ministryId)) {
      return { ok: false, status: 403, reason: 'Você só pode editar voluntários do seu departamento.' };
    }

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      const idx = db.members.findIndex((m) => m.id === member.id);
      if (idx < 0) return { ok: false, status: 404, reason: 'Voluntário não encontrado.' };
      if (!canManageMinistry(actingUser, db.members[idx].ministryId)) {
        return { ok: false, status: 403, reason: 'Sem permissão para alterar este voluntário.' };
      }
      db.members[idx] = member;
      this.writeLocalDb(db);
      return { ok: true, member };
    }

    const { data: existing } = await client
      .from('members')
      .select('ministry_id')
      .eq('id', member.id)
      .maybeSingle();
    if (!existing) {
      return { ok: false, status: 404, reason: 'Voluntário não encontrado.' };
    }
    if (!canManageMinistry(actingUser, String(existing.ministry_id))) {
      return { ok: false, status: 403, reason: 'Sem permissão para alterar este voluntário.' };
    }

    const { error } = await client
      .from('members')
      .update(memberToRow(member))
      .eq('id', member.id);
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao atualizar voluntário.' };
    }
    return { ok: true, member };
  }

  async deleteMember(
    memberId: string,
    actingUser: LeaderUser
  ): Promise<RepoResult<{ deletedId: string; memberName?: string; ministryId?: string }>> {
    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      const target = db.members.find((m) => m.id === memberId);
      if (!target) return { ok: false, status: 404, reason: 'Voluntário não encontrado.' };
      if (!canManageMinistry(actingUser, target.ministryId)) {
        return { ok: false, status: 403, reason: 'Sem permissão para excluir voluntário de outro departamento.' };
      }
      db.members = db.members.filter((m) => m.id !== memberId);
      this.writeLocalDb(db);
      return {
        ok: true,
        deletedId: memberId,
        memberName: target.name,
        ministryId: target.ministryId
      };
    }

    const { data: existing } = await client
      .from('members')
      .select('ministry_id, name')
      .eq('id', memberId)
      .maybeSingle();
    if (!existing) return { ok: false, status: 404, reason: 'Voluntário não encontrado.' };
    if (!canManageMinistry(actingUser, String(existing.ministry_id))) {
      return { ok: false, status: 403, reason: 'Sem permissão para excluir voluntário de outro departamento.' };
    }

    const { error } = await client.from('members').delete().eq('id', memberId);
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao remover voluntário.' };
    }
    return {
      ok: true,
      deletedId: memberId,
      memberName: existing.name ? String(existing.name) : undefined,
      ministryId: String(existing.ministry_id)
    };
  }

  async addService(
    payload: Omit<Service, 'id'> & { id?: string },
    actingUser: LeaderUser
  ): Promise<RepoResult<{ service: Service }>> {
    if (!canManageServicesAndMinistries(actingUser)) {
      return { ok: false, status: 403, reason: 'Apenas a Coordenação Geral pode cadastrar cultos.' };
    }
    const label = payload.label.trim();
    if (!label) {
      return { ok: false, status: 400, reason: 'Informe o nome do culto.' };
    }

    const service: Service = {
      ...payload,
      id: payload.id || `srv-${crypto.randomUUID().slice(0, 8)}`,
      label
    };

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      db.services.push(service);
      this.writeLocalDb(db);
      return { ok: true, service };
    }

    const { count } = await client.from('services').select('id', { count: 'exact', head: true });
    const { error } = await client.from('services').upsert(serviceToRow(service, count || 0));
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao cadastrar culto no banco.' };
    }
    return { ok: true, service };
  }

  async updateService(
    service: Service,
    actingUser: LeaderUser
  ): Promise<RepoResult<{ service: Service }>> {
    if (!canManageServicesAndMinistries(actingUser)) {
      return { ok: false, status: 403, reason: 'Apenas a Coordenação Geral pode editar cultos.' };
    }

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      const idx = db.services.findIndex((s) => s.id === service.id);
      if (idx < 0) return { ok: false, status: 404, reason: 'Culto não encontrado.' };
      db.services[idx] = service;
      this.writeLocalDb(db);
      return { ok: true, service };
    }

    const { error } = await client
      .from('services')
      .update({
        label: service.label,
        day_of_week: service.dayOfWeek ?? null,
        time: service.time ?? null
      })
      .eq('id', service.id);
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao atualizar culto.' };
    }
    return { ok: true, service };
  }

  async deleteService(
    serviceId: string,
    actingUser: LeaderUser
  ): Promise<RepoResult<{ deletedId: string; serviceLabel?: string }>> {
    if (!canManageServicesAndMinistries(actingUser)) {
      return { ok: false, status: 403, reason: 'Apenas a Coordenação Geral pode remover cultos.' };
    }

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      const target = db.services.find((s) => s.id === serviceId);
      db.services = db.services.filter((s) => s.id !== serviceId);
      this.writeLocalDb(db);
      return { ok: true, deletedId: serviceId, serviceLabel: target?.label };
    }

    const { data: existing } = await client
      .from('services')
      .select('label')
      .eq('id', serviceId)
      .maybeSingle();
    const { error } = await client.from('services').delete().eq('id', serviceId);
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao remover culto.' };
    }
    return {
      ok: true,
      deletedId: serviceId,
      serviceLabel: existing?.label ? String(existing.label) : undefined
    };
  }

  async addSchedule(
    payload: Omit<Schedule, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
    actingUser: LeaderUser
  ): Promise<RepoResult<{ schedule: Schedule }>> {
    if (!actingUser || !actingUser.active) {
      return { ok: false, status: 401, reason: 'Sessão inválida.' };
    }

    const safeAssignments = mergeScheduleAssignmentsForUser({}, payload.assignments || {}, actingUser);
    const schedule: Schedule = {
      id: payload.id || `sch-${crypto.randomUUID().slice(0, 8)}`,
      dateIso: payload.dateIso,
      serviceId: payload.serviceId,
      serviceLabel: payload.serviceLabel,
      assignments: safeAssignments,
      note: payload.note || '',
      createdAt: payload.createdAt || Date.now()
    };

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      db.schedules = [schedule, ...db.schedules];
      this.writeLocalDb(db);
      return {
        ok: true,
        schedule: scopeAppDataForUser({ ...db, schedules: [schedule] }, actingUser).schedules[0]
      };
    }

    const { error } = await client.from('schedules').upsert(scheduleToRow(schedule));
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao criar escala no banco.' };
    }
    const scoped = scopeAppDataForUser(
      { churchName: DEFAULT_CHURCH_NAME, ministries: [], members: [], services: [], schedules: [schedule] },
      actingUser
    ).schedules[0];
    return { ok: true, schedule: scoped };
  }

  async updateSchedule(
    updated: Schedule,
    actingUser: LeaderUser
  ): Promise<
    RepoResult<{
      schedule: Schedule;
      changedMinistryIds: string[];
      metadataChanged: boolean;
    }>
  > {
    const computeChanges = (existing: Schedule, merged: Schedule) => {
      const ministryKeys = new Set([
        ...Object.keys(existing.assignments || {}),
        ...Object.keys(merged.assignments || {})
      ]);
      const changedMinistryIds: string[] = [];
      ministryKeys.forEach((minId) => {
        const before = JSON.stringify(existing.assignments[minId] || []);
        const after = JSON.stringify(merged.assignments[minId] || []);
        if (before !== after) {
          changedMinistryIds.push(minId);
        }
      });
      const metadataChanged =
        existing.dateIso !== merged.dateIso ||
        existing.serviceId !== merged.serviceId ||
        existing.serviceLabel !== merged.serviceLabel ||
        existing.note !== merged.note;
      return { changedMinistryIds, metadataChanged };
    };

    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      const idx = db.schedules.findIndex((s) => s.id === updated.id);
      if (idx < 0) return { ok: false, status: 404, reason: 'Escala não encontrada.' };
      const existing = db.schedules[idx];
      const merged: Schedule = {
        ...existing,
        dateIso: actingUser.role === 'admin' ? updated.dateIso : existing.dateIso,
        serviceId: actingUser.role === 'admin' ? updated.serviceId : existing.serviceId,
        serviceLabel: actingUser.role === 'admin' ? updated.serviceLabel : existing.serviceLabel,
        note: updated.note,
        assignments: mergeScheduleAssignmentsForUser(
          existing.assignments,
          updated.assignments || {},
          actingUser
        )
      };
      const changes = computeChanges(existing, merged);
      db.schedules[idx] = merged;
      this.writeLocalDb(db);
      return {
        ok: true,
        schedule: scopeAppDataForUser({ ...db, schedules: [merged] }, actingUser).schedules[0],
        ...changes
      };
    }

    const { data: row, error: fetchErr } = await client
      .from('schedules')
      .select('*')
      .eq('id', updated.id)
      .maybeSingle();
    if (fetchErr || !row) {
      return { ok: false, status: 404, reason: 'Escala não encontrada.' };
    }

    const existing = rowToSchedule(row as ScheduleRow);
    const merged: Schedule = {
      ...existing,
      dateIso: actingUser.role === 'admin' ? updated.dateIso : existing.dateIso,
      serviceId: actingUser.role === 'admin' ? updated.serviceId : existing.serviceId,
      serviceLabel: actingUser.role === 'admin' ? updated.serviceLabel : existing.serviceLabel,
      note: updated.note,
      assignments: mergeScheduleAssignmentsForUser(
        existing.assignments,
        updated.assignments || {},
        actingUser
      )
    };
    const changes = computeChanges(existing, merged);

    const { error: saveErr } = await client
      .from('schedules')
      .upsert(scheduleToRow(merged));
    if (saveErr) {
      return { ok: false, status: 500, reason: 'Erro ao salvar escala no banco.' };
    }

    const scoped = scopeAppDataForUser(
      { churchName: DEFAULT_CHURCH_NAME, ministries: [], members: [], services: [], schedules: [merged] },
      actingUser
    ).schedules[0];
    return { ok: true, schedule: scoped, ...changes };
  }

  async deleteSchedule(
    scheduleId: string,
    actingUser: LeaderUser
  ): Promise<RepoResult<{ deletedId: string; serviceLabel?: string; dateIso?: string }>> {
    const client = await this.getReadySupabaseClient();
    if (!client) {
      const db = this.readLocalDb();
      const target = db.schedules.find((s) => s.id === scheduleId);
      if (!target) return { ok: false, status: 404, reason: 'Escala não encontrada.' };
      if (!canDeleteFullSchedule(target, actingUser)) {
        return {
          ok: false,
          status: 403,
          reason: 'Esta escala possui voluntários de outros departamentos. Remova apenas a sua equipe.'
        };
      }
      db.schedules = db.schedules.filter((s) => s.id !== scheduleId);
      this.writeLocalDb(db);
      return {
        ok: true,
        deletedId: scheduleId,
        serviceLabel: target.serviceLabel,
        dateIso: target.dateIso
      };
    }

    const { data: row } = await client
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .maybeSingle();
    if (!row) return { ok: false, status: 404, reason: 'Escala não encontrada.' };

    const target = rowToSchedule(row as ScheduleRow);
    if (!canDeleteFullSchedule(target, actingUser)) {
      return {
        ok: false,
        status: 403,
        reason: 'Esta escala possui voluntários de outros departamentos. Remova apenas a sua equipe.'
      };
    }

    const { error } = await client.from('schedules').delete().eq('id', scheduleId);
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao remover escala.' };
    }
    return {
      ok: true,
      deletedId: scheduleId,
      serviceLabel: target.serviceLabel,
      dateIso: target.dateIso
    };
  }

  async toggleAssignmentPresence(
    scheduleId: string,
    ministryId: string,
    assignmentId: string,
    actingUser: LeaderUser
  ): Promise<RepoResult<{ schedule: Schedule }>> {
    if (!canManageMinistry(actingUser, ministryId)) {
      return { ok: false, status: 403, reason: 'Sem permissão para confirmar presença deste departamento.' };
    }

    const full = await this.getFullData();
    const target = full.schedules.find((s) => s.id === scheduleId);
    if (!target) {
      return { ok: false, status: 404, reason: 'Escala não encontrada.' };
    }

    const list = target.assignments[ministryId] || [];
    const nextList = list.map((item) =>
      item.id === assignmentId ? { ...item, present: !item.present } : item
    );
    const updated: Schedule = {
      ...target,
      assignments: {
        ...target.assignments,
        [ministryId]: nextList
      }
    };

    const client = await this.getReadySupabaseClient();
    if (!client) {
      this.writeLocalDb({
        ...full,
        schedules: full.schedules.map((s) => (s.id === scheduleId ? updated : s))
      });
      return {
        ok: true,
        schedule: scopeAppDataForUser({ ...full, schedules: [updated] }, actingUser).schedules[0]
      };
    }

    const { error } = await client.from('schedules').upsert(scheduleToRow(updated));
    if (error) {
      return { ok: false, status: 500, reason: 'Erro ao atualizar presença.' };
    }
    return {
      ok: true,
      schedule: scopeAppDataForUser({ ...full, schedules: [updated] }, actingUser).schedules[0]
    };
  }

  async resetToSampleData(actingUser: LeaderUser): Promise<RepoResult<{ data: AppDomainState }>> {
    if (!canManageServicesAndMinistries(actingUser)) {
      return { ok: false, status: 403, reason: 'Apenas a Coordenação Geral pode restaurar os dados iniciais.' };
    }

    const seed = getInitialSeedData();
    const nextState: AppDomainState = {
      churchName: DEFAULT_CHURCH_NAME,
      ...seed
    };

    const client = await this.getReadySupabaseClient();
    if (!client) {
      this.writeLocalDb(nextState);
      return { ok: true, data: nextState };
    }

    // Limpa registros e reinsere o conjunto inicial em ordem de FK
    await client.from('schedules').delete().neq('id', '');
    await client.from('members').delete().neq('id', '');
    await client.from('services').delete().neq('id', '');
    await client.from('ministries').delete().neq('id', '');

    await client.from('app_settings').upsert({ id: 'default', church_name: DEFAULT_CHURCH_NAME });
    await client.from('ministries').upsert(seed.ministries.map((m, idx) => ministryToRow(m, idx)));
    await client.from('services').upsert(seed.services.map((s, idx) => serviceToRow(s, idx)));
    await client.from('members').upsert(seed.members.map((m, idx) => memberToRow(m, idx)));
    await client.from('schedules').upsert(seed.schedules.map((s) => scheduleToRow(s)));

    return { ok: true, data: nextState };
  }
}
