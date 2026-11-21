import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  canManageMinistry,
  findMatchingSchedule,
  getScopedMembers,
  getScopedMinistries,
  mergeScheduleAssignmentsForUser
} from '../../utils/authRules';
import { Schedule, Assignment } from '../../types';
import { X, Sparkles, Check, ShieldCheck, AlertCircle, Plus } from 'lucide-react';

interface Props {
  onClose: () => void;
  existingSchedule?: Schedule | null;
  initialDateIso?: string | null;
}

export const NewScheduleModal: React.FC<Props> = ({ onClose, existingSchedule, initialDateIso }) => {
  const {
    services,
    ministries,
    members,
    schedules,
    addSchedule,
    updateSchedule,
    addMinistryRole,
    isDark,
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

  const [dateIso, setDateIso] = useState<string>(() => {
    if (existingSchedule) return existingSchedule.dateIso;
    if (initialDateIso) return initialDateIso;
    // Default to upcoming Sunday (local date)
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [serviceId, setServiceId] = useState<string>(() => {
    if (existingSchedule) return existingSchedule.serviceId;
    return services[0]?.id || '';
  });

  const [activeMinistryFilter, setActiveMinistryFilter] = useState<string>(() => {
    if (user?.role === 'leader' && user.ministryId) {
      return user.ministryId;
    }
    return 'all';
  });

  // Only keep scoped ministries in editable local state
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>(() => {
    const initial: Record<string, Assignment[]> = {};
    scopedMinistries.forEach((m) => {
      initial[m.id] = existingSchedule?.assignments[m.id]
        ? existingSchedule.assignments[m.id].map((item) => ({ ...item }))
        : [];
    });
    return initial;
  });

  const [note, setNote] = useState<string>(() => {
    return existingSchedule?.note || '';
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [quickRoleMinistryId, setQuickRoleMinistryId] = useState<string | null>(null);
  const [quickRoleName, setQuickRoleName] = useState('');

  const selectedService = services.find((s) => s.id === serviceId);

  // Auto assign volunteers intelligently strictly within the user's scoped ministries & members
  const handleAutoAssign = () => {
    const updated: Record<string, Assignment[]> = { ...assignments };
    const usedMemberIds = new Set<string>();

    scopedMinistries.forEach((min) => {
      if (!canManageMinistry(user, min.id)) return;
      updated[min.id] = [];
      min.locais.forEach((local) => {
        const candidate = scopedMembers.find(
          (m) =>
            m.ministryId === min.id &&
            m.locais.includes(local) &&
            !usedMemberIds.has(m.id)
        );

        if (candidate) {
          usedMemberIds.add(candidate.id);
          updated[min.id].push({
            id: `as-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            memberId: candidate.id,
            local,
            present: false
          });
        } else {
          const anyCandidate = scopedMembers.find(
            (m) => m.ministryId === min.id && !usedMemberIds.has(m.id)
          );
          if (anyCandidate) {
            usedMemberIds.add(anyCandidate.id);
            updated[min.id].push({
              id: `as-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              memberId: anyCandidate.id,
              local,
              present: false
            });
          }
        }
      });
    });

    setAssignments(updated);
    showSnackbar('Auto-escala inteligente concluída! Postos preenchidos com voluntários aptos.');
  };

  const handleAssignLocal = (minId: string, local: string, memberId: string) => {
    if (!canManageMinistry(user, minId)) return;
    setAssignments((prev) => {
      const currentList = [...(prev[minId] || [])];
      const idx = currentList.findIndex((item) => item.local === local);

      if (!memberId) {
        return {
          ...prev,
          [minId]: currentList.filter((item) => item.local !== local)
        };
      }

      if (idx >= 0) {
        currentList[idx] = { ...currentList[idx], memberId };
      } else {
        currentList.push({
          id: `as-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          memberId,
          local,
          present: false
        });
      }

      return {
        ...prev,
        [minId]: currentList
      };
    });
  };

  const handleSave = () => {
    setFormError(null);
    if (!serviceId) {
      setFormError('Selecione um culto para continuar.');
      return;
    }
    if (!dateIso) {
      setFormError('Selecione uma data para o culto.');
      return;
    }

    const serviceLabel = selectedService ? selectedService.label : 'Culto Especial';

    // If a leader creates a schedule on the same date+service of an existing schedule, merge cleanly
    const targetSchedule =
      existingSchedule ||
      (user?.role === 'leader' ? findMatchingSchedule(schedules, dateIso, serviceId) : undefined);

    if (targetSchedule) {
      const mergedAssignments = mergeScheduleAssignmentsForUser(
        targetSchedule.assignments,
        assignments,
        user
      );
      updateSchedule({
        ...targetSchedule,
        dateIso,
        serviceId,
        serviceLabel,
        assignments: mergedAssignments,
        note: note.trim() ? note : targetSchedule.note
      });
      showSnackbar('Escala de culto atualizada com sucesso!');
    } else {
      const cleanAssignments = mergeScheduleAssignmentsForUser({}, assignments, user);
      addSchedule({
        dateIso,
        serviceId,
        serviceLabel,
        assignments: cleanAssignments,
        note
      });
      showSnackbar('Nova escala de culto criada com sucesso!');
    }

    onClose();
  };

  const visibleMinistries =
    activeMinistryFilter === 'all' || scopedMinistries.length <= 1
      ? scopedMinistries
      : scopedMinistries.filter((m) => m.id === activeMinistryFilter);

  // Total assigned count across scoped ministries only
  let totalAssigned = 0;
  scopedMinistries.forEach((min) => {
    (assignments[min.id] || []).forEach((i) => {
      if (i.memberId) totalAssigned += 1;
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={existingSchedule ? 'Editar Escala de Culto' : 'Nova Escala de Culto'}
        className={`w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-200 border-t sm:border ${
          isDark
            ? 'bg-zinc-900 text-zinc-100 border-zinc-800'
            : 'bg-white text-slate-800 border-emerald-100'
        }`}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center w-full bg-inherit">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
        </div>

        {/* Top Header with AD Brasil logo */}
        <div
          className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between ${
            isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-emerald-100 bg-emerald-50/50'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-white p-0.5 border border-emerald-200 shadow-xs flex items-center justify-center shrink-0">
              <img src="/assets/aistudio/image_533f3802.png" alt="AD Brasil" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#1B7A32] dark:text-[#42bb5b] truncate">
                {existingSchedule ? 'Editar Escala de Culto' : 'Nova Escala de Culto'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                {user?.role === 'leader' && scopedMinistries[0]
                  ? `${scopedMinistries[0].name} · ${totalAssigned} voluntário(s) escalado(s)`
                  : `${totalAssigned} voluntário(s) escalado(s) até agora`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 touch-manipulation">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Date & Service row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                1. Data do Culto
              </label>
              <input
                type="date"
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                className={`w-full min-h-[48px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#2F9B45]'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                2. Culto / Ocasião
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className={`w-full min-h-[48px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#2F9B45]'
                }`}
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.dayOfWeek || 'Domingo'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Auto-Assign Banner with AD Brasil Green/Gold */}
          <div
            className={`p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
              isDark
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-[#F7B13D] shrink-0" />
              <div>
                <p className="font-bold text-xs text-[#1B7A32] dark:text-[#42bb5b]">
                  Preenchimento Rápido em 1 Toque
                </p>
                <p className="text-[11px] opacity-85">
                  {user?.role === 'leader' && scopedMinistries[0]
                    ? `Preenche os postos de ${scopedMinistries[0].name} automaticamente.`
                    : 'Preenche os postos com voluntários aptos e sem conflito.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAutoAssign}
              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#2F9B45] text-white hover:bg-[#258239] font-bold text-xs shadow-sm active:scale-95 transition whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F7B13D]" />
              <span>Preencher Automaticamente</span>
            </button>
          </div>

          {/* Department Filter Tabs (only shown to general admin managing multiple departments) */}
          {scopedMinistries.length > 1 ? (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Filtrar por Departamento:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveMinistryFilter('all')}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl font-bold transition shrink-0 active:scale-95 ${
                    activeMinistryFilter === 'all'
                      ? 'bg-[#2F9B45] text-white shadow-xs'
                      : isDark
                      ? 'bg-zinc-800 text-zinc-300'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Todos ({scopedMinistries.length})
                </button>
                {scopedMinistries.map((min) => {
                  const assignedInMin = (assignments[min.id] || []).filter((i) => i.memberId).length;
                  return (
                    <button
                      key={min.id}
                      type="button"
                      onClick={() => setActiveMinistryFilter(min.id)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 active:scale-95 ${
                        activeMinistryFilter === min.id
                          ? 'bg-[#2F9B45] text-white shadow-xs'
                          : isDark
                          ? 'bg-zinc-800 text-zinc-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: min.color || '#2F9B45' }}
                      />
                      <span>{min.name}</span>
                      <span className="text-[10px] opacity-75">
                        ({assignedInMin}/{min.locais.length})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : scopedMinistries[0] ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1B7A32] dark:text-[#42bb5b]">
              <ShieldCheck className="w-4 h-4 text-[#2F9B45]" />
              <span>3. Escolha os voluntários de {scopedMinistries[0].name}</span>
            </div>
          ) : null}

          {/* Scoped Ministries & Assignments List */}
          <div className="space-y-4">
            {visibleMinistries.map((min) => {
              const currentList = assignments[min.id] || [];
              const deptMembers = scopedMembers.filter((m) => m.ministryId === min.id);
              const candidatePool = deptMembers.length > 0 ? deptMembers : scopedMembers;

              return (
                <div
                  key={min.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-colors ${
                    isDark ? 'bg-zinc-800/60 border-zinc-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <span className="font-bold text-xs uppercase tracking-wider text-[#1B7A32] dark:text-[#42bb5b] flex items-center gap-2 min-w-0 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shadow-xs shrink-0"
                        style={{ backgroundColor: min.color || '#2F9B45' }}
                      />
                      <span className="truncate">{min.name}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium tabular-nums">
                        {min.locais.length} postos
                      </span>
                      {canManageMinistry(user, min.id) && quickRoleMinistryId !== min.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickRoleMinistryId(min.id);
                            setQuickRoleName('');
                          }}
                          className="min-h-[34px] px-2.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-[#1B7A32] dark:text-[#42bb5b] hover:bg-emerald-100 dark:hover:bg-emerald-950 flex items-center gap-1 transition active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nova função</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {quickRoleMinistryId === min.id && canManageMinistry(user, min.id) && (
                    <div className="mb-3 flex items-center gap-1.5 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-zinc-900">
                      <input
                        type="text"
                        value={quickRoleName}
                        onChange={(e) => setQuickRoleName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const res = addMinistryRole(min.id, quickRoleName);
                            if (res.ok) {
                              setQuickRoleName('');
                              setQuickRoleMinistryId(null);
                            }
                          } else if (e.key === 'Escape') {
                            setQuickRoleMinistryId(null);
                          }
                        }}
                        placeholder={`Novo posto em ${min.name}...`}
                        aria-label={`Novo posto em ${min.name}`}
                        autoFocus
                        className={`flex-1 min-w-0 min-h-[42px] px-3 py-1.5 text-sm sm:text-xs rounded-lg border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                          isDark
                            ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const res = addMinistryRole(min.id, quickRoleName);
                          if (res.ok) {
                            setQuickRoleName('');
                            setQuickRoleMinistryId(null);
                          }
                        }}
                        className="min-h-[42px] px-3 rounded-lg bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs flex items-center gap-1 transition shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Criar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickRoleMinistryId(null);
                          setQuickRoleName('');
                        }}
                        aria-label="Cancelar nova função"
                        className="min-h-[42px] min-w-[42px] rounded-lg text-slate-500 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {min.locais.map((local) => {
                      const assignedItem = currentList.find((i) => i.local === local);
                      const currentMemberId = assignedItem ? assignedItem.memberId : '';

                      const qualifiedMembers = candidatePool.filter((m) => m.locais.includes(local));
                      const otherDeptMembers = candidatePool.filter((m) => !m.locais.includes(local));

                      return (
                        <div
                          key={local}
                          className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition ${
                            currentMemberId
                              ? isDark
                                ? 'bg-zinc-900 border-zinc-700 text-white'
                                : 'bg-white border-emerald-200 text-slate-800'
                              : isDark
                              ? 'bg-zinc-900/50 border-zinc-800 text-zinc-400'
                              : 'bg-white/70 border-slate-200 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs truncate text-[#1B7A32] dark:text-[#42bb5b]">
                              {local}
                            </span>
                            {currentMemberId && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 shrink-0">
                                <Check className="w-3 h-3" />
                                Escalado
                              </span>
                            )}
                          </div>

                          <select
                            aria-label={`Voluntário para ${local}`}
                            value={currentMemberId}
                            onChange={(e) => handleAssignLocal(min.id, local, e.target.value)}
                            className={`w-full min-h-[46px] text-sm sm:text-xs px-3 py-2 rounded-xl border outline-none font-medium ${
                              isDark
                                ? 'bg-zinc-800 border-zinc-700 text-white'
                                : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#2F9B45]'
                            }`}
                          >
                            <option value="">Escolher voluntário...</option>
                            {qualifiedMembers.length > 0 && (
                              <optgroup label="Voluntários Habilitados p/ o Posto">
                                {qualifiedMembers.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    ⭐ {m.name} ({m.cargo})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {otherDeptMembers.length > 0 && (
                              <optgroup
                                label={
                                  user?.role === 'leader'
                                    ? `Outros Voluntários de ${min.name}`
                                    : 'Outros Voluntários'
                                }
                              >
                                {otherDeptMembers.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.cargo})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
              Instruções Pastorais / Notas (Opcional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Chegar com 30 minutos de antecedência..."
              className={`w-full text-sm sm:text-xs p-3 rounded-xl border outline-none resize-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            />
          </div>
        </div>

        {/* Sticky Mobile Thumb Zone Footer */}
        <div
          className={`px-4 sm:px-5 py-3 border-t flex items-center justify-end gap-2.5 pb-safe ${
            isDark ? 'border-zinc-800 bg-zinc-950/90' : 'border-slate-200 bg-white shadow-lg'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none min-h-[46px] px-4 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 sm:flex-none min-h-[46px] px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#2F9B45] text-white hover:bg-[#258239] transition shadow-md active:scale-95 whitespace-nowrap"
          >
            Salvar Escala ({totalAssigned})
          </button>
        </div>
      </div>
    </div>
  );
};
