import type {
  Assignment,
  LeaderRole,
  LeaderUser,
  Member,
  Ministry,
  Schedule,
  Service
} from '../src/types/index.ts';
import type { StoredLeaderRecord } from './authStore.ts';
import {
  getScopedMembers,
  getScopedMinistries,
  scopeSchedulesForUser
} from '../src/utils/authRules.ts';

export interface MinistryRow {
  id: string;
  name: string;
  locais: unknown;
  color: string | null;
  sort_order?: number;
}

export interface MemberRow {
  id: string;
  name: string;
  cargo: string;
  phone: string;
  ministry_id: string;
  locais: unknown;
  email: string | null;
  avatar_url: string | null;
  sort_order?: number;
}

export interface ServiceRow {
  id: string;
  label: string;
  day_of_week: string | null;
  time: string | null;
  sort_order?: number;
}

export interface ScheduleRow {
  id: string;
  date_iso: string;
  service_id: string;
  service_label: string;
  assignments: unknown;
  note: string | null;
  created_at: number | string;
}

export interface LeaderRow {
  id: string;
  name: string;
  login: string;
  email: string;
  cargo: string;
  role: string;
  ministry_id: string | null;
  active: boolean;
  password_hash: string;
  created_at: number | string;
  last_login_at: number | string | null;
}

export interface AppSettingsRow {
  id: string;
  church_name: string;
}

export interface AppDomainState {
  churchName: string;
  ministries: Ministry[];
  members: Member[];
  services: Service[];
  schedules: Schedule[];
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseAssignmentsRecord(value: unknown): Record<string, Assignment[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, Assignment[]> = {};
  for (const [minId, list] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(list)) {
      result[minId] = [];
      continue;
    }
    result[minId] = list
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        id: String(item.id || ''),
        memberId: String(item.memberId || ''),
        local: String(item.local || ''),
        present: Boolean(item.present)
      }));
  }
  return result;
}

export function ministryToRow(ministry: Ministry, sortOrder: number = 0): MinistryRow {
  return {
    id: ministry.id,
    name: ministry.name,
    locais: [...ministry.locais],
    color: ministry.color ?? null,
    sort_order: sortOrder
  };
}

export function rowToMinistry(row: MinistryRow): Ministry {
  return {
    id: row.id,
    name: row.name,
    locais: parseStringArray(row.locais),
    ...(row.color ? { color: row.color } : {})
  };
}

export function memberToRow(member: Member, sortOrder: number = 0): MemberRow {
  return {
    id: member.id,
    name: member.name,
    cargo: member.cargo,
    phone: member.phone,
    ministry_id: member.ministryId,
    locais: [...member.locais],
    email: member.email ?? null,
    avatar_url: member.avatarUrl ?? null,
    sort_order: sortOrder
  };
}

export function rowToMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    cargo: row.cargo || '',
    phone: row.phone || '',
    ministryId: row.ministry_id,
    locais: parseStringArray(row.locais),
    ...(row.email ? { email: row.email } : {}),
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {})
  };
}

export function serviceToRow(service: Service, sortOrder: number = 0): ServiceRow {
  return {
    id: service.id,
    label: service.label,
    day_of_week: service.dayOfWeek ?? null,
    time: service.time ?? null,
    sort_order: sortOrder
  };
}

export function rowToService(row: ServiceRow): Service {
  return {
    id: row.id,
    label: row.label,
    ...(row.day_of_week ? { dayOfWeek: row.day_of_week } : {}),
    ...(row.time ? { time: row.time } : {})
  };
}

export function scheduleToRow(schedule: Schedule): ScheduleRow {
  return {
    id: schedule.id,
    date_iso: schedule.dateIso,
    service_id: schedule.serviceId,
    service_label: schedule.serviceLabel,
    assignments: schedule.assignments,
    note: schedule.note || '',
    created_at: schedule.createdAt
  };
}

export function rowToSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    dateIso: row.date_iso,
    serviceId: row.service_id,
    serviceLabel: row.service_label,
    assignments: parseAssignmentsRecord(row.assignments),
    note: row.note || '',
    createdAt: Number(row.created_at) || Date.now()
  };
}

export function leaderToRow(leader: StoredLeaderRecord): LeaderRow {
  return {
    id: leader.id,
    name: leader.name,
    login: leader.login,
    email: leader.email || '',
    cargo: leader.cargo || '',
    role: leader.role,
    ministry_id: leader.ministryId,
    active: Boolean(leader.active),
    password_hash: leader.passwordHash,
    created_at: leader.createdAt,
    last_login_at: leader.lastLoginAt ?? null
  };
}

export function rowToLeader(row: LeaderRow): StoredLeaderRecord {
  const role: LeaderRole = row.role === 'admin' ? 'admin' : 'leader';
  return {
    id: row.id,
    name: row.name,
    login: row.login,
    email: row.email || '',
    cargo: row.cargo || '',
    role,
    ministryId: role === 'admin' ? null : row.ministry_id,
    active: Boolean(row.active),
    passwordHash: row.password_hash,
    createdAt: Number(row.created_at) || Date.now(),
    ...(row.last_login_at !== null && row.last_login_at !== undefined
      ? { lastLoginAt: Number(row.last_login_at) }
      : {})
  };
}

export function scopeAppDataForUser(
  data: AppDomainState,
  user: LeaderUser | null
): AppDomainState {
  return {
    churchName: data.churchName,
    ministries: getScopedMinistries(data.ministries, user),
    members: getScopedMembers(data.members, user),
    services: data.services,
    schedules: scopeSchedulesForUser(data.schedules, user)
  };
}
