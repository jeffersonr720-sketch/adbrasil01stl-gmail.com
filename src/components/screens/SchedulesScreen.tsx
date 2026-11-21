import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  getScopedMembers,
  getScopedMinistries,
  scopeSchedulesForUser
} from '../../utils/authRules';
import { Schedule } from '../../types';
import { detectScheduleConflicts } from '../../utils/rules';
import { getLocalTodayIso } from '../../utils/calendar';
import {
  formatRelativeServiceDatePtBr,
  getMobileScheduleStatus
} from '../../utils/mobileHelpers';
import { generateSchedulePdf } from '../../utils/pdfExport';
import { NewScheduleModal } from './NewScheduleModal';
import { ScheduleDetailModal } from './ScheduleDetailModal';
import { SchedulesCalendarView } from './SchedulesCalendarView';
import {
  Plus,
  Calendar,
  CalendarDays,
  List,
  Share2,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  X
} from 'lucide-react';

export const SchedulesScreen: React.FC = () => {
  const {
    schedules,
    services,
    ministries,
    members,
    churchName,
    isDark,
    searchQuery,
    setSearchQuery,
    selectedScheduleId,
    setSelectedScheduleId,
    showSnackbar
  } = useApp();

  const { user } = useAuth();

  const scopedMinistries = useMemo(
    () => getScopedMinistries(ministries, user),
    [ministries, user]
  );
  const scopedMembers = useMemo(
    () => getScopedMembers(members, user),
    [members, user]
  );
  const scopedSchedules = useMemo(
    () => scopeSchedulesForUser(schedules, user),
    [schedules, user]
  );

  const activeDepartment =
    user?.role === 'leader' ? scopedMinistries[0] || null : null;

  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [initialDateForNew, setInitialDateForNew] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [viewingScheduleId, setViewingScheduleId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedScheduleId) return;
    const exists = scopedSchedules.some((s) => s.id === selectedScheduleId);
    if (exists) {
      setViewingScheduleId(selectedScheduleId);
      setSelectedScheduleId(null);
    }
  }, [selectedScheduleId, scopedSchedules, setSelectedScheduleId]);

  const viewingSchedule = useMemo(
    () => scopedSchedules.find((s) => s.id === viewingScheduleId) || null,
    [scopedSchedules, viewingScheduleId]
  );
  const editingFullSchedule = useMemo(
    () => schedules.find((s) => s.id === editingScheduleId) || null,
    [schedules, editingScheduleId]
  );

  const allConflicts = useMemo(() => {
    return scopedSchedules.flatMap((sch) => detectScheduleConflicts(sch, scopedMembers));
  }, [scopedSchedules, scopedMembers]);

  const filteredSchedules = useMemo(() => {
    return scopedSchedules.filter((sch) => {
      const matchService =
        selectedServiceFilter === 'all' || sch.serviceId === selectedServiceFilter;
      const matchQuery =
        !searchQuery ||
        sch.serviceLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sch.dateIso.includes(searchQuery) ||
        sch.note.toLowerCase().includes(searchQuery.toLowerCase());
      return matchService && matchQuery;
    });
  }, [scopedSchedules, selectedServiceFilter, searchQuery]);

  const todayIso = useMemo(() => getLocalTodayIso(), []);

  const nextSchedule = useMemo(() => {
    if (scopedSchedules.length === 0) return null;
    const sorted = [...scopedSchedules].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    return sorted.find((s) => s.dateIso >= todayIso) || sorted[sorted.length - 1];
  }, [scopedSchedules, todayIso]);

  const getScopedSummary = (sch: Schedule) => {
    let totalAssigned = 0;
    let totalPresent = 0;
    const activeMinistryIds: string[] = [];

    Object.entries(sch.assignments).forEach(([minId, list]) => {
      if (list.length > 0 && scopedMinistries.some((m) => m.id === minId)) {
        activeMinistryIds.push(minId);
        list.forEach((item) => {
          if (item.memberId) {
            totalAssigned += 1;
            if (item.present) totalPresent += 1;
          }
        });
      }
    });

    return {
      totalAssigned,
      totalPresent,
      activeMinistryIds,
      status: getMobileScheduleStatus(totalAssigned, totalPresent)
    };
  };

  const handleQuickPdf = (e: React.MouseEvent, sch: Schedule) => {
    e.stopPropagation();
    generateSchedulePdf(sch, scopedMinistries, scopedMembers, churchName);
    showSnackbar('Escala em PDF gerada com sucesso!');
  };

  const handleQuickWhatsApp = (e: React.MouseEvent, sch: Schedule) => {
    e.stopPropagation();
    setViewingScheduleId(sch.id);
  };

  const openCreateNew = () => {
    setEditingScheduleId(null);
    setInitialDateForNew(null);
    setIsNewModalOpen(true);
  };

  const nextScheduleSummary = nextSchedule ? getScopedSummary(nextSchedule) : null;
  const nextScheduleDateInfo = nextSchedule
    ? formatRelativeServiceDatePtBr(nextSchedule.dateIso, todayIso)
    : null;

  return (
    <div className="space-y-4 sm:space-y-5 pb-6 sm:pb-8 relative min-h-full w-full touch-manipulation">
      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1B7A32] dark:text-[#42bb5b] mb-0.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {user?.role === 'admin'
                ? 'Visão Geral · Todos os Departamentos'
                : `Departamento: ${activeDepartment?.name || 'Seu Setor'}`}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-baseline gap-2">
            <span>Escalas de Cultos</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tabular-nums">
              · {scopedSchedules.length} {scopedSchedules.length === 1 ? 'culto' : 'cultos'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {user?.role === 'admin'
              ? 'Toque em um culto para confirmar presenças, enviar no WhatsApp ou baixar em PDF'
              : `Toque em um culto para montar a escala de ${activeDepartment?.name || 'seu setor'} e fazer a chamada`}
          </p>
        </div>

        {/* View Toggle & Primary Create CTA (Always visible on mobile & desktop) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 shrink-0">
          <div
            role="group"
            aria-label="Modo de visualização das escalas"
            className={`flex items-center p-1 rounded-2xl text-xs font-bold border ${
              isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={`min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition active:scale-95 whitespace-nowrap ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-900 text-[#1B7A32] dark:text-[#42bb5b] shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              aria-pressed={viewMode === 'calendar'}
              className={`min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition active:scale-95 whitespace-nowrap ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-zinc-900 text-[#1B7A32] dark:text-[#42bb5b] shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-4 h-4 text-[#F7B13D]" />
              <span>Calendário</span>
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateNew}
            className="min-h-[44px] flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs shadow-sm transition-all active:scale-95 shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#F7B13D]" />
            <span>Nova Escala</span>
          </button>
        </div>
      </div>

      {/* Active Search Indicator on Mobile */}
      {searchQuery && (
        <div
          className={`px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 text-xs ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
              : 'bg-emerald-50/70 border-emerald-200 text-slate-800'
          }`}
        >
          <span className="truncate">
            Mostrando resultados para <strong>&quot;{searchQuery}&quot;</strong>
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="min-h-[36px] px-2.5 rounded-xl font-bold text-[#1B7A32] dark:text-[#42bb5b] flex items-center gap-1 shrink-0 hover:bg-emerald-100 dark:hover:bg-zinc-800"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        </div>
      )}

      {/* Next Scheduled Service Spotlight (List Mode) */}
      {viewMode === 'list' && nextSchedule && nextScheduleSummary && nextScheduleDateInfo && (
        <div
          className={`p-4 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-xs ${
            isDark
              ? 'bg-gradient-to-br from-emerald-950/45 via-zinc-900 to-zinc-900 border-emerald-800/60'
              : 'bg-gradient-to-br from-emerald-50 via-white to-white border-emerald-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setViewingScheduleId(nextSchedule.id)}
            className="flex items-start gap-3 min-w-0 flex-1 text-left focus-visible:outline-none group"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#2F9B45] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Calendar className="w-5 h-5 text-[#F7B13D]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#1B7A32] dark:text-[#42bb5b]">
                <span>Próximo Culto</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {nextScheduleDateInfo.relativeLabel} ({nextScheduleDateInfo.dayMonth})
                </span>
              </div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white truncate group-hover:text-[#2F9B45] transition-colors">
                {nextSchedule.serviceLabel}
              </h2>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 tabular-nums">
                {nextScheduleSummary.status.label}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                if (nextScheduleSummary.totalAssigned === 0) {
                  setEditingScheduleId(nextSchedule.id);
                  setIsNewModalOpen(true);
                } else {
                  setViewingScheduleId(nextSchedule.id);
                }
              }}
              className="flex-1 sm:flex-none min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs shadow-xs active:scale-95 transition whitespace-nowrap"
            >
              <span>
                {nextScheduleSummary.totalAssigned === 0 ? 'Montar Escala' : 'Fazer Chamada'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => handleQuickPdf(e, nextSchedule)}
              className="min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold text-xs bg-[#F7B13D]/15 text-[#8f5200] dark:text-[#F7B13D] border border-[#F7B13D]/40 active:scale-95 transition whitespace-nowrap"
              aria-label={`Baixar PDF de ${nextSchedule.serviceLabel}`}
            >
              <FileDown className="w-4 h-4" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Scoped Conflict Alert Banner */}
      {allConflicts.length > 0 && (
        <div
          className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
            isDark
              ? 'bg-amber-950/40 border-amber-800 text-amber-200'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Atenção: voluntário em dois postos no mesmo culto</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              {allConflicts.map((c, i) => (
                <span key={i} className="block">
                  • <strong>{c.memberName}</strong> ({c.serviceLabel})
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      {/* Service Filter Pills - Touch Scroll */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar touch-pan-x">
        <button
          type="button"
          onClick={() => setSelectedServiceFilter('all')}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 active:scale-95 whitespace-nowrap ${
            selectedServiceFilter === 'all'
              ? 'bg-[#2F9B45] text-white shadow-xs'
              : isDark
              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Todos ({scopedSchedules.length})
        </button>
        {services.map((srv) => {
          const count = scopedSchedules.filter((s) => s.serviceId === srv.id).length;
          return (
            <button
              type="button"
              key={srv.id}
              onClick={() => setSelectedServiceFilter(srv.id)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 active:scale-95 whitespace-nowrap ${
                selectedServiceFilter === srv.id
                  ? 'bg-[#2F9B45] text-white shadow-xs'
                  : isDark
                  ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {srv.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Schedules Calendar or List */}
      {viewMode === 'calendar' ? (
        <SchedulesCalendarView
          schedules={filteredSchedules}
          ministries={scopedMinistries}
          members={scopedMembers}
          isDark={isDark}
          onSelectSchedule={(sch) => setViewingScheduleId(sch.id)}
          onCreateScheduleForDate={(dateIso) => {
            setEditingScheduleId(null);
            setInitialDateForNew(dateIso);
            setIsNewModalOpen(true);
          }}
          onQuickPdf={handleQuickPdf}
          onQuickWhatsApp={handleQuickWhatsApp}
        />
      ) : filteredSchedules.length === 0 ? (
        <div
          className={`p-8 sm:p-10 rounded-3xl text-center border transition-colors ${
            isDark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400' : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          <Calendar className="w-10 h-10 mx-auto text-[#2F9B45] opacity-60 mb-3" />
          <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200">
            Nenhuma escala encontrada
          </h3>
          <p className="text-xs mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Nenhum resultado corresponde à sua busca. Limpe o filtro para ver todos os cultos.'
              : 'Comece criando a primeira escala ministerial para o próximo culto.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={openCreateNew}
              className="mt-4 min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#2F9B45] text-white hover:bg-[#258239] shadow-sm active:scale-95 transition"
            >
              Criar Primeira Escala
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {filteredSchedules.map((schedule) => {
            const dateInfo = formatRelativeServiceDatePtBr(schedule.dateIso, todayIso);
            const { totalAssigned, activeMinistryIds, status } = getScopedSummary(schedule);
            const conflicts = detectScheduleConflicts(schedule, scopedMembers);

            return (
              <div
                key={schedule.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 hover:border-[#2F9B45]/60'
                    : 'bg-white border-slate-200 hover:border-[#2F9B45]/50 shadow-xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setViewingScheduleId(schedule.id)}
                  className="text-left w-full group focus-visible:outline-none"
                >
                  {/* Date & Human-Readable Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#2F9B45] dark:text-[#42bb5b]">
                        <Calendar className="w-3.5 h-3.5 text-[#F7B13D] shrink-0" />
                        <span>{dateInfo.relativeLabel}</span>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="tabular-nums text-slate-600 dark:text-zinc-400 font-semibold">
                          {dateInfo.fullFormatted}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1 truncate group-hover:text-[#2F9B45] transition-colors">
                        {schedule.serviceLabel}
                      </h3>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0 flex items-center gap-1 tabular-nums ${
                        status.tone === 'pending'
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/70'
                          : status.tone === 'complete'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          status.tone === 'pending' ? 'text-amber-500' : 'text-[#2F9B45]'
                        }`}
                      />
                      <span>{status.shortLabel}</span>
                    </span>
                  </div>

                  {/* Slim Confirmation Progress Bar */}
                  {totalAssigned > 0 && (
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden mt-2.5">
                      <div
                        className="h-full bg-[#2F9B45] rounded-full transition-all duration-300"
                        style={{ width: `${status.percent}%` }}
                      />
                    </div>
                  )}

                  {/* Conflict alert in this card */}
                  {conflicts.length > 0 && (
                    <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-[11px] font-semibold flex items-center gap-1.5 border border-red-200 dark:border-red-900">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                      <span>{conflicts.length} conflito(s) de voluntário</span>
                    </div>
                  )}

                  {/* Scoped Department Summary (unboxed clean text) */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5 text-xs text-slate-600 dark:text-zinc-400">
                    {activeMinistryIds.length > 0 ? (
                      activeDepartment ? (
                        <span className="font-medium text-slate-700 dark:text-zinc-300">
                          {activeDepartment.name}: {totalAssigned} de {activeDepartment.locais.length} postos preenchidos
                        </span>
                      ) : (
                        activeMinistryIds.map((minId, idx) => {
                          const min = scopedMinistries.find((m) => m.id === minId);
                          if (!min) return null;
                          return (
                            <span key={min.id} className="inline-flex items-center gap-1">
                              {idx > 0 && <span aria-hidden="true" className="text-slate-400 mr-1">·</span>}
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: min.color || '#2F9B45' }}
                              />
                              <span>{min.name}</span>
                            </span>
                          );
                        })
                      )
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300 font-medium">
                        {activeDepartment
                          ? `${activeDepartment.name}: escala pendente neste culto`
                          : 'Nenhum voluntário escalado ainda'}
                      </span>
                    )}
                  </div>

                  {schedule.note && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2 line-clamp-1 italic">
                      &quot;{schedule.note}&quot;
                    </p>
                  )}
                </button>

                {/* Card Touch Action Footer (>= 44px targets) */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleQuickWhatsApp(e, schedule)}
                      className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-[#2F9B45]/10 text-[#1B7A32] dark:text-[#42bb5b] hover:bg-[#2F9B45] hover:text-white transition border border-[#2F9B45]/25 active:scale-95"
                      title="Compartilhar no WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleQuickPdf(e, schedule)}
                      className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-[#F7B13D]/15 text-[#8f5200] dark:text-[#F7B13D] hover:bg-[#F7B13D] hover:text-slate-900 transition border border-[#F7B13D]/40 active:scale-95"
                      title="Baixar Escala do Culto em PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingScheduleId(schedule.id)}
                    className="min-h-[44px] px-2.5 flex items-center text-xs font-bold text-[#2F9B45] dark:text-[#42bb5b] gap-0.5 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded-xl transition active:scale-95"
                  >
                    <span>{totalAssigned === 0 ? 'Montar' : 'Chamada'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {isNewModalOpen && (
        <NewScheduleModal
          onClose={() => {
            setIsNewModalOpen(false);
            setEditingScheduleId(null);
            setInitialDateForNew(null);
          }}
          existingSchedule={editingFullSchedule}
          initialDateIso={initialDateForNew}
        />
      )}

      {viewingSchedule && (
        <ScheduleDetailModal
          schedule={viewingSchedule}
          onClose={() => setViewingScheduleId(null)}
          onEdit={() => {
            setEditingScheduleId(viewingSchedule.id);
            setViewingScheduleId(null);
            setIsNewModalOpen(true);
          }}
        />
      )}
    </div>
  );
};
