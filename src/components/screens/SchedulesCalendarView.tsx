import React, { useMemo, useState } from 'react';
import { Member, Ministry, Schedule } from '../../types';
import {
  WEEKDAY_SHORT_LABELS,
  buildMonthCalendarGrid,
  formatFullDatePtBr,
  formatShortDatePtBr,
  getLocalTodayIso,
  getMonthScheduleStats,
  getMonthTitlePtBr,
  getSchedulePresenceSummary,
  navigateMonth,
  parseDateIsoParts
} from '../../utils/calendar';
import { detectScheduleConflicts } from '../../utils/rules';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Plus,
  Share2
} from 'lucide-react';

interface Props {
  schedules: Schedule[];
  ministries: Ministry[];
  members: Member[];
  isDark: boolean;
  onSelectSchedule: (schedule: Schedule) => void;
  onCreateScheduleForDate: (dateIso: string) => void;
  onQuickPdf: (e: React.MouseEvent, schedule: Schedule) => void;
  onQuickWhatsApp: (e: React.MouseEvent, schedule: Schedule) => void;
}

export const SchedulesCalendarView: React.FC<Props> = ({
  schedules,
  ministries,
  members,
  isDark,
  onSelectSchedule,
  onCreateScheduleForDate,
  onQuickPdf,
  onQuickWhatsApp
}) => {
  const todayIso = useMemo(() => getLocalTodayIso(), []);

  // Initialize calendar to the month of the next/first schedule if present, else current month
  const initialMonthState = useMemo(() => {
    const todayParts = parseDateIsoParts(todayIso);
    if (schedules.length > 0) {
      const upcoming = schedules.find((s) => s.dateIso >= todayIso) || schedules[0];
      const parsed = parseDateIsoParts(upcoming.dateIso);
      if (parsed) {
        return { year: parsed.year, monthIndex: parsed.monthIndex, initialDay: upcoming.dateIso };
      }
    }
    return {
      year: todayParts ? todayParts.year : new Date().getFullYear(),
      monthIndex: todayParts ? todayParts.monthIndex : new Date().getMonth(),
      initialDay: todayIso
    };
  }, [todayIso]);

  const [viewYear, setViewYear] = useState<number>(initialMonthState.year);
  const [viewMonthIndex, setViewMonthIndex] = useState<number>(initialMonthState.monthIndex);
  const [selectedDateIso, setSelectedDateIso] = useState<string>(initialMonthState.initialDay);

  const monthTitle = useMemo(
    () => getMonthTitlePtBr(viewYear, viewMonthIndex),
    [viewYear, viewMonthIndex]
  );

  const calendarCells = useMemo(
    () => buildMonthCalendarGrid(viewYear, viewMonthIndex, schedules, todayIso),
    [viewYear, viewMonthIndex, schedules, todayIso]
  );

  const monthStats = useMemo(
    () => getMonthScheduleStats(viewYear, viewMonthIndex, schedules),
    [viewYear, viewMonthIndex, schedules]
  );

  const selectedDaySchedules = useMemo(() => {
    return schedules
      .filter((s) => s.dateIso === selectedDateIso)
      .sort((a, b) => a.serviceLabel.localeCompare(b.serviceLabel));
  }, [schedules, selectedDateIso]);

  const monthSchedulesList = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonthIndex + 1).padStart(2, '0')}-`;
    return schedules
      .filter((s) => s.dateIso.startsWith(prefix))
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  }, [schedules, viewYear, viewMonthIndex]);

  const handleShiftMonth = (delta: number) => {
    const next = navigateMonth(viewYear, viewMonthIndex, delta);
    setViewYear(next.year);
    setViewMonthIndex(next.monthIndex);
  };

  const handleGoToday = () => {
    const parsed = parseDateIsoParts(todayIso);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonthIndex(parsed.monthIndex);
      setSelectedDateIso(todayIso);
    }
  };

  const handleDayClick = (dateIso: string, isCurrentMonth: boolean) => {
    setSelectedDateIso(dateIso);
    if (!isCurrentMonth) {
      const parsed = parseDateIsoParts(dateIso);
      if (parsed) {
        setViewYear(parsed.year);
        setViewMonthIndex(parsed.monthIndex);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Card Container */}
      <section
        aria-label="Calendário Mensal de Escalas"
        className={`rounded-3xl border overflow-hidden transition-colors ${
          isDark
            ? 'bg-zinc-900 border-zinc-800'
            : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        {/* Month Header & Controls */}
        <div
          className={`px-3.5 sm:px-5 py-3 border-b flex items-center justify-between gap-2 ${
            isDark ? 'border-zinc-800 bg-zinc-950/50' : 'border-slate-100 bg-emerald-50/40'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#2F9B45] text-white flex items-center justify-center shrink-0 shadow-xs">
              <CalendarIcon className="w-4 h-4 text-[#F7B13D]" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate"
                data-testid="calendar-month-title"
              >
                {monthTitle}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 tabular-nums truncate">
                {monthStats.totalSchedules}{' '}
                {monthStats.totalSchedules === 1 ? 'culto' : 'cultos'} ·{' '}
                {monthStats.totalAssigned} escalados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleGoToday}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:border-[#2F9B45]'
                  : 'bg-white border-slate-200 text-[#1B7A32] hover:border-[#2F9B45]/50 shadow-2xs'
              }`}
            >
              Hoje
            </button>

            <div
              className={`flex items-center rounded-xl border p-0.5 ${
                isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => handleShiftMonth(-1)}
                aria-label="Mês anterior"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-zinc-700 hover:text-[#2F9B45] transition active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleShiftMonth(1)}
                aria-label="Próximo mês"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-zinc-700 hover:text-[#2F9B45] transition active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Weekday Headers */}
        <div
          className={`grid grid-cols-7 border-b text-center text-[11px] font-bold uppercase tracking-wider ${
            isDark
              ? 'border-zinc-800 bg-zinc-950/30 text-zinc-400'
              : 'border-slate-100 bg-slate-50/80 text-slate-500'
          }`}
        >
          {WEEKDAY_SHORT_LABELS.map((dayLabel, idx) => (
            <div
              key={dayLabel}
              className={`py-2 ${idx === 0 ? 'text-[#1B7A32] dark:text-[#42bb5b]' : ''}`}
            >
              {dayLabel}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-zinc-800/80">
          {calendarCells.map((cell) => {
            const isSelected = cell.dateIso === selectedDateIso;
            const hasSchedules = cell.schedules.length > 0;
            const formattedBtnDate = formatShortDatePtBr(cell.dateIso);

            return (
              <div
                key={cell.dateIso}
                className={`relative flex flex-col transition-colors ${
                  !cell.isCurrentMonth
                    ? isDark
                      ? 'bg-zinc-950/40 text-zinc-600'
                      : 'bg-slate-50/70 text-slate-400'
                    : isSelected
                    ? isDark
                      ? 'bg-emerald-950/35'
                      : 'bg-emerald-50/70'
                    : isDark
                    ? 'bg-zinc-900 hover:bg-zinc-800/50'
                    : 'bg-white hover:bg-slate-50/70'
                } min-h-[46px] md:min-h-[94px] p-0.5 md:p-1.5`}
              >
                {/* Mobile Full-Cell Select Button */}
                <button
                  type="button"
                  onClick={() => handleDayClick(cell.dateIso, cell.isCurrentMonth)}
                  aria-label={`${formattedBtnDate}, ${cell.schedules.length} culto(s)`}
                  aria-pressed={isSelected}
                  className="md:hidden w-full h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F9B45] active:scale-95 transition"
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                      isSelected
                        ? 'bg-[#2F9B45] text-white shadow-xs'
                        : cell.isToday
                        ? 'ring-2 ring-[#F7B13D] text-[#1B7A32] dark:text-[#42bb5b]'
                        : cell.isCurrentMonth
                        ? 'text-slate-800 dark:text-zinc-200'
                        : 'text-slate-400 dark:text-zinc-600'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {/* Event indicators for mobile */}
                  <div className="flex items-center justify-center gap-0.5 mt-1 min-h-[14px]">
                    {hasSchedules ? (
                      cell.schedules.slice(0, 3).map((sch, idx) => (
                        <span
                          key={sch.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            idx % 2 === 0 ? 'bg-[#2F9B45]' : 'bg-[#F7B13D]'
                          }`}
                        />
                      ))
                    ) : (
                      <span className="w-1.5 h-1.5 opacity-0" />
                    )}
                    {cell.schedules.length > 3 && (
                      <span className="text-[9px] font-bold text-[#1B7A32] dark:text-[#42bb5b] leading-none">
                        +
                      </span>
                    )}
                  </div>
                </button>

                {/* Desktop Day Header Row */}
                <div className="hidden md:flex items-center justify-between gap-1 mb-1.5">
                  <button
                    type="button"
                    onClick={() => handleDayClick(cell.dateIso, cell.isCurrentMonth)}
                    aria-label={`Selecionar ${formattedBtnDate}`}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold tabular-nums transition ${
                      isSelected
                        ? 'bg-[#2F9B45] text-white shadow-xs'
                        : cell.isToday
                        ? 'ring-2 ring-[#F7B13D] text-[#1B7A32] dark:text-[#42bb5b]'
                        : cell.isCurrentMonth
                        ? 'text-slate-800 dark:text-zinc-200 hover:bg-slate-200/70 dark:hover:bg-zinc-700'
                        : 'text-slate-400 dark:text-zinc-600'
                    }`}
                  >
                    {cell.dayNumber}
                  </button>

                  <button
                    type="button"
                    onClick={() => onCreateScheduleForDate(cell.dateIso)}
                    aria-label={`Criar escala em ${formattedBtnDate}`}
                    title={`Criar escala em ${formattedBtnDate}`}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition opacity-50 hover:opacity-100 focus-visible:opacity-100 ${
                      isDark
                        ? 'text-zinc-400 hover:bg-zinc-700 hover:text-white'
                        : 'text-slate-500 hover:bg-emerald-100 hover:text-[#1B7A32]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Desktop Event Pills */}
                <div className="hidden md:flex flex-col gap-1 flex-1 overflow-hidden">
                  {cell.schedules.slice(0, 3).map((sch) => {
                    const summary = getSchedulePresenceSummary(sch);
                    const hasConflict = detectScheduleConflicts(sch, members).length > 0;

                    return (
                      <button
                        key={sch.id}
                        type="button"
                        onClick={() => {
                          setSelectedDateIso(cell.dateIso);
                          onSelectSchedule(sch);
                        }}
                        className={`w-full text-left px-2 py-1 rounded-lg border text-[11px] transition active:scale-[0.98] flex items-start justify-between gap-1 ${
                          hasConflict
                            ? isDark
                              ? 'bg-red-950/60 border-red-800/80 text-red-200 hover:border-red-600'
                              : 'bg-red-50 border-red-200 text-red-900 hover:border-red-300'
                            : isDark
                            ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-100 hover:border-[#2F9B45]'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-950 hover:border-[#2F9B45]'
                        }`}
                      >
                        <span className="font-semibold line-clamp-2 leading-tight">{sch.serviceLabel}</span>
                        <span className="shrink-0 text-[10px] font-bold tabular-nums opacity-85 flex items-center gap-0.5 mt-0.5">
                          {hasConflict && <AlertTriangle className="w-2.5 h-2.5 text-red-500" />}
                          {summary.totalPresent}/{summary.totalAssigned}
                        </span>
                      </button>
                    );
                  })}

                  {cell.schedules.length > 3 && (
                    <button
                      type="button"
                      onClick={() => handleDayClick(cell.dateIso, cell.isCurrentMonth)}
                      className="text-[10px] font-bold text-[#1B7A32] dark:text-[#42bb5b] text-left px-1 hover:underline"
                    >
                      +{cell.schedules.length - 3} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend Strip */}
        <div
          className={`px-3.5 sm:px-4 py-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] ${
            isDark
              ? 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
              : 'border-slate-100 bg-slate-50/70 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2F9B45]" />
              <span>Com culto</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full ring-2 ring-[#F7B13D]" />
              <span>Hoje</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400">
            Toque em um dia para ver abaixo
          </span>
        </div>
      </section>

      {/* Selected Day Agenda Panel */}
      <section
        aria-label="Cultos do dia selecionado"
        className={`p-4 sm:p-5 rounded-3xl border transition-colors ${
          isDark
            ? 'bg-zinc-900 border-zinc-800'
            : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2F9B45] dark:text-[#42bb5b]">
              Agenda da Data Selecionada
            </p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {formatFullDatePtBr(selectedDateIso)}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => onCreateScheduleForDate(selectedDateIso)}
            className="min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs shadow-sm active:scale-95 transition shrink-0"
          >
            <Plus className="w-4 h-4 text-[#F7B13D]" />
            <span>Escalar nesta data</span>
          </button>
        </div>

        {selectedDaySchedules.length === 0 ? (
          <div className="py-5 text-center space-y-2">
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">
              Nenhum culto escalado para {formatShortDatePtBr(selectedDateIso)}.
            </p>
            {monthSchedulesList.length > 0 && (
              <div className="pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
                  Ir para um culto em {monthTitle}:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {monthSchedulesList.map((sch) => (
                    <button
                      key={sch.id}
                      type="button"
                      onClick={() => setSelectedDateIso(sch.dateIso)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 ${
                        isDark
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:border-[#2F9B45]'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#2F9B45]'
                      }`}
                    >
                      <span className="text-[#2F9B45] dark:text-[#42bb5b] font-bold mr-1.5 tabular-nums">
                        {formatShortDatePtBr(sch.dateIso).slice(0, 5)}
                      </span>
                      <span>{sch.serviceLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
            {selectedDaySchedules.map((sch) => {
              const summary = getSchedulePresenceSummary(sch);
              const conflicts = detectScheduleConflicts(sch, members);

              return (
                <div
                  key={sch.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                    isDark
                      ? 'bg-zinc-950/50 border-zinc-800'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectSchedule(sch)}
                        className="text-left group focus-visible:outline-none"
                      >
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-[#2F9B45] transition-colors">
                          {sch.serviceLabel}
                        </h4>
                      </button>

                      <span className="text-[11px] font-bold tabular-nums text-[#1B7A32] dark:text-[#42bb5b] flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2F9B45]" />
                        {summary.totalAssigned === 0
                          ? 'Falta escalar'
                          : `${summary.totalPresent}/${summary.totalAssigned} confirmados`}
                      </span>
                    </div>

                    {conflicts.length > 0 && (
                      <p className="mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{conflicts.length} conflito(s) de voluntário duplicado</span>
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {Object.entries(sch.assignments).filter(
                        ([minId, list]) => list.length > 0 && ministries.some((m) => m.id === minId)
                      ).length > 0 ? (
                        Object.entries(sch.assignments)
                          .filter(([minId, list]) => list.length > 0 && ministries.some((m) => m.id === minId))
                          .map(([minId], idx) => {
                            const min = ministries.find((m) => m.id === minId);
                            if (!min) return null;
                            return (
                              <span
                                key={min.id}
                                className="text-[11px] text-slate-600 dark:text-zinc-300 flex items-center gap-1"
                              >
                                {idx > 0 && <span className="text-slate-400 mr-0.5">·</span>}
                                <span
                                  className="w-2 h-2 rounded-full inline-block"
                                  style={{ backgroundColor: min.color || '#2F9B45' }}
                                />
                                <span>{min.name}</span>
                              </span>
                            );
                          })
                      ) : (
                        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          Escala pendente neste culto
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => onQuickWhatsApp(e, sch)}
                        className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#2F9B45]/10 text-[#1B7A32] dark:text-[#42bb5b] hover:bg-[#2F9B45] hover:text-white transition border border-[#2F9B45]/25 active:scale-95"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => onQuickPdf(e, sch)}
                        className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F7B13D]/15 text-[#8f5200] dark:text-[#F7B13D] hover:bg-[#F7B13D] hover:text-slate-900 transition border border-[#F7B13D]/40 active:scale-95"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectSchedule(sch)}
                      className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold text-[#2F9B45] dark:text-[#42bb5b] hover:bg-emerald-50 dark:hover:bg-zinc-800 flex items-center gap-1 active:scale-95 transition"
                    >
                      <span>Abrir</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
