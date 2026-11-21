import { Assignment, LeaderRole, LeaderUser, Member, Ministry, Schedule } from '../types';

export interface DemoLeaderPreset {
  login: string;
  departmentLabel: string;
  leaderName: string;
  roleLabel: string;
}

export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

export function validateLoginCredentials(login: string, password: string): string | null {
  const cleanLogin = normalizeLogin(login);
  if (!cleanLogin) {
    return 'Informe seu login ou e-mail para continuar.';
  }
  if (!password || password.length < 4) {
    return 'Informe uma senha válida (mínimo de 4 caracteres).';
  }
  return null;
}

export function validateLeaderFormInput(input: {
  name: string;
  login: string;
  password?: string;
  requirePassword?: boolean;
  role: LeaderRole;
  ministryId: string | null;
}): string | null {
  if (!input.name.trim()) {
    return 'Informe o nome completo do líder.';
  }
  const cleanLogin = normalizeLogin(input.login);
  if (cleanLogin.length < 3) {
    return 'O login deve ter pelo menos 3 caracteres.';
  }
  if (!/^[a-z0-9._-]+$/.test(cleanLogin)) {
    return 'O login deve conter apenas letras, números, ponto, hífen ou sublinhado.';
  }
  if (input.role === 'leader' && !input.ministryId) {
    return 'Selecione o ministério/departamento sob responsabilidade deste líder.';
  }
  if (input.requirePassword || (input.password && input.password.length > 0)) {
    if (!input.password || input.password.length < 6) {
      return 'A senha deve conter pelo menos 6 caracteres.';
    }
  }
  return null;
}

export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): string | null {
  if (!currentPassword) {
    return 'Informe sua senha atual.';
  }
  if (!newPassword || newPassword.length < 6) {
    return 'A nova senha deve conter pelo menos 6 caracteres.';
  }
  if (newPassword === currentPassword) {
    return 'A nova senha precisa ser diferente da senha atual.';
  }
  if (newPassword !== confirmPassword) {
    return 'A confirmação da nova senha não confere.';
  }
  return null;
}

export function validateRecoveryRequestInput(identifier: string): string | null {
  const clean = normalizeLogin(identifier);
  if (clean.length < 2) {
    return 'Informe seu login ou e-mail cadastrado para recuperar o acesso.';
  }
  return null;
}

export function validateRecoveryConfirmInput(input: {
  identifier: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}): string | null {
  const cleanIdentifier = normalizeLogin(input.identifier);
  if (cleanIdentifier.length < 2) {
    return 'Informe seu login ou e-mail cadastrado.';
  }
  const cleanCode = input.code.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return 'Informe o código numérico de 6 dígitos fornecido pela Coordenação Geral.';
  }
  if (!input.newPassword || input.newPassword.length < 6) {
    return 'A nova senha deve conter pelo menos 6 caracteres.';
  }
  if (input.newPassword !== input.confirmPassword) {
    return 'A confirmação da nova senha não confere.';
  }
  return null;
}

export function canManageMinistry(user: LeaderUser | null, ministryId: string): boolean {
  if (!user || !user.active) return false;
  if (user.role === 'admin') return true;
  return user.ministryId === ministryId;
}

export function canManageServicesAndMinistries(user: LeaderUser | null): boolean {
  if (!user || !user.active) return false;
  return user.role === 'admin';
}

export function canManageLeaderAccounts(user: LeaderUser | null): boolean {
  if (!user || !user.active) return false;
  return user.role === 'admin';
}

export function getScopedMinistries(ministries: Ministry[], user: LeaderUser | null): Ministry[] {
  if (!user || !user.active) return [];
  if (user.role === 'admin') return ministries;
  if (!user.ministryId) return [];
  return ministries.filter((m) => m.id === user.ministryId);
}

export function getScopedMembers(members: Member[], user: LeaderUser | null): Member[] {
  if (!user || !user.active) return [];
  if (user.role === 'admin') return members;
  if (!user.ministryId) return [];
  return members.filter((m) => m.ministryId === user.ministryId);
}

export function scopeScheduleForUser(schedule: Schedule, user: LeaderUser | null): Schedule {
  if (!user || !user.active) {
    return { ...schedule, assignments: {} };
  }
  if (user.role === 'admin') {
    return schedule;
  }
  if (!user.ministryId) {
    return { ...schedule, assignments: {} };
  }
  const ownAssignments = schedule.assignments[user.ministryId] || [];
  return {
    ...schedule,
    assignments: {
      [user.ministryId]: ownAssignments
    }
  };
}

export function scopeSchedulesForUser(schedules: Schedule[], user: LeaderUser | null): Schedule[] {
  return schedules.map((sch) => scopeScheduleForUser(sch, user));
}

export function mergeScheduleAssignmentsForUser(
  existingAssignments: Record<string, Assignment[]>,
  editedAssignments: Record<string, Assignment[]>,
  user: LeaderUser | null
): Record<string, Assignment[]> {
  if (!user || !user.active) {
    return existingAssignments;
  }
  if (user.role === 'admin') {
    return editedAssignments;
  }
  if (!user.ministryId) {
    return existingAssignments;
  }
  return {
    ...existingAssignments,
    [user.ministryId]: editedAssignments[user.ministryId] || []
  };
}

export function canDeleteFullSchedule(schedule: Schedule, user: LeaderUser | null): boolean {
  if (!user || !user.active) return false;
  if (user.role === 'admin') return true;
  if (!user.ministryId) return false;
  return Object.entries(schedule.assignments).every(
    ([minId, list]) => minId === user.ministryId || list.length === 0
  );
}

export function findMatchingSchedule(
  schedules: Schedule[],
  dateIso: string,
  serviceId: string
): Schedule | undefined {
  return schedules.find((s) => s.dateIso === dateIso && s.serviceId === serviceId);
}

export function getDefaultLeaderPresets(): DemoLeaderPreset[] {
  return [
    {
      login: 'admin',
      departmentLabel: 'Coordenação Geral',
      leaderName: 'Pr. Lucas Ribeiro',
      roleLabel: 'Acesso Total'
    },
    {
      login: 'louvor',
      departmentLabel: 'Louvor & Adoração',
      leaderName: 'Camila Fernandes',
      roleLabel: 'Líder de Louvor'
    },
    {
      login: 'midia',
      departmentLabel: 'Mídia & Transmissão',
      leaderName: 'Beatriz Lima',
      roleLabel: 'Líder de Mídia'
    },
    {
      login: 'recepcao',
      departmentLabel: 'Recepção & Boas-Vindas',
      leaderName: 'Juliana Barbosa',
      roleLabel: 'Líder de Recepção'
    },
    {
      login: 'infantil',
      departmentLabel: 'Ministério Infantil',
      leaderName: 'Tia Débora Santos',
      roleLabel: 'Coordenadora Infantil'
    },
    {
      login: 'diaconato',
      departmentLabel: 'Diaconato & Apoio',
      leaderName: 'Diácono Paulo Andrade',
      roleLabel: 'Diácono Chefe'
    }
  ];
}
