import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  canDeleteFullSchedule,
  canManageMinistry,
  getScopedMembers,
  getScopedMinistries,
  mergeScheduleAssignmentsForUser,
  scopeScheduleForUser
} from '../../utils/authRules';
import { Schedule } from '../../types';
import { formatWhatsAppMessage, getWhatsAppShareUrl } from '../../utils/rules';
import { generateSchedulePdf } from '../../utils/pdfExport';
import {
  X,
  Share2,
  FileDown,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Edit,
  Trash2,
  Calendar,
  Clock,
  MessageSquare,
  Users
} from 'lucide-react';

interface Props {
  schedule: Schedule;
  onClose: () => void;
  onEdit: () => void;
}

export const ScheduleDetailModal: React.FC<Props> = ({ schedule, onClose, onEdit }) => {
  const {
    schedules,
    ministries,
    members,
    churchName,
    toggleAssignmentPresence,
    updateSchedule,
    deleteSchedule,
    isDark,
    showSnackbar
  } = useApp();

  const { user } = useAuth();
  const [activeView, setActiveView] = useState<'attendance' | 'whatsapp'>('attendance');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const scopedMinistries = useMemo(
    () => getScopedMinistries(ministries, user),
    [ministries, user]
  );
  const scopedMembers = useMemo(
    () => getScopedMembers(members, user),
    [members, user]
  );

  // Full unscoped schedule only used for safe delete/clear check
  const fullSchedule = useMemo(
    () => schedules.find((s) => s.id === schedule.id) || schedule,
    [schedules, schedule]
  );
  const scopedSchedule = useMemo(
    () => scopeScheduleForUser(fullSchedule, user),
    [fullSchedule, user]
  );

  const allowFullDelete = canDeleteFullSchedule(fullSchedule, user);

  const formattedWhatsApp = formatWhatsAppMessage(
    scopedSchedule,
    scopedMinistries,
    scopedMembers,
    churchName
  );

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(formattedWhatsApp);
    showSnackbar('Texto copiado com sucesso! Abra o WhatsApp e cole no grupo.');
  };

  const handleOpenWhatsApp = () => {
    const url = getWhatsAppShareUrl(formattedWhatsApp);
    window.open(url, '_blank');
  };

  const handleDownloadPdf = () => {
    try {
      setIsGeneratingPdf(true);
      generateSchedulePdf(scopedSchedule, scopedMinistries, scopedMembers, churchName);
      showSnackbar('Escala em PDF gerada e baixada com o logotipo da AD Brasil!');
    } catch (e) {
      console.error(e);
      showSnackbar('Erro ao gerar PDF da escala.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleConfirmDeleteOrClear = () => {
    if (allowFullDelete) {
      deleteSchedule(scopedSchedule.id);
      onClose();
      return;
    }

    if (user?.role === 'leader' && user.ministryId) {
      const clearedAssignments = mergeScheduleAssignmentsForUser(
        fullSchedule.assignments,
        { [user.ministryId]: [] },
        user
      );
      updateSchedule({
        ...fullSchedule,
        assignments: clearedAssignments
      });
      showSnackbar('Escala do seu departamento limpa neste culto.');
      setConfirmingDelete(false);
      onClose();
    }
  };

  const parts = scopedSchedule.dateIso.split('-');
  const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : scopedSchedule.dateIso;

  // Total volunteers count & present count strictly within scoped ministries
  let totalAssigned = 0;
  let totalPresent = 0;
  scopedMinistries.forEach((min) => {
    const list = scopedSchedule.assignments[min.id] || [];
    list.forEach((item) => {
      if (item.memberId) {
        totalAssigned += 1;
        if (item.present) totalPresent += 1;
      }
    });
  });

  const percent = totalAssigned > 0 ? Math.round((totalPresent / totalAssigned) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da escala ${scopedSchedule.serviceLabel}`}
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

        {/* Modal Header */}
        <div
          className={`px-4 sm:px-5 py-3 border-b ${
            isDark ? 'border-zinc-800 bg-zinc-950/70' : 'border-emerald-100 bg-emerald-50/50'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-white p-1 border border-emerald-200 shadow-xs shrink-0 flex items-center justify-center">
                <img src="/assets/aistudio/image_533f3802.png" alt="AD Brasil" className="h-full w-full object-contain" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#2F9B45] dark:text-[#42bb5b] truncate">
                  <Calendar className="w-3.5 h-3.5 text-[#F7B13D] shrink-0" />
                  <span className="tabular-nums">{formattedDate}</span>
                  <span aria-hidden="true">·</span>
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{scopedSchedule.serviceLabel}</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {user?.role === 'leader' && scopedMinistries[0]
                    ? `Escala · ${scopedMinistries[0].name}`
                    : 'Escala de Voluntários'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onEdit}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 active:scale-95 transition"
                title="Editar Escala"
                aria-label="Editar Escala"
              >
                <Edit className="w-4 h-4" />
              </button>
              {(allowFullDelete || totalAssigned > 0) && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete((prev) => !prev)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-red-500/10 text-red-600 dark:text-red-400 active:scale-95 transition"
                  title={allowFullDelete ? 'Excluir Escala' : 'Limpar Escala do Departamento'}
                  aria-label={allowFullDelete ? 'Excluir Escala' : 'Limpar Escala do Departamento'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Slim Attendance Progress Indicator */}
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#1B7A32] dark:text-[#42bb5b] flex items-center gap-1.5 tabular-nums">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2F9B45]" />
                {totalAssigned === 0
                  ? 'Nenhum voluntário escalado ainda'
                  : `${totalPresent} de ${totalAssigned} presentes (${percent}%)`}
              </span>
              {totalAssigned > 0 && (
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 sm:hidden">
                  Toque no nome para marcar
                </span>
              )}
            </div>
            {totalAssigned > 0 && (
              <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-[#2F9B45] rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Inline Delete / Clear Confirmation Bar */}
        {confirmingDelete && (
          <div className="px-4 sm:px-5 py-2.5 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-red-800 dark:text-red-200">
              {allowFullDelete
                ? 'Confirmar exclusão completa desta escala de culto?'
                : 'Limpar apenas os voluntários do seu departamento neste culto?'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="min-h-[40px] px-3 py-1.5 rounded-xl font-semibold bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrClear}
                className="min-h-[40px] px-3 py-1.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700"
              >
                {allowFullDelete ? 'Excluir Agora' : 'Limpar Departamento'}
              </button>
            </div>
          </div>
        )}

        {/* Mobile Sub-Navigation Tabs */}
        <div
          className={`px-4 sm:px-5 py-2 border-b flex items-center justify-between gap-2 text-xs ${
            isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto items-center gap-1 bg-slate-200/80 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveView('attendance')}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg font-bold text-xs transition active:scale-95 whitespace-nowrap ${
                activeView === 'attendance'
                  ? 'bg-white dark:bg-zinc-900 text-[#1B7A32] dark:text-[#42bb5b] shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400'
              }`}
            >
              Chamada de Presença
            </button>
            <button
              type="button"
              onClick={() => setActiveView('whatsapp')}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeView === 'whatsapp'
                  ? 'bg-white dark:bg-zinc-900 text-[#1B7A32] dark:text-[#42bb5b] shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400'
              }`}
            >
              <Share2 className="w-3.5 h-3.5 text-[#F7B13D]" />
              <span>Texto WhatsApp</span>
            </button>
          </div>

          <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-zinc-400">
            Toque no voluntário para confirmar
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 touch-manipulation">
          {activeView === 'whatsapp' ? (
            /* WhatsApp View */
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-[#2F9B45]/10 border border-[#2F9B45]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-5 h-5 text-[#F7B13D] shrink-0" />
                  <div>
                    <h4 className="font-bold text-xs text-[#1B7A32] dark:text-[#42bb5b]">
                      Mensagem pronta para os grupos
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-300">
                      Copie com 1 toque ou envie diretamente pelo WhatsApp
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyWhatsApp}
                    className="flex-1 sm:flex-none min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs border border-slate-200 dark:border-zinc-700 active:scale-95 transition shadow-xs"
                  >
                    <Copy className="w-4 h-4 text-[#2F9B45]" />
                    <span>Copiar Texto</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="flex-1 sm:flex-none min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 active:scale-95 transition shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4 text-[#F7B13D]" />
                    <span>Abrir WhatsApp</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800 overflow-x-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 dark:text-zinc-200 select-all">
                {formattedWhatsApp}
              </pre>
            </div>
          ) : (
            /* Attendance View strictly scoped to scopedMinistries */
            <div className="space-y-4">
              {totalAssigned === 0 ? (
                <div
                  className={`p-6 rounded-2xl border text-center space-y-3 ${
                    isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Users className="w-8 h-8 mx-auto text-[#2F9B45] opacity-70" />
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {user?.role === 'leader' && scopedMinistries[0]
                        ? `Nenhum voluntário de ${scopedMinistries[0].name} escalado neste culto`
                        : 'Nenhum voluntário escalado neste culto ainda'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                      Toque no botão abaixo para escolher os voluntários deste culto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#2F9B45] text-white font-bold text-xs hover:bg-[#258239] transition active:scale-95"
                  >
                    Montar Escala Agora
                  </button>
                </div>
              ) : (
                scopedMinistries.map((min) => {
                  const list = scopedSchedule.assignments[min.id] || [];
                  if (list.length === 0) return null;

                  const minPresent = list.filter((i) => i.memberId && i.present).length;
                  const minTotal = list.filter((i) => i.memberId).length;
                  const canEditMin = canManageMinistry(user, min.id);

                  return (
                    <div
                      key={min.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-colors ${
                        isDark ? 'bg-zinc-800/60 border-zinc-700/80' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5 gap-2">
                        <span className="font-bold text-xs uppercase tracking-wider text-[#1B7A32] dark:text-[#42bb5b] flex items-center gap-1.5 min-w-0 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block shadow-xs shrink-0"
                            style={{ backgroundColor: min.color || '#2F9B45' }}
                          />
                          <span className="truncate">{min.name}</span>
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 shrink-0 tabular-nums">
                          {minPresent}/{minTotal} presentes
                        </span>
                      </div>

                      <div className="space-y-2">
                        {list.map((assignment) => {
                          const member = scopedMembers.find((m) => m.id === assignment.memberId);
                          const isPresent = assignment.present;

                          return (
                            <button
                              key={assignment.id}
                              type="button"
                              disabled={!canEditMin}
                              onClick={() => {
                                if (!canEditMin) return;
                                toggleAssignmentPresence(scopedSchedule.id, min.id, assignment.id);
                              }}
                              aria-pressed={isPresent}
                              className={`w-full text-left min-h-[56px] p-3 rounded-xl border flex items-center justify-between gap-3 select-none transition-all ${
                                canEditMin ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default opacity-85'
                              } ${
                                isPresent
                                  ? isDark
                                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                                    : 'bg-emerald-50 border-emerald-300 text-slate-900 shadow-xs'
                                  : isDark
                                  ? 'bg-zinc-900 border-zinc-700/60 text-zinc-300'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-[#2F9B45]/40'
                              }`}
                            >
                              <div className="min-w-0 flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                    isPresent
                                      ? 'bg-[#2F9B45] text-white shadow-xs'
                                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700'
                                  }`}
                                >
                                  {isPresent ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    <Circle className="w-4 h-4" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                    {member ? member.name : 'Posto Vago'}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                    <span className="font-semibold text-[#1B7A32] dark:text-[#42bb5b] mr-1">
                                      {assignment.local}
                                    </span>
                                    {member?.cargo ? `· ${member.cargo}` : ''}
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                                  isPresent
                                    ? 'bg-emerald-200/70 dark:bg-emerald-900 text-[#1B7A32] dark:text-emerald-200'
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'
                                }`}
                              >
                                {isPresent ? 'Presente' : 'Confirmar'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Notes Card */}
              {scopedSchedule.note && (
                <div
                  className={`p-3.5 rounded-2xl border ${
                    isDark ? 'bg-amber-950/30 border-amber-800/80 text-amber-200' : 'bg-amber-50/70 border-amber-300 text-amber-950'
                  }`}
                >
                  <h4 className="font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-1 text-amber-800 dark:text-amber-400">
                    Instruções da Liderança
                  </h4>
                  <p className="text-xs whitespace-pre-wrap">{scopedSchedule.note}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Compact Single-Row Sticky Thumb Footer */}
        <div
          className={`px-4 sm:px-5 py-3 border-t flex items-center justify-between gap-2 pb-safe ${
            isDark ? 'border-zinc-800 bg-zinc-950/90' : 'border-slate-200 bg-white shadow-lg'
          }`}
        >
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex-1 sm:flex-none min-h-[46px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#2F9B45] text-white hover:bg-[#258239] font-bold text-xs transition shadow-sm active:scale-95 whitespace-nowrap"
          >
            <FileDown className="w-4 h-4 text-[#F7B13D]" />
            <span>{isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="min-h-[46px] flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-zinc-800 text-[#1B7A32] dark:text-[#42bb5b] font-bold text-xs border border-emerald-200 dark:border-zinc-700 active:scale-95 transition whitespace-nowrap sm:hidden"
          >
            <Edit className="w-4 h-4" />
            <span>Editar</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] px-4 sm:px-5 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 active:scale-95 transition whitespace-nowrap"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
