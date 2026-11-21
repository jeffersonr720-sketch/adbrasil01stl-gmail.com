import { Schedule } from '../types';

export interface CalendarDayCell {
  dateIso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  schedules: Schedule[];
}

export interface MonthStats {
  totalSchedules: number;
  totalAssigned: number;
  totalPresent: number;
}

const MONTH_NAMES_PT_BR = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

const WEEKDAY_NAMES_PT_BR = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

export const WEEKDAY_SHORT_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateIso(year: number, monthIndex: number, day: number): string {
  return `${year}-${padTwoDigits(monthIndex + 1)}-${padTwoDigits(day)}`;
}

export function getLocalTodayIso(referenceDate: Date = new Date()): string {
  return formatDateIso(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
}

export function parseDateIsoParts(dateIso: string): { year: number; monthIndex: number; day: number } | null {
  const parts = dateIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }
  return {
    year: parts[0],
    monthIndex: parts[1] - 1,
    day: parts[2]
  };
}

export function navigateMonth(
  year: number,
  monthIndex: number,
  delta: number
): { year: number; monthIndex: number } {
  const date = new Date(year, monthIndex + delta, 1);
  return {
    year: date.getFullYear(),
    monthIndex: date.getMonth()
  };
}

export function getMonthTitlePtBr(year: number, monthIndex: number): string {
  const normalized = navigateMonth(year, monthIndex, 0);
  const monthName = MONTH_NAMES_PT_BR[normalized.monthIndex] || '';
  return `${monthName} ${normalized.year}`;
}

export function formatFullDatePtBr(dateIso: string): string {
  const parsed = parseDateIsoParts(dateIso);
  if (!parsed) return dateIso;
  const date = new Date(parsed.year, parsed.monthIndex, parsed.day);
  const weekday = WEEKDAY_NAMES_PT_BR[date.getDay()] || '';
  const month = MONTH_NAMES_PT_BR[parsed.monthIndex] || '';
  return `${weekday}, ${parsed.day} de ${month}`;
}

export function formatShortDatePtBr(dateIso: string): string {
  const parsed = parseDateIsoParts(dateIso);
  if (!parsed) return dateIso;
  return `${padTwoDigits(parsed.day)}/${padTwoDigits(parsed.monthIndex + 1)}/${parsed.year}`;
}

export function getSchedulePresenceSummary(schedule: Schedule): {
  totalAssigned: number;
  totalPresent: number;
  percent: number;
} {
  let totalAssigned = 0;
  let totalPresent = 0;

  Object.values(schedule.assignments).forEach((list) => {
    list.forEach((item) => {
      if (item.memberId) {
        totalAssigned += 1;
        if (item.present) {
          totalPresent += 1;
        }
      }
    });
  });

  const percent = totalAssigned > 0 ? Math.round((totalPresent / totalAssigned) * 100) : 0;
  return { totalAssigned, totalPresent, percent };
}

export function getMonthScheduleStats(
  year: number,
  monthIndex: number,
  schedules: Schedule[]
): MonthStats {
  const monthPrefix = `${year}-${padTwoDigits(monthIndex + 1)}-`;
  let totalSchedules = 0;
  let totalAssigned = 0;
  let totalPresent = 0;

  schedules.forEach((sch) => {
    if (sch.dateIso.startsWith(monthPrefix)) {
      totalSchedules += 1;
      const summary = getSchedulePresenceSummary(sch);
      totalAssigned += summary.totalAssigned;
      totalPresent += summary.totalPresent;
    }
  });

  return { totalSchedules, totalAssigned, totalPresent };
}

/**
 * Gera a matriz semanal completa (Domingo a Sábado) para o mês especificado.
 */
export function buildMonthCalendarGrid(
  year: number,
  monthIndex: number,
  schedules: Schedule[],
  todayIso: string = getLocalTodayIso()
): CalendarDayCell[] {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const startWeekday = firstDayOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // Map schedules by YYYY-MM-DD for O(1) lookup
  const schedulesByDate: Record<string, Schedule[]> = {};
  schedules.forEach((sch) => {
    if (!schedulesByDate[sch.dateIso]) {
      schedulesByDate[sch.dateIso] = [];
    }
    schedulesByDate[sch.dateIso].push(sch);
  });

  // Sort each day's schedules deterministically
  Object.values(schedulesByDate).forEach((dayList) => {
    dayList.sort((a, b) => a.serviceLabel.localeCompare(b.serviceLabel));
  });

  const totalSlotsNeeded = startWeekday + daysInMonth;
  const totalWeeks = Math.ceil(totalSlotsNeeded / 7);
  const totalCells = totalWeeks * 7;

  const cells: CalendarDayCell[] = [];

  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startWeekday + 1;
    const cellDate = new Date(year, monthIndex, dayOffset);
    const cellYear = cellDate.getFullYear();
    const cellMonth = cellDate.getMonth();
    const cellDay = cellDate.getDate();
    const dateIso = formatDateIso(cellYear, cellMonth, cellDay);

    cells.push({
      dateIso,
      dayNumber: cellDay,
      isCurrentMonth: cellYear === year && cellMonth === monthIndex,
      isToday: dateIso === todayIso,
      schedules: schedulesByDate[dateIso] || []
    });
  }

  return cells;
}
