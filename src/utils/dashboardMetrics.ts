import { LeaderUser, Member, Ministry, Schedule, Service } from '../types';
import {
  formatDateIso,
  getLocalTodayIso,
  padTwoDigits,
  parseDateIsoParts
} from './calendar';
import {
  getScopedMembers,
  getScopedMinistries,
  scopeSchedulesForUser
} from './authRules';
import { detectScheduleConflicts } from './rules';
import { formatRelativeServiceDatePtBr } from './mobileHelpers';

export interface NextServiceSummary {
  hasSchedule: boolean;
  scheduleId: string | null;
  serviceId: string;
  serviceLabel: string;
  dateIso: string | null;
  relativeLabel: string;
  dayMonth: string;
  weekdayShort: string;
  timeLabel: string | null;
  totalAssigned: number;
  totalPresent: number;
  pendingConfirmations: number;
  ministriesCovered: number;
  totalScopedMinistries: number;
}

export interface ActiveVolunteersSummary {
  totalActive: number;
  scheduledInUpcoming: number;
  departmentCount: number;
  rolesCount: number;
}

export type PendingAlertReason =
  | 'empty_department'
  | 'unconfirmed_presence'
  | 'schedule_conflict';

export interface PendingScheduleAlert {
  id: string;
  scheduleId: string;
  dateIso: string;
  relativeLabel: string;
  dayMonth: string;
  serviceLabel: string;
  reason: PendingAlertReason;
  severity: 'high' | 'medium';
  title: string;
  detail: string;
  pendingCount: number;
}

export interface PendingAlertsSummary {
  totalAlerts: number;
  highPriorityCount: number;
  unconfirmedCount: number;
  alerts: PendingScheduleAlert[];
}

export interface WeeklyAttendancePoint {
  weekStartIso: string;
  weekEndIso: string;
  weekLabel: string;
  rangeLabel: string;
  confirmados: number;
  pendentes: number;
  totalAtribuicoes: number;
  totalEscalas: number;
  taxaPresenca: number;
}

export interface DashboardSummary {
  nextService: NextServiceSummary | null;
  volunteers: ActiveVolunteersSummary;
  pendingAlerts: PendingAlertsSummary;
  weeklyAttendance: WeeklyAttendancePoint[];
  overallWeeklyRate: number;
  totalWeeklySchedules: number;
}

function extractTimeLabel(service: Service | undefined, label: string): string | null {
  if (service?.time && service.time.trim()) {
    return service.time.trim();
  }
  const match = label.match(/(\d{1,2}h(?:\d{2})?|\d{1,2}:\d{2})/i);
  return match ? match[1] : null;
}

function addDaysToIso(dateIso: string, deltaDays: number): string {
  const parts = parseDateIsoParts(dateIso);
  if (!parts) return dateIso;
  const d = new Date(parts.year, parts.monthIndex, parts.day + deltaDays);
  return formatDateIso(d.getFullYear(), d.getMonth(), d.getDate());
}

function getSundayWeekStartIso(dateIso: string): string {
  const parts = parseDateIsoParts(dateIso);
  if (!parts) return dateIso;
  const d = new Date(parts.year, parts.monthIndex, parts.day);
  const sunday = new Date(parts.year, parts.monthIndex, parts.day - d.getDay());
  return formatDateIso(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
}

function formatDayMonth(dateIso: string): string {
  const parts = parseDateIsoParts(dateIso);
  if (!parts) return dateIso;
  return `${padTwoDigits(parts.day)}/${padTwoDigits(parts.monthIndex + 1)}`;
}

export function buildNextServiceSummary(params: {
  scopedSchedules: Schedule[];
  scopedMinistries: Ministry[];
  services: Service[];
  todayIso?: string;
}): NextServiceSummary | null {
  const todayIso = params.todayIso ?? getLocalTodayIso();
  const upcomingSchedules = params.scopedSchedules
    .filter((sch) => sch.dateIso >= todayIso)
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.createdAt - b.createdAt);

  const nextSchedule = upcomingSchedules[0];

  if (nextSchedule) {
    const matchedService = params.services.find((s) => s.id === nextSchedule.serviceId);
    const rel = formatRelativeServiceDatePtBr(nextSchedule.dateIso, todayIso);
    let totalAssigned = 0;
    let totalPresent = 0;
    let ministriesCovered = 0;

    params.scopedMinistries.forEach((min) => {
      const list = (nextSchedule.assignments[min.id] || []).filter((item) => Boolean(item.memberId));
      if (list.length > 0) {
        ministriesCovered += 1;
      }
      list.forEach((item) => {
        totalAssigned += 1;
        if (item.present) totalPresent += 1;
      });
    });

    return {
      hasSchedule: true,
      scheduleId: nextSchedule.id,
      serviceId: nextSchedule.serviceId,
      serviceLabel: nextSchedule.serviceLabel,
      dateIso: nextSchedule.dateIso,
      relativeLabel: rel.relativeLabel,
      dayMonth: rel.dayMonth,
      weekdayShort: rel.weekdayShort,
      timeLabel: extractTimeLabel(matchedService, nextSchedule.serviceLabel),
      totalAssigned,
      totalPresent,
      pendingConfirmations: Math.max(0, totalAssigned - totalPresent),
      ministriesCovered,
      totalScopedMinistries: params.scopedMinistries.length
    };
  }

  const fallbackService = params.services[0];
  if (!fallbackService) {
    return null;
  }

  return {
    hasSchedule: false,
    scheduleId: null,
    serviceId: fallbackService.id,
    serviceLabel: fallbackService.label,
    dateIso: null,
    relativeLabel: fallbackService.dayOfWeek || 'Programação regular',
    dayMonth: fallbackService.dayOfWeek || '--/--',
    weekdayShort: fallbackService.dayOfWeek || '',
    timeLabel: extractTimeLabel(fallbackService, fallbackService.label),
    totalAssigned: 0,
    totalPresent: 0,
    pendingConfirmations: 0,
    ministriesCovered: 0,
    totalScopedMinistries: params.scopedMinistries.length
  };
}

export function buildPendingScheduleAlerts(params: {
  scopedSchedules: Schedule[];
  scopedMinistries: Ministry[];
  scopedMembers: Member[];
  todayIso?: string;
}): PendingAlertsSummary {
  const todayIso = params.todayIso ?? getLocalTodayIso();
  const upcoming = params.scopedSchedules
    .filter((sch) => sch.dateIso >= todayIso)
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  const alerts: PendingScheduleAlert[] = [];

  upcoming.forEach((sch) => {
    const rel = formatRelativeServiceDatePtBr(sch.dateIso, todayIso);
    const conflicts = detectScheduleConflicts(sch, params.scopedMembers);

    if (conflicts.length > 0) {
      alerts.push({
        id: `${sch.id}-conflict`,
        scheduleId: sch.id,
        dateIso: sch.dateIso,
        relativeLabel: rel.relativeLabel,
        dayMonth: rel.dayMonth,
        serviceLabel: sch.serviceLabel,
        reason: 'schedule_conflict',
        severity: 'high',
        title: 'Conflito de voluntário na escala',
        detail: `${conflicts[0].memberName} em ${conflicts[0].locais.length} funções simultâneas`,
        pendingCount: conflicts.length
      });
    }

    const emptyMinistries = params.scopedMinistries.filter((min) => {
      const list = (sch.assignments[min.id] || []).filter((item) => Boolean(item.memberId));
      return list.length === 0;
    });

    if (emptyMinistries.length > 0) {
      const deptText =
        emptyMinistries.length === 1
          ? `${emptyMinistries[0].name} sem voluntários escalados`
          : `${emptyMinistries.length} departamentos sem voluntários escalados`;

      alerts.push({
        id: `${sch.id}-empty`,
        scheduleId: sch.id,
        dateIso: sch.dateIso,
        relativeLabel: rel.relativeLabel,
        dayMonth: rel.dayMonth,
        serviceLabel: sch.serviceLabel,
        reason: 'empty_department',
        severity: 'high',
        title: 'Escala sem equipe definida',
        detail: deptText,
        pendingCount: emptyMinistries.length
      });
    }

    let unconfirmedCount = 0;
    params.scopedMinistries.forEach((min) => {
      const list = sch.assignments[min.id] || [];
      list.forEach((item) => {
        if (item.memberId && !item.present) {
          unconfirmedCount += 1;
        }
      });
    });

    if (unconfirmedCount > 0) {
      alerts.push({
        id: `${sch.id}-unconfirmed`,
        scheduleId: sch.id,
        dateIso: sch.dateIso,
        relativeLabel: rel.relativeLabel,
        dayMonth: rel.dayMonth,
        serviceLabel: sch.serviceLabel,
        reason: 'unconfirmed_presence',
        severity: 'medium',
        title: 'Confirmações pendentes',
        detail:
          unconfirmedCount === 1
            ? '1 voluntário aguardando confirmação de presença'
            : `${unconfirmedCount} voluntários aguardando confirmação`,
        pendingCount: unconfirmedCount
      });
    }
  });

  const severityOrder = (s: 'high' | 'medium') => (s === 'high' ? 0 : 1);
  alerts.sort(
    (a, b) =>
      severityOrder(a.severity) - severityOrder(b.severity) ||
      a.dateIso.localeCompare(b.dateIso)
  );

  return {
    totalAlerts: alerts.length,
    highPriorityCount: alerts.filter((a) => a.severity === 'high').length,
    unconfirmedCount: alerts
      .filter((a) => a.reason === 'unconfirmed_presence')
      .reduce((sum, a) => sum + a.pendingCount, 0),
    alerts
  };
}

export function buildWeeklyAttendanceSeries(params: {
  scopedSchedules: Schedule[];
  scopedMinistries: Ministry[];
  todayIso?: string;
  weeksCount?: number;
}): {
  series: WeeklyAttendancePoint[];
  overallWeeklyRate: number;
  totalWeeklySchedules: number;
} {
  const todayIso = params.todayIso ?? getLocalTodayIso();
  const weeksCount = params.weeksCount ?? 4;
  const currentWeekStart = getSundayWeekStartIso(todayIso);

  // Window covers (weeksCount - 2) past weeks, current week, and 1 upcoming week
  const startOffsetWeeks = -(weeksCount - 2);
  const weekStarts: string[] = [];
  for (let i = 0; i < weeksCount; i++) {
    weekStarts.push(addDaysToIso(currentWeekStart, (startOffsetWeeks + i) * 7));
  }

  const allowedMinistryIds = new Set(params.scopedMinistries.map((m) => m.id));

  const series: WeeklyAttendancePoint[] = weekStarts.map((weekStartIso) => {
    const weekEndIso = addDaysToIso(weekStartIso, 6);
    let confirmados = 0;
    let pendentes = 0;
    let totalEscalas = 0;

    params.scopedSchedules.forEach((sch) => {
      if (sch.dateIso >= weekStartIso && sch.dateIso <= weekEndIso) {
        totalEscalas += 1;
        Object.entries(sch.assignments).forEach(([minId, list]) => {
          if (allowedMinistryIds.size > 0 && !allowedMinistryIds.has(minId)) return;
          list.forEach((item) => {
            if (!item.memberId) return;
            if (item.present) {
              confirmados += 1;
            } else {
              pendentes += 1;
            }
          });
        });
      }
    });

    const totalAtribuicoes = confirmados + pendentes;
    const taxaPresenca =
      totalAtribuicoes > 0 ? Math.round((confirmados / totalAtribuicoes) * 100) : 0;

    return {
      weekStartIso,
      weekEndIso,
      weekLabel: formatDayMonth(weekStartIso),
      rangeLabel: `${formatDayMonth(weekStartIso)} a ${formatDayMonth(weekEndIso)}`,
      confirmados,
      pendentes,
      totalAtribuicoes,
      totalEscalas,
      taxaPresenca
    };
  });

  const totals = series.reduce(
    (acc, point) => {
      acc.confirmados += point.confirmados;
      acc.total += point.totalAtribuicoes;
      acc.escalas += point.totalEscalas;
      return acc;
    },
    { confirmados: 0, total: 0, escalas: 0 }
  );

  const overallWeeklyRate =
    totals.total > 0 ? Math.round((totals.confirmados / totals.total) * 100) : 100;

  return {
    series,
    overallWeeklyRate,
    totalWeeklySchedules: totals.escalas
  };
}

export function buildDashboardSummary(params: {
  user: LeaderUser | null;
  ministries: Ministry[];
  members: Member[];
  services: Service[];
  schedules: Schedule[];
  todayIso?: string;
}): DashboardSummary {
  const todayIso = params.todayIso ?? getLocalTodayIso();
  const scopedMinistries = getScopedMinistries(params.ministries, params.user);
  const scopedMembers = getScopedMembers(params.members, params.user);
  const scopedSchedules = scopeSchedulesForUser(params.schedules, params.user);

  const nextService = buildNextServiceSummary({
    scopedSchedules,
    scopedMinistries,
    services: params.services,
    todayIso
  });

  const upcomingMemberIds = new Set<string>();
  scopedSchedules
    .filter((sch) => sch.dateIso >= todayIso)
    .forEach((sch) => {
      Object.values(sch.assignments).forEach((list) => {
        list.forEach((item) => {
          if (item.memberId) {
            upcomingMemberIds.add(item.memberId);
          }
        });
      });
    });

  const volunteers: ActiveVolunteersSummary = {
    totalActive: scopedMembers.length,
    scheduledInUpcoming: upcomingMemberIds.size,
    departmentCount: scopedMinistries.length,
    rolesCount: scopedMinistries.reduce((sum, min) => sum + min.locais.length, 0)
  };

  const pendingAlerts = buildPendingScheduleAlerts({
    scopedSchedules,
    scopedMinistries,
    scopedMembers,
    todayIso
  });

  const { series, overallWeeklyRate, totalWeeklySchedules } = buildWeeklyAttendanceSeries({
    scopedSchedules,
    scopedMinistries,
    todayIso
  });

  return {
    nextService,
    volunteers,
    pendingAlerts,
    weeklyAttendance: series,
    overallWeeklyRate,
    totalWeeklySchedules
  };
}

export function formatRelativeNotificationTimePtBr(
  createdAt: number,
  nowMs: number = Date.now()
): string {
  const diffSec = Math.max(0, Math.floor((nowMs - createdAt) / 1000));
  if (diffSec < 60) return 'Agora mesmo';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  const d = new Date(createdAt);
  return `${padTwoDigits(d.getDate())}/${padTwoDigits(d.getMonth() + 1)}`;
}

const HONORIFIC_PREFIXES = new Set([
  'pr',
  'pr.',
  'pra',
  'pra.',
  'dc',
  'dc.',
  'ev',
  'ev.',
  'pb',
  'pb.',
  'ir',
  'ir.',
  'tia',
  'tio'
]);

export function formatLeaderGreetingName(fullName?: string | null): string {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Líder';
  const firstLower = parts[0].toLowerCase();
  if (HONORIFIC_PREFIXES.has(firstLower) && parts.length > 1) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0];
}
