import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  canManageMinistry,
  canManageServicesAndMinistries,
  getScopedMembers,
  getScopedMinistries
} from '../../utils/authRules';
import {
  createRoleDraftsFromLocais,
  normalizeRoleName,
  RoleDraftItem,
  validateRoleDrafts,
  validateRoleName
} from '../../utils/ministryRoles';
import { Ministry } from '../../types';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';

export const MinistriesScreen: React.FC = () => {
  const {
    ministries,
    members,
    addMinistry,
    saveMinistryRoles,
    addMinistryRole,
    deleteMinistry,
    isDark,
    showSnackbar
  } = useApp();
  const { user } = useAuth();
  const canEditStructure = canManageServicesAndMinistries(user);

  const scopedMinistries = useMemo(
    () => getScopedMinistries(ministries, user),
    [ministries, user]
  );
  const scopedMembers = useMemo(
    () => getScopedMembers(members, user),
    [members, user]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMinistry, setEditingMinistry] = useState<Ministry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Inline quick-add per card
  const [quickAddMinistryId, setQuickAddMinistryId] = useState<string | null>(null);
  const [quickAddRoleText, setQuickAddRoleText] = useState('');

  // Modal states
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2F9B45');
  const [roleDrafts, setRoleDrafts] = useState<RoleDraftItem[]>([]);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const openNew = () => {
    setEditingMinistry(null);
    setName('');
    setColor('#2F9B45');
    setRoleDrafts([]);
    setNewRoleInput('');
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEdit = (min: Ministry) => {
    setEditingMinistry(min);
    setName(min.name);
    setColor(min.color || '#2F9B45');
    setRoleDrafts(createRoleDraftsFromLocais(min.locais));
    setNewRoleInput('');
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleAddDraftRole = () => {
    const existingNames = roleDrafts.map((d) => d.name);
    const err = validateRoleName(newRoleInput, existingNames);
    if (err) {
      setModalError(err);
      return;
    }
    const clean = normalizeRoleName(newRoleInput);
    setRoleDrafts((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        originalName: null,
        name: clean
      }
    ]);
    setNewRoleInput('');
    setModalError(null);
  };

  const handleUpdateDraftName = (id: string, value: string) => {
    setRoleDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, name: value } : d)));
    if (modalError) setModalError(null);
  };

  const handleRemoveDraft = (id: string) => {
    setRoleDrafts((prev) => prev.filter((d) => d.id !== id));
    if (modalError) setModalError(null);
  };

  const handleQuickAddSubmit = (ministryId: string) => {
    const res = addMinistryRole(ministryId, quickAddRoleText);
    if (res.ok) {
      setQuickAddRoleText('');
      setQuickAddMinistryId(null);
    }
  };

  const handleSave = () => {
    if (canEditStructure && !name.trim()) {
      setModalError('Informe o nome do ministério.');
      return;
    }

    const draftsErr = validateRoleDrafts(roleDrafts);
    if (draftsErr) {
      setModalError(draftsErr);
      return;
    }

    if (editingMinistry) {
      const ok = saveMinistryRoles({
        ministryId: editingMinistry.id,
        drafts: roleDrafts,
        name: canEditStructure ? name.trim() : undefined,
        color: canEditStructure ? color : undefined
      });
      if (!ok) return;
    } else {
      const locais = roleDrafts.map((d) => normalizeRoleName(d.name)).filter(Boolean);
      addMinistry({
        name: name.trim(),
        color,
        locais
      });
    }

    setIsModalOpen(false);
  };

  const modalTitle = editingMinistry
    ? canEditStructure
      ? 'Editar Ministério e Funções'
      : `Postos / Funções · ${editingMinistry.name}`
    : 'Novo Ministério';

  return (
    <div className="space-y-4 sm:space-y-5 pb-6 sm:pb-8 w-full touch-manipulation">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-baseline gap-2">
            <span>{user?.role === 'leader' ? 'Meu Departamento' : 'Ministérios & Departamentos'}</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tabular-nums">
              · {scopedMinistries.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {user?.role === 'leader'
              ? 'Crie e edite os postos e funções específicas que compõem a escala do seu departamento'
              : 'Gerencie os departamentos e crie ou edite os postos e funções de cada escala'}
          </p>
        </div>

        {canEditStructure && (
          <button
            type="button"
            onClick={openNew}
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs shadow-sm transition-all active:scale-95 shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#F7B13D]" />
            <span>Novo Ministério</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {scopedMinistries.map((ministry) => {
          const volunteerCount = scopedMembers.filter((m) => m.ministryId === ministry.id).length;
          const canManageThisMinistry = canManageMinistry(user, ministry.id);
          const isQuickAdding = quickAddMinistryId === ministry.id;

          return (
            <div
              key={ministry.id}
              className={`p-4 rounded-3xl border transition-all flex flex-col justify-between touch-manipulation ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  : 'bg-white border-slate-200 hover:border-[#2F9B45]/40 shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-xs ring-2 ring-white dark:ring-zinc-800"
                      style={{ backgroundColor: ministry.color || '#2F9B45' }}
                    />
                    <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                      {ministry.name}
                    </h3>
                  </div>

                  {canEditStructure && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(ministry)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-[#2F9B45] hover:bg-emerald-50 dark:hover:bg-zinc-800 transition active:scale-95"
                        title="Editar Ministério e Funções"
                        aria-label={`Editar ${ministry.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {confirmDeleteId === ministry.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            deleteMinistry(ministry.id);
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[40px] px-2.5 rounded-xl bg-red-600 text-white text-[11px] font-bold hover:bg-red-700 transition"
                        >
                          Confirmar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(ministry.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-zinc-800 transition active:scale-95"
                          title="Excluir Ministério"
                          aria-label={`Excluir ${ministry.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-zinc-400 tabular-nums">
                  <span className="font-semibold text-[#1B7A32] dark:text-[#42bb5b]">
                    {volunteerCount === 1 ? '1 voluntário' : `${volunteerCount} voluntários`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {ministry.locais.length === 1
                      ? '1 posto / função'
                      : `${ministry.locais.length} postos / funções`}
                  </span>
                </div>

                {/* Locais Chips */}
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-wider">
                      Postos / Funções:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {ministry.locais.map((local) => (
                      <span
                        key={local}
                        className="text-[11px] px-2.5 py-1 rounded-xl font-medium bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/60"
                      >
                        {local}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Create & Edit Roles on Card */}
              {canManageThisMinistry && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800">
                  {isQuickAdding ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={quickAddRoleText}
                        onChange={(e) => setQuickAddRoleText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleQuickAddSubmit(ministry.id);
                          } else if (e.key === 'Escape') {
                            setQuickAddMinistryId(null);
                            setQuickAddRoleText('');
                          }
                        }}
                        placeholder="Nome do novo posto / função..."
                        aria-label={`Novo posto ou função para ${ministry.name}`}
                        autoFocus
                        className={`flex-1 min-w-0 min-h-[44px] px-3 py-2 text-sm sm:text-xs rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                          isDark
                            ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickAddSubmit(ministry.id)}
                        aria-label={`Salvar novo posto em ${ministry.name}`}
                        className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs flex items-center justify-center transition active:scale-95 shrink-0"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickAddMinistryId(null);
                          setQuickAddRoleText('');
                        }}
                        aria-label="Cancelar novo posto"
                        className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center transition shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickAddMinistryId(ministry.id);
                          setQuickAddRoleText('');
                        }}
                        className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-bold border border-dashed flex items-center justify-center gap-1.5 transition active:scale-95 whitespace-nowrap ${
                          isDark
                            ? 'border-zinc-700 text-[#42bb5b] hover:bg-zinc-800'
                            : 'border-[#2F9B45]/40 text-[#1B7A32] hover:bg-emerald-50/70'
                        }`}
                      >
                        <Plus className="w-4 h-4 text-[#2F9B45] shrink-0" />
                        <span>Novo Posto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(ministry)}
                        aria-label={`Editar funções de ${ministry.name}`}
                        className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 whitespace-nowrap ${
                          isDark
                            ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                            : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-[#1B7A32]'
                        }`}
                      >
                        <Edit2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Editar Funções</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal - Mobile Bottom Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modalTitle}
            className={`w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-200 border-t sm:border ${
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
              <div className="flex items-center gap-2.5 min-w-0">
                {editingMinistry && (
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: color || '#2F9B45' }}
                  />
                )}
                <h2 className="text-base font-bold text-[#1B7A32] dark:text-[#42bb5b] truncate">
                  {modalTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto touch-manipulation">
              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold">
                  {modalError}
                </div>
              )}

              {canEditStructure && (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                      Nome do Ministério
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (modalError) setModalError(null);
                      }}
                      placeholder="Ex: Louvor & Adoração, Mídia, Diaconato"
                      className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                        isDark
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                      Cor
                    </label>
                    <div className="flex items-center gap-2.5 min-h-[46px] px-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        aria-label="Cor de Identificação"
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-zinc-300">
                        {color}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Create new Posto / Função */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-zinc-400">
                  Adicionar Novo Posto / Função
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newRoleInput}
                    onChange={(e) => {
                      setNewRoleInput(e.target.value);
                      if (modalError) setModalError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDraftRole();
                      }
                    }}
                    placeholder="Ex: Backing Vocal, Operador de Som, Portaria"
                    aria-label="Nome do novo posto ou função"
                    className={`flex-1 min-w-0 min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleAddDraftRole}
                    className="min-h-[46px] px-4 rounded-xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4 text-[#F7B13D]" />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>

              {/* Editable Role List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                    Postos / Funções Cadastrados ({roleDrafts.length})
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    Toque no nome para editar
                  </span>
                </div>

                {roleDrafts.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 text-center text-xs text-slate-500 dark:text-zinc-400">
                    Nenhum posto cadastrado ainda. Adicione acima o primeiro posto ou função.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {roleDrafts.map((draft, idx) => {
                      const assignedMemberCount =
                        editingMinistry && draft.originalName
                          ? scopedMembers.filter(
                              (m) =>
                                m.ministryId === editingMinistry.id &&
                                m.locais.includes(draft.originalName!)
                            ).length
                          : 0;

                      return (
                        <div
                          key={draft.id}
                          className={`flex items-center gap-2 p-2 rounded-2xl border ${
                            isDark
                              ? 'bg-zinc-800/70 border-zinc-700'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <span className="w-6 text-center text-[11px] font-bold text-slate-400 tabular-nums shrink-0">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={draft.name}
                              onChange={(e) => handleUpdateDraftName(draft.id, e.target.value)}
                              aria-label={`Nome da função ${idx + 1}`}
                              className={`w-full min-h-[42px] px-3 py-1.5 text-sm sm:text-xs rounded-xl border outline-none font-semibold focus:ring-2 focus:ring-[#2F9B45]/30 ${
                                isDark
                                  ? 'bg-zinc-900 border-zinc-700 text-white'
                                  : 'bg-white border-slate-200 text-slate-900'
                              }`}
                            />
                            {assignedMemberCount > 0 && (
                              <p className="text-[10px] text-slate-500 dark:text-zinc-400 px-1 mt-0.5 tabular-nums">
                                {assignedMemberCount} voluntário(s) habilitado(s)
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDraft(draft.id)}
                            aria-label={`Remover função ${draft.name || idx + 1}`}
                            title="Remover posto / função"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-zinc-700 transition active:scale-95 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
                  Ao renomear um posto, os voluntários habilitados e as escalas existentes são atualizados automaticamente.
                </p>
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
                {editingMinistry ? 'Salvar Funções' : 'Salvar Ministério'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

