import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Church,
  Clock,
  Plus,
  UserCheck,
  Users2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { LeaderNotification } from '../../types';
import { getScopedMinistries } from '../../utils/authRules';
import {
  buildDashboardSummary,
  formatLeaderGreetingName,
  formatRelativeNotificationTimePtBr,
  WeeklyAttendancePoint
} from '../../utils/dashboardMetrics';

type NotificationFilter = 'all' | 'unread' | 'services' | 'department';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WeeklyAttendancePoint }>;
  isDark: boolean;
}

const WeeklyAttendanceTooltip: React.FC<ChartTooltipProps> = ({ active, payload, isDark }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 text-xs shadow-lg ${
        isDark
          ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
          : 'bg-white border-slate-200 text-slate-800'
      }`}
    >
      <p className="font-bold text-slate-900 dark:text-white">
        Semana {point.rangeLabel}
      </p>
      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
        {point.totalEscalas} {point.totalEscalas === 1 ? 'escala' : 'escalas'} no período
      </p>
      <div className="mt-2 space-y-1 tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300">
            <span className="h-2 w-2 rounded-xs bg-[#2F9B45]" />
            Confirmados
          </span>
          <span className="font-bold text-[#1B7A32] dark:text-[#42bb5b]">
            {point.confirmados}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300">
            <span className="h-2 w-2 rounded-xs bg-[#F7B13D]" />
            Pendentes
          </span>
          <span className="font-bold text-amber-600 dark:text-amber-400">
            {point.pendentes}
          </span>
        </div>
        <div className="pt-1 mt-1 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-zinc-400">Taxa de presença</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {point.totalAtribuicoes > 0 ? `${point.taxaPresenca}%` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const DashboardScreen: React.FC = () => {
  const {
    ministries,
    members,
    services,
    schedules,
    churchName,
    isDark,
    setActiveTab,
    setSelectedScheduleId,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead
  } = useApp();

  const { user } = useAuth();
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>('all');

  const scopedMinistries = useMemo(
    () => getScopedMinistries(ministries, user),
    [ministries, user]
  );

  const activeDepartment = user?.role === 'leader' ? scopedMinistries[0] || null : null;

  const summary = useMemo(
    () =>
      buildDashboardSummary({
        user,
        ministries,
        members,
        services,
        schedules
      }),
    [user, ministries, members, services, schedules]
  );

  const ministryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    ministries.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [ministries]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (notifFilter === 'unread') {
        return user ? !item.readBy.includes(user.id) : false;
      }
      if (notifFilter === 'services') {
        return item.category === 'service' || item.ministryId === null;
      }
      if (notifFilter === 'department') {
        return item.ministryId !== null;
      }
      return true;
    });
  }, [notifications, notifFilter, user]);

  const handleOpenSchedule = (scheduleId: string | null) => {
    if (scheduleId) {
      setSelectedScheduleId(scheduleId);
    }
    setActiveTab('schedules');
  };

  const handleOpenNotification = async (item: LeaderNotification) => {
    if (user && !item.readBy.includes(user.id)) {
      await markNotificationRead(item.id);
    }
    if (item.targetTab === 'schedules' && item.targetId) {
      setSelectedScheduleId(item.targetId);
    }
    setActiveTab(item.targetTab || 'schedules');
  };

  const renderCategoryIcon = (category: LeaderNotification['category']) => {
    switch (category) {
      case 'service':
        return <Church className="w-4 h-4 text-[#2F9B45] dark:text-[#42bb5b]" />;
      case 'ministry':
        return <Users2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'member':
        return <UserCheck className="w-4 h-4 text-[#1B7A32] dark:text-[#42bb5b]" />;
      case 'schedule':
      default:
        return <CalendarDays className="w-4 h-4 text-[#2F9B45] dark:text-[#42bb5b]" />;
    }
  };

  const getNotificationScopeLabel = (item: LeaderNotification): string => {
    if (item.category === 'service') return 'Cultos';
    if (item.ministryId) {
      return ministryNameMap.get(item.ministryId) || 'Departamento';
    }
    return 'Geral · Todos os Departamentos';
  };

  const hasChartData = summary.weeklyAttendance.some((w) => w.totalAtribuicoes > 0);
  const nextService = summary.nextService;

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 sm:pb-8">
      {/* Header / Scope Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#1B7A32] dark:text-[#42bb5b] truncate">
            {activeDepartment
              ? `Painel do Departamento · ${activeDepartment.name}`
              : `Coordenação Geral · ${churchName}`}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Olá, {formatLeaderGreetingName(user?.name)}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            {activeDepartment
              ? `Acompanhe o próximo culto, voluntários e atualizações de ${activeDepartment.name}.`
              : 'Visão consolidada dos próximos cultos, voluntários ativos e alertas ministeriais.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('schedules')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:border-[#2F9B45] transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <CalendarDays className="w-4 h-4 text-[#2F9B45]" />
            <span>Ver Escalas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#2F9B45] hover:bg-[#1B7A32] text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Voluntários</span>
          </button>
        </div>
      </div>

      {/* 3 Primary KPI Summary Cards */}
      <section aria-label="Indicadores Principais" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Próximo Culto */}
        <button
          type="button"
          onClick={() => handleOpenSchedule(nextService?.scheduleId || null)}
          className={`text-left rounded-2xl border p-4 sm:p-5 transition hover:border-[#2F9B45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F9B45] ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Próximo Culto
            </span>
            <Church className="w-4 h-4 text-[#2F9B45] dark:text-[#42bb5b] shrink-0" />
          </div>

          {nextService ? (
            <>
              <p className="mt-2.5 text-base sm:text-lg font-bold leading-snug text-slate-900 dark:text-white line-clamp-2">
                {nextService.serviceLabel}
              </p>

              <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 tabular-nums flex items-center gap-1.5 flex-wrap">
                <Clock className="w-3.5 h-3.5 text-[#F7B13D] shrink-0" />
                <span>{nextService.relativeLabel}</span>
                {nextService.dateIso && <span>· {nextService.dayMonth}</span>}
                {nextService.timeLabel && <span>· {nextService.timeLabel}</span>}
              </p>

              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#1B7A32] dark:text-[#42bb5b] tabular-nums">
                  {nextService.hasSchedule
                    ? `${nextService.totalPresent}/${nextService.totalAssigned} confirmados`
                    : 'Sem escala criada'}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-zinc-400">
                  <span>{nextService.hasSchedule ? 'Abrir' : 'Escalar'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </>
          ) : (
            <div className="mt-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                Nenhum culto cadastrado
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Cadastre os horários regulares para iniciar as escalas.
              </p>
            </div>
          )}
        </button>

        {/* Card 2: Total de Voluntários Ativos */}
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`text-left rounded-2xl border p-4 sm:p-5 transition hover:border-[#2F9B45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F9B45] ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Total de Voluntários Ativos
            </span>
            <UserCheck className="w-4 h-4 text-[#2F9B45] dark:text-[#42bb5b] shrink-0" />
          </div>

          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {summary.volunteers.totalActive}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              {activeDepartment ? `em ${activeDepartment.name}` : 'na igreja'}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
            {summary.volunteers.scheduledInUpcoming} escalados nos próximos cultos ·{' '}
            {summary.volunteers.rolesCount}{' '}
            {summary.volunteers.rolesCount === 1 ? 'posto' : 'postos'}
          </p>

          <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-600 dark:text-zinc-300 tabular-nums">
              {summary.volunteers.departmentCount}{' '}
              {summary.volunteers.departmentCount === 1 ? 'departamento' : 'departamentos'}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-zinc-400">
              <span>Gerenciar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* Card 3: Alertas de Escalas Pendentes */}
        <button
          type="button"
          onClick={() => {
            const firstAlert = summary.pendingAlerts.alerts[0];
            handleOpenSchedule(firstAlert ? firstAlert.scheduleId : null);
          }}
          className={`text-left rounded-2xl border p-4 sm:p-5 transition hover:border-[#2F9B45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F9B45] ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Alertas de Escalas Pendentes
            </span>
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${
                summary.pendingAlerts.totalAlerts > 0
                  ? 'text-amber-500'
                  : 'text-[#2F9B45] dark:text-[#42bb5b]'
              }`}
            />
          </div>

          <div className="mt-2.5 flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold tracking-tight tabular-nums ${
                summary.pendingAlerts.highPriorityCount > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {summary.pendingAlerts.totalAlerts}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              {summary.pendingAlerts.totalAlerts === 1
                ? 'pendência identificada'
                : 'pendências identificadas'}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
            {summary.pendingAlerts.totalAlerts === 0
              ? 'Todas as próximas escalas estão completas e confirmadas'
              : `${summary.pendingAlerts.highPriorityCount} prioritária(s) · ${summary.pendingAlerts.unconfirmedCount} confirmação(ões) aberta(s)`}
          </p>

          <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs">
            <span
              className={`font-semibold ${
                summary.pendingAlerts.totalAlerts > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-[#1B7A32] dark:text-[#42bb5b]'
              }`}
            >
              {summary.pendingAlerts.totalAlerts > 0 ? 'Ação recomendada' : 'Tudo em dia'}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-zinc-400">
              <span>Revisar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>
      </section>

      {/* Main Analytics + Pending Schedule Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left 7 cols: Recharts Weekly Attendance Chart */}
        <section
          aria-label="Gráfico de Presença Semanal"
          className={`lg:col-span-7 rounded-2xl border p-4 sm:p-5 ${
            isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Presença Semanal dos Voluntários
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                Média de confirmação: {summary.overallWeeklyRate}% ·{' '}
                {summary.totalWeeklySchedules}{' '}
                {summary.totalWeeklySchedules === 1 ? 'escala' : 'escalas'} nas últimas 4 semanas
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-zinc-300 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#2F9B45]" />
                Confirmados
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#F7B13D]" />
                Pendentes
              </span>
            </div>
          </div>

          {hasChartData ? (
            <div className="mt-4 h-[260px] w-full min-w-0">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={summary.weeklyAttendance}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  barGap={6}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={isDark ? '#27272a' : '#e2e8f0'}
                  />
                  <XAxis
                    dataKey="weekLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: isDark ? '#a1a1aa' : '#64748b',
                      fontSize: 11
                    }}
                    dy={6}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    tick={{
                      fill: isDark ? '#a1a1aa' : '#64748b',
                      fontSize: 11
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}
                    content={<WeeklyAttendanceTooltip isDark={isDark} />}
                  />
                  <Bar
                    dataKey="confirmados"
                    name="Confirmados"
                    fill="#2F9B45"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={34}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="pendentes"
                    name="Pendentes"
                    fill="#F7B13D"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={34}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center text-center px-4">
              <CalendarDays className="w-8 h-8 text-slate-300 dark:text-zinc-600 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                Ainda sem dados de presença semanal
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xs">
                Escale voluntários nos próximos cultos para acompanhar a evolução de presenças por semana.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('schedules')}
                className="mt-3 px-3.5 py-2 rounded-xl bg-[#2F9B45] text-white text-xs font-bold hover:bg-[#1B7A32] transition"
              >
                Criar Primeira Escala
              </button>
            </div>
          )}
        </section>

        {/* Right 5 cols: Pending Schedule Alerts List */}
        <section
          aria-label="Alertas de Escalas Pendentes"
          className={`lg:col-span-5 rounded-2xl border p-4 sm:p-5 flex flex-col ${
            isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Alertas de Escalas Pendentes
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                {summary.pendingAlerts.totalAlerts > 0
                  ? `${summary.pendingAlerts.totalAlerts} item(ns) requerem conferência`
                  : 'Nenhuma pendência nos próximos cultos'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('schedules')}
              className="text-xs font-semibold text-[#1B7A32] dark:text-[#42bb5b] hover:underline whitespace-nowrap shrink-0"
            >
              Ver escalas
            </button>
          </div>

          {summary.pendingAlerts.alerts.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800 flex-1">
              {summary.pendingAlerts.alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="py-3 first:pt-3 last:pb-1 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          alert.severity === 'high' ? 'bg-amber-500' : 'bg-[#2F9B45]'
                        }`}
                      />
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {alert.title}
                      </p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 truncate">
                      {alert.serviceLabel} · {alert.dayMonth} ({alert.relativeLabel})
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      {alert.detail}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenSchedule(alert.scheduleId)}
                    className="min-h-[40px] sm:min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:border-[#2F9B45] hover:text-[#1B7A32] dark:hover:text-[#42bb5b] transition whitespace-nowrap shrink-0"
                  >
                    Abrir
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center px-4">
              <CheckCheck className="w-8 h-8 text-[#2F9B45] mb-2" />
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                Escalas em dia
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xs">
                Todos os próximos cultos do seu escopo estão com equipe escalada e confirmada.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Leader Notifications Feed (Cultos + Specific Department) */}
      <section
        aria-label="Notificações de Cultos e Departamentos"
        className={`rounded-2xl border p-4 sm:p-5 ${
          isDark
            ? 'bg-zinc-900 border-zinc-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-start gap-2.5">
            <Bell className="w-4 h-4 text-[#2F9B45] dark:text-[#42bb5b] mt-1 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Notificações de Cultos e Departamentos
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                {activeDepartment
                  ? `Atualizações dos cultos e de ${activeDepartment.name}`
                  : 'Atualizações gerais dos cultos e de todos os departamentos'}
                {unreadNotificationCount > 0
                  ? ` · ${unreadNotificationCount} não lida(s)`
                  : ' · Tudo lido'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 max-w-full">
            <div
              className={`inline-flex items-center p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full ${
                isDark ? 'bg-zinc-800' : 'bg-slate-100'
              }`}
              role="tablist"
              aria-label="Filtrar notificações"
            >
              {(
                [
                  { id: 'all', label: 'Todas' },
                  { id: 'unread', label: 'Não lidas' },
                  { id: 'services', label: 'Cultos' },
                  {
                    id: 'department',
                    label: activeDepartment ? 'Meu Depto' : 'Departamentos'
                  }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={notifFilter === tab.id}
                  onClick={() => setNotifFilter(tab.id)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg transition whitespace-nowrap shrink-0 ${
                    notifFilter === tab.id
                      ? 'bg-[#2F9B45] text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllNotificationsRead()}
                className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:border-[#2F9B45] transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[#2F9B45]" />
                <span>Marcar todas como lidas</span>
              </button>
            )}
          </div>
        </div>

        {filteredNotifications.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredNotifications.slice(0, 12).map((item) => {
              const isRead = user ? item.readBy.includes(user.id) : true;
              return (
                <div
                  key={item.id}
                  className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                    !isRead
                      ? isDark
                        ? 'bg-emerald-950/15 -mx-2 px-2 rounded-xl'
                        : 'bg-emerald-50/40 -mx-2 px-2 rounded-xl'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`mt-0.5 h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 ${
                        isDark
                          ? 'bg-zinc-800 border-zinc-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {renderCategoryIcon(item.category)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!isRead && (
                          <span
                            className="h-2 w-2 rounded-full bg-[#2F9B45] shrink-0"
                            aria-label="Não lida"
                          />
                        )}
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">
                        {item.message}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 tabular-nums">
                        {getNotificationScopeLabel(item)} ·{' '}
                        {formatRelativeNotificationTimePtBr(item.createdAt)} · por{' '}
                        {item.actorName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {!isRead && (
                      <button
                        type="button"
                        onClick={() => void markNotificationRead(item.id)}
                        className="min-h-[40px] sm:min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition flex items-center gap-1 whitespace-nowrap"
                        title="Marcar notificação como lida"
                      >
                        <Check className="w-3.5 h-3.5 text-[#2F9B45]" />
                        <span>Lida</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleOpenNotification(item)}
                      className="min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:border-[#2F9B45] hover:text-[#1B7A32] dark:hover:text-[#42bb5b] transition flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>Abrir</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center">
            <Bell className="w-7 h-7 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
              {notifFilter === 'unread'
                ? 'Nenhuma notificação pendente de leitura'
                : 'Nenhuma atualização encontrada neste filtro'}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Alterações em cultos, escalas, postos e voluntários aparecem aqui automaticamente.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
