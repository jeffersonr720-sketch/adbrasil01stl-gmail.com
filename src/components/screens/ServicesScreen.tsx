import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { canManageServicesAndMinistries } from '../../utils/authRules';
import { Service } from '../../types';
import { Church, Plus, Edit2, Trash2, Clock, Calendar, X } from 'lucide-react';

export const ServicesScreen: React.FC = () => {
  const { services, addService, updateService, deleteService, isDark, showSnackbar } = useApp();
  const { user } = useAuth();
  const canEditStructure = canManageServicesAndMinistries(user);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Domingo');
  const [time, setTime] = useState('19:00');

  const openNew = () => {
    setEditingService(null);
    setLabel('');
    setDayOfWeek('Domingo');
    setTime('19:00');
    setIsModalOpen(true);
  };

  const openEdit = (srv: Service) => {
    setEditingService(srv);
    setLabel(srv.label);
    setDayOfWeek(srv.dayOfWeek || 'Domingo');
    setTime(srv.time || '19:00');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!label.trim()) {
      showSnackbar('Informe o nome/horário do culto.');
      return;
    }

    if (editingService) {
      updateService({
        ...editingService,
        label: label.trim(),
        dayOfWeek,
        time
      });
    } else {
      addService({
        label: label.trim(),
        dayOfWeek,
        time
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-6 sm:pb-8 w-full touch-manipulation">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-baseline gap-2">
            <span>Cultos & Reuniões</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tabular-nums">
              · {services.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Consulte os cultos regulares e especiais da igreja
          </p>
        </div>

        {canEditStructure && (
          <button
            type="button"
            onClick={openNew}
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs shadow-sm transition-all active:scale-95 shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#F7B13D]" />
            <span>Novo Culto</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {services.map((service) => (
          <div
            key={service.id}
            className={`p-4 rounded-3xl border transition-all flex items-center justify-between gap-3 touch-manipulation ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                : 'bg-white border-slate-200 hover:border-[#2F9B45]/40 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-[#2F9B45] dark:text-[#42bb5b] flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/40 shadow-xs">
                <Church className="w-5 h-5 text-[#2F9B45]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  {service.label}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  <span className="flex items-center gap-1 font-semibold text-[#1B7A32] dark:text-[#42bb5b]">
                    <Calendar className="w-3.5 h-3.5 text-[#F7B13D]" />
                    {service.dayOfWeek || 'Domingo'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <Clock className="w-3.5 h-3.5" />
                    {service.time || '19:00'}
                  </span>
                </div>
              </div>
            </div>

            {canEditStructure && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(service)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-[#2F9B45] hover:bg-emerald-50 dark:hover:bg-zinc-800 transition active:scale-95"
                  title="Editar Culto"
                  aria-label={`Editar ${service.label}`}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {confirmDeleteId === service.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteService(service.id);
                      setConfirmDeleteId(null);
                    }}
                    className="min-h-[40px] px-2.5 rounded-xl bg-red-600 text-white text-[11px] font-bold hover:bg-red-700 transition"
                  >
                    Confirmar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(service.id)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-zinc-800 transition active:scale-95"
                    title="Excluir Culto"
                    aria-label={`Excluir ${service.label}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal - Mobile Bottom Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingService ? 'Editar Culto' : 'Novo Culto'}
            className={`w-full max-w-md max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-200 border-t sm:border ${
              isDark ? 'bg-zinc-900 text-zinc-100 border-zinc-800' : 'bg-white text-slate-800 border-emerald-100'
            }`}
          >
            {/* Mobile Drag Indicator Handle */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center w-full bg-inherit">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
            </div>

            <div
              className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between ${
                isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-[#2F9B45]/20 bg-emerald-50/50'
              }`}
            >
              <h2 className="text-base font-bold text-[#1B7A32] dark:text-[#42bb5b]">
                {editingService ? 'Editar Culto' : 'Novo Culto / Reunião'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 touch-manipulation">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                  Nome do Culto / Ocasião
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Culto da Família (Domingo 19h)"
                  className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                    Dia da Semana
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className={`w-full min-h-[46px] text-sm px-3 py-2 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="Domingo">Domingo</option>
                    <option value="Segunda-feira">Segunda-feira</option>
                    <option value="Terça-feira">Terça-feira</option>
                    <option value="Quarta-feira">Quarta-feira</option>
                    <option value="Quinta-feira">Quinta-feira</option>
                    <option value="Sexta-feira">Sexta-feira</option>
                    <option value="Sábado">Sábado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={`w-full min-h-[46px] text-sm px-3 py-2 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Sticky Natural Thumb Zone Actions */}
            <div
              className={`px-4 sm:px-5 py-3 border-t flex items-center justify-end gap-2.5 pb-safe ${
                isDark ? 'border-zinc-800 bg-zinc-950/90' : 'border-slate-200 bg-white shadow-lg'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 sm:flex-none min-h-[46px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 sm:flex-none min-h-[46px] px-6 py-2 rounded-xl text-xs font-bold bg-[#2F9B45] text-white hover:bg-[#258239] transition shadow-sm active:scale-95"
              >
                Salvar Culto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
