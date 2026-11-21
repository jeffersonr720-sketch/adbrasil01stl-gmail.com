import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  canManageLeaderAccounts,
  getScopedMembers,
  getScopedMinistries,
  scopeSchedulesForUser
} from '../../utils/authRules';
import { calculateMemberStats, exportSchedulesToCsv } from '../../utils/rules';
import { LeadersAdminPanel } from './LeadersAdminPanel';
import {
  CheckCircle2,
  Users,
  Calendar,
  AlertCircle,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';

export const AttendanceScreen: React.FC = () => {
  const {
    members,
    schedules,
    ministries,
    churchName,
    attendanceSubTab,
    setAttendanceSubTab,
    showSnackbar,
    isDark
  } = useApp();

  const { user } = useAuth();
  const isAdmin = canManageLeaderAccounts(user);
  const effectiveSubTab = attendanceSubTab === 'leaders' && isAdmin ? 'leaders' : 'metrics';

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

  // Scoped attendance calculations
  let totalAssignedAll = 0;
  let totalPresentAll = 0;

  scopedSchedules.forEach((sch) => {
    Object.values(sch.assignments).forEach((list) => {
      list.forEach((item) => {
        if (item.memberId) {
          totalAssignedAll += 1;
          if (item.present) totalPresentAll += 1;
        }
      });
    });
  });

  const overallRate = totalAssignedAll > 0 ? Math.round((totalPresentAll / totalAssignedAll) * 100) : 100;

  // Scoped member ranking sorted by attendance rate
  const memberRankings = scopedMembers
    .map((m) => {
      const stats = calculateMemberStats(m.id, scopedSchedules);
      const min = scopedMinistries.find((item) => item.id === m.ministryId);
      return {
        ...m,
        ministryName: min?.name || 'Geral',
        ...stats
      };
    })
    .sort((a, b) => b.attendanceRate - a.attendanceRate);

  // Scoped department attendance stats
  const departmentStats = scopedMinistries.map((min) => {
    let deptAssigned = 0;
    let deptPresent = 0;

    scopedSchedules.forEach((sch) => {
      const list = sch.assignments[min.id] || [];
      list.forEach((item) => {
        if (item.memberId) {
          deptAssigned += 1;
          if (item.present) deptPresent += 1;
        }
      });
    });

    const rate = deptAssigned > 0 ? Math.round((deptPresent / deptAssigned) * 100) : 100;
    const volunteerCount = scopedMembers.filter((m) => m.ministryId === min.id).length;

    return {
      min,
      deptAssigned,
      deptPresent,
      rate,
      volunteerCount
    };
  });

  const handleExportCsv = () => {
    const csv = exportSchedulesToCsv(scopedSchedules, scopedMinistries, scopedMembers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const scopeSuffix =
      user?.role === 'leader' && scopedMinistries[0]
        ? scopedMinistries[0].name.replace(/\s+/g, '_')
        : churchName.replace(/\s+/g, '_');
    link.download = `Escalas_${scopeSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showSnackbar('Planilha CSV gerada e baixada com sucesso! Compatível com Excel e Google Planilhas.');
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-8 touch-manipulation">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {user?.role === 'leader' && scopedMinistries[0]
              ? `Relatórios • ${scopedMinistries[0].name}`
              : 'Relatórios & Assiduidade'}
          </h1>
          <p className={`text-xs sm:text-sm ${isDark ? 'text-zinc-400' : 'text-slate-500'} mt-0.5`}>
            {user?.role === 'leader' && scopedMinistries[0]
              ? `Acompanhe a pontualidade dos voluntários de ${scopedMinistries[0].name} e exporte sua planilha`
              : 'Acompanhe a pontualidade da equipe ministerial da AD Brasil e exporte relatórios'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
          {isAdmin && (
            <div className={`grid grid-cols-2 sm:inline-flex items-center p-1 rounded-2xl text-xs font-semibold w-full sm:w-auto ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}>
              <button
                type="button"
                onClick={() => setAttendanceSubTab('metrics')}
                className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl transition active:scale-95 whitespace-nowrap shrink-0 text-center ${
                  effectiveSubTab === 'metrics'
                    ? 'bg-[#2F9B45] text-white shadow-xs font-bold'
                    : isDark
                    ? 'text-zinc-400'
                    : 'text-slate-600'
                }`}
              >
                Métricas
              </button>
              <button
                type="button"
                onClick={() => setAttendanceSubTab('leaders')}
                className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl transition active:scale-95 whitespace-nowrap shrink-0 text-center ${
                  effectiveSubTab === 'leaders'
                    ? 'bg-[#2F9B45] text-white shadow-xs font-bold'
                    : isDark
                    ? 'text-zinc-400'
                    : 'text-slate-600'
                }`}
              >
                Líderes & Acessos
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs shadow-sm transition active:scale-95 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#F7B13D]" />
            <span>Exportar Planilha</span>
          </button>
        </div>
      </div>

      {effectiveSubTab === 'leaders' && isAdmin ? (
        <LeadersAdminPanel />
      ) : (
        <div className="space-y-5">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div
              className={`p-4 rounded-3xl border ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-[#2F9B45] mb-1">
                <CheckCircle2 className="w-5 h-5 text-[#2F9B45]" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Taxa Geral</span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">{overallRate}%</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 tabular-nums">
                {totalPresentAll} de {totalAssignedAll} presenças
              </p>
            </div>

            <div
              className={`p-4 rounded-3xl border ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-[#F7B13D] mb-1">
                <Users className="w-5 h-5 text-[#F7B13D]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">Voluntários</span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">{scopedMembers.length}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Em {scopedMinistries.length} {scopedMinistries.length === 1 ? 'ministério' : 'ministérios'}
              </p>
            </div>

            <div
              className={`p-4 rounded-3xl border ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-[#2F9B45] mb-1">
                <Calendar className="w-5 h-5 text-[#2F9B45]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">Escalas</span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">{scopedSchedules.length}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Cultos registrados
              </p>
            </div>

            <div
              className={`p-4 rounded-3xl border ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-amber-500 mb-1">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">Pendentes</span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {Math.max(0, totalAssignedAll - totalPresentAll)}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Aguardando chamada
              </p>
            </div>
          </div>

          {/* Department Breakdown */}
          <div
            className={`p-4 sm:p-5 rounded-3xl border transition-colors ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <h3 className={`font-bold text-sm sm:text-base mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {scopedMinistries.length === 1
                ? 'Assiduidade do Departamento'
                : 'Assiduidade por Ministério / Departamento'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {departmentStats.map((item) => (
                <div
                  key={item.min.id}
                  className={`p-3.5 rounded-2xl border transition ${
                    isDark ? 'bg-zinc-800/60 border-zinc-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="font-bold text-xs flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: item.min.color || '#2F9B45' }}
                      />
                      <span className="truncate">{item.min.name}</span>
                    </span>
                    <span className="text-xs font-bold text-[#1B7A32] dark:text-[#42bb5b] tabular-nums shrink-0">
                      {item.rate}%
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden mb-2">
                    <div
                      className="h-full bg-[#2F9B45] rounded-full transition-all"
                      style={{ width: `${item.rate}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
                    <span>{item.volunteerCount} voluntários</span>
                    <span>{item.deptPresent}/{item.deptAssigned} presenças</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ranking Table */}
          <div
            className={`p-4 sm:p-5 rounded-3xl border transition-colors ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <h3 className={`font-bold text-sm sm:text-base flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Sparkles className="w-4 h-4 text-[#F7B13D] shrink-0" />
                <span>Ranking de Pontualidade</span>
              </h3>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Baseado nas presenças confirmadas
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {memberRankings.map((member, index) => (
                <div key={member.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-6 text-center font-bold text-slate-400 dark:text-zinc-500 shrink-0 tabular-nums">
                      #{index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold text-sm sm:text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {member.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        {member.ministryName} · {member.cargo}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right tabular-nums">
                      <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {member.attendanceRate}%
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                        {member.totalPresent}/{member.totalAssigned}
                      </p>
                    </div>

                    <div className="hidden sm:block w-20 h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-[#2F9B45] rounded-full transition-all"
                        style={{ width: `${member.attendanceRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
