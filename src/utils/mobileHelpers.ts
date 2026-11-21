import { getLocalTodayIso, parseDateIsoParts } from './calendar';

export interface RelativeServiceDateInfo {
  relativeLabel: string;
  weekdayShort: string;
  dayMonth: string;
  fullFormatted: string;
  isToday: boolean;
  isPast: boolean;
}

const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function formatRelativeServiceDatePtBr(
  dateIso: string,
  todayIso: string = getLocalTodayIso()
): RelativeServiceDateInfo {
  const parsed = parseDateIsoParts(dateIso);
  const todayParsed = parseDateIsoParts(todayIso);

  if (!parsed) {
    return {
      relativeLabel: dateIso,
      weekdayShort: '',
      dayMonth: dateIso,
      fullFormatted: dateIso,
      isToday: false,
      isPast: false
    };
  }

  const targetUtc = Date.UTC(parsed.year, parsed.monthIndex, parsed.day);
  const todayUtc = todayParsed
    ? Date.UTC(todayParsed.year, todayParsed.monthIndex, todayParsed.day)
    : Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const diffDays = Math.round((targetUtc - todayUtc) / 86400000);
  const weekdayIdx = new Date(targetUtc).getUTCDay();
  const weekdayShort = WEEKDAY_SHORT_PT[weekdayIdx] || '';

  const dd = String(parsed.day).padStart(2, '0');
  const mm = String(parsed.monthIndex + 1).padStart(2, '0');
  const dayMonth = `${dd}/${mm}`;
  const fullFormatted = `${dd}/${mm}/${parsed.year}`;

  let relativeLabel = `${weekdayShort} · ${dayMonth}`;
  if (diffDays === 0) {
    relativeLabel = 'Hoje';
  } else if (diffDays === 1) {
    relativeLabel = 'Amanhã';
  } else if (diffDays === -1) {
    relativeLabel = 'Ontem';
  } else if (diffDays > 1 && diffDays <= 14) {
    relativeLabel = `Em ${diffDays} dias`;
  } else if (diffDays < -1 && diffDays >= -7) {
    relativeLabel = `Há ${Math.abs(diffDays)} dias`;
  } else {
    relativeLabel = `${weekdayShort} · ${dayMonth}`;
  }

  return {
    relativeLabel,
    weekdayShort,
    dayMonth,
    fullFormatted,
    isToday: diffDays === 0,
    isPast: diffDays < 0
  };
}

export interface MobileScheduleStatus {
  label: string;
  shortLabel: string;
  tone: 'pending' | 'partial' | 'complete';
  percent: number;
}

export function getMobileScheduleStatus(
  totalAssigned: number,
  totalPresent: number
): MobileScheduleStatus {
  if (totalAssigned <= 0) {
    return {
      label: 'Escala pendente',
      shortLabel: 'Falta escalar',
      tone: 'pending',
      percent: 0
    };
  }

  const percent = Math.round((totalPresent / totalAssigned) * 100);
  if (totalPresent >= totalAssigned) {
    return {
      label: `${totalPresent} de ${totalAssigned} confirmados`,
      shortLabel: `${totalPresent}/${totalAssigned} · Completa`,
      tone: 'complete',
      percent: 100
    };
  }

  return {
    label: `${totalPresent} de ${totalAssigned} confirmados`,
    shortLabel: `${totalPresent}/${totalAssigned} confirmados`,
    tone: 'partial',
    percent
  };
}
