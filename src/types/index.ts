/**
 * Modelos de Dados - Escala Fácil
 * Conforme especificação com.example.data
 */

export interface Ministry {
  id: string;
  name: string;
  locais: string[]; // Postos/funções específicas (ex: "Bateria", "Recepção Porta A")
  color?: string;   // Cor temática para badges no Material Design 3
}

export interface Member {
  id: string;
  name: string;
  cargo: string;    // ex: "Líder", "Músico", "Voluntário", "Diácono", "Operador de Áudio"
  phone: string;    // ex: "5511999998888"
  ministryId: string;
  locais: string[]; // Funções que este membro está habilitado a exercer
  email?: string;
  avatarUrl?: string;
}

export interface Service {
  id: string;
  label: string;    // ex: "Culto de Domingo Noite (19h)", "Quarta da Vitória (20h)"
  dayOfWeek?: string; // ex: "Domingo", "Quarta-feira", "Sábado"
  time?: string;      // ex: "19:00"
}

export interface Assignment {
  id: string;
  memberId: string;
  local: string;     // Posto/função
  present: boolean;  // Controle de assiduidade/presença
}

export interface Schedule {
  id: string;
  dateIso: string;   // YYYY-MM-DD
  serviceId: string;
  serviceLabel: string;
  assignments: Record<string, Assignment[]>; // ministryId -> Lista de atribuições
  note: string;
  createdAt: number;
}

export interface ConflictInfo {
  memberId: string;
  memberName: string;
  scheduleId: string;
  serviceLabel: string;
  dateIso: string;
  ministryIds: string[];
  locais: string[];
}

export type LeaderRole = 'admin' | 'leader';

export interface LeaderUser {
  id: string;
  name: string;
  login: string;
  email: string;
  cargo: string;
  role: LeaderRole;
  ministryId: string | null; // null quando Coordenação Geral (acesso total)
  active: boolean;
  createdAt: number;
  lastLoginAt?: number;
}

export interface CreateLeaderPayload {
  name: string;
  login: string;
  email: string;
  cargo: string;
  role: LeaderRole;
  ministryId: string | null;
  password: string;
}

export interface UpdateLeaderPayload {
  name?: string;
  login?: string;
  email?: string;
  cargo?: string;
  role?: LeaderRole;
  ministryId?: string | null;
  active?: boolean;
  password?: string;
}

export type PasswordResetStatus = 'pending' | 'code_issued' | 'completed';

export interface PasswordResetRequest {
  id: string;
  leaderId: string;
  leaderLogin: string;
  leaderName: string;
  ministryId: string | null;
  contactNote: string;
  status: PasswordResetStatus;
  createdAt: number;
  expiresAt?: number | null;
}

export type NotificationCategory = 'service' | 'schedule' | 'ministry' | 'member';

export type NotificationTargetTab =
  | 'dashboard'
  | 'schedules'
  | 'services'
  | 'ministries'
  | 'members'
  | 'attendance';

export interface LeaderNotification {
  id: string;
  category: NotificationCategory;
  ministryId: string | null;
  title: string;
  message: string;
  targetTab: NotificationTargetTab;
  targetId?: string | null;
  actorName: string;
  createdAt: number;
  readBy: string[];
}
