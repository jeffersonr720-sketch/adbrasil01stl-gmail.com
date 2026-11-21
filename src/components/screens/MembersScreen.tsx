import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  canManageMinistry,
  getScopedMembers,
  getScopedMinistries
} from '../../utils/authRules';
import { Member } from '../../types';
import { calculateMemberStats } from '../../utils/rules';
import {
  Plus,
  Phone,
  MessageCircle,
  Edit2,
  Trash2,
  X,
  Search,
  Check
} from 'lucide-react';

export const MembersScreen: React.FC = () => {
  const {
    members,
    ministries,
    schedules,
    addMember,
    updateMember,
    deleteMember,
    addMinistryRole,
    isDark,
    searchQuery,
    setSearchQuery,
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

  const [selectedMinistryFilter, setSelectedMinistryFilter] = useState<string>(() =>
    user?.role === 'leader' && user.ministryId ? user.ministryId : 'all'
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [cargo, setCargo] = useState('Voluntário');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ministryId, setMinistryId] = useState('');
  const [selectedLocais, setSelectedLocais] = useState<string[]>([]);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleText, setNewRoleText] = useState('');

  const filteredMembers = useMemo(() => {
    return scopedMembers.filter((m) => {
      const matchMin =
        scopedMinistries.length <= 1 ||
        selectedMinistryFilter === 'all' ||
        m.ministryId === selectedMinistryFilter;
      const matchSearch =
        !searchQuery ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.cargo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone.includes(searchQuery) ||
        m.locais.some((l) => l.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchMin && matchSearch;
    });
  }, [scopedMembers, scopedMinistries.length, selectedMinistryFilter, searchQuery]);

  const openNew = () => {
    setEditingMember(null);
    setName('');
    setCargo('Voluntário');
    setPhone('');
    setEmail('');
    const defaultMinId =
      user?.role === 'leader' && user.ministryId
        ? user.ministryId
        : scopedMinistries[0]?.id || '';
    setMinistryId(defaultMinId);
    setSelectedLocais([]);
    setIsAddingRole(false);
    setNewRoleText('');
    setIsModalOpen(true);
  };

  const openEdit = (member: Member) => {
    setEditingMember(member);
    setName(member.name);
    setCargo(member.cargo);
    setPhone(member.phone);
    setEmail(member.email || '');
    setMinistryId(member.ministryId);
    setSelectedLocais([...member.locais]);
    setIsAddingRole(false);
    setNewRoleText('');
    setIsModalOpen(true);
  };

  const activeMinistryObj = scopedMinistries.find((m) => m.id === ministryId);

  const toggleLocalSelection = (local: string) => {
    setSelectedLocais((prev) =>
      prev.includes(local) ? prev.filter((l) => l !== local) : [...prev, local]
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      showSnackbar('Informe o nome do voluntário.');
      return;
    }
    if (!ministryId) {
      showSnackbar('Selecione um ministério para o voluntário.');
      return;
    }

    if (editingMember) {
      updateMember({
        ...editingMember,
        name: name.trim(),
        cargo: cargo.trim(),
        phone: phone.trim(),
        email: email.trim(),
        ministryId,
        locais: selectedLocais
      });
    } else {
      addMember({
        name: name.trim(),
        cargo: cargo.trim(),
        phone: phone.trim(),
        email: email.trim(),
        ministryId,
        locais: selectedLocais
      });
    }

    setIsModalOpen(false);
  };

  const departmentTitle =
    user?.role === 'leader' && scopedMinistries[0]
      ? `Voluntários · ${scopedMinistries[0].name}`
      : 'Voluntários & Equipe';

  return (
    <div className="space-y-4 sm:space-y-5 pb-6 sm:pb-8 w-full touch-manipulation">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-baseline gap-2 flex-wrap">
            <span>{departmentTitle}</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tabular-nums">
              · {scopedMembers.length} cadastrados
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {user?.role === 'leader' && scopedMinistries[0]
              ? `Gerencie os voluntários, telefones e funções de ${scopedMinistries[0].name}`
              : 'Cadastre os voluntários, seus cargos, telefones e funções habilitadas'}
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs shadow-sm transition-all active:scale-95 shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4 text-[#F7B13D]" />
          <span>Novo Voluntário</span>
        </button>
      </div>

      {/* Direct Inline Search Bar for easy mobile filtering */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar voluntário por nome, cargo ou função..."
          aria-label="Buscar voluntário"
          className={`w-full min-h-[46px] pl-10 pr-10 py-2.5 text-sm rounded-2xl border outline-none transition focus:ring-2 focus:ring-[#2F9B45]/30 ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:border-[#2F9B45]'
              : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#2F9B45] shadow-xs'
          }`}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Limpar busca"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Chips by Ministry (only visible when user sees multiple ministries) */}
      {scopedMinistries.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar touch-pan-x">
          <button
            type="button"
            onClick={() => setSelectedMinistryFilter('all')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 active:scale-95 whitespace-nowrap ${
              selectedMinistryFilter === 'all'
                ? 'bg-[#2F9B45] text-white shadow-xs'
                : isDark
                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos ({scopedMembers.length})
          </button>
          {scopedMinistries.map((min) => {
            const count = scopedMembers.filter((m) => m.ministryId === min.id).length;
            return (
              <button
                type="button"
                key={min.id}
                onClick={() => setSelectedMinistryFilter(min.id)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 active:scale-95 whitespace-nowrap ${
                  selectedMinistryFilter === min.id
                    ? 'bg-[#2F9B45] text-white shadow-xs'
                    : isDark
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {min.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Members Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {filteredMembers.map((member) => {
          const ministry = scopedMinistries.find((m) => m.id === member.ministryId);
          const stats = calculateMemberStats(member.id, schedules);
          const cleanPhone = member.phone.replace(/\D/g, '');
          const whatsappUrl = cleanPhone
            ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(
                `Olá ${member.name}, a paz do Senhor Jesus! Falando da coordenação de escalas da AD Brasil...`
              )}`
            : '';

          return (
            <div
              key={member.id}
              className={`p-4 rounded-3xl border transition-all flex flex-col justify-between touch-manipulation ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  : 'bg-white border-slate-200 hover:border-[#2F9B45]/40 shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2F9B45] to-[#134E24] text-white font-bold flex items-center justify-center shrink-0 shadow-xs text-sm border border-[#2F9B45]/30">
                      {member.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {member.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {member.cargo || 'Voluntário'}
                      </p>
                    </div>
                  </div>

                  {canManageMinistry(user, member.ministryId) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(member)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-[#2F9B45] hover:bg-emerald-50 dark:hover:bg-zinc-800 transition active:scale-95"
                        title={`Editar ${member.name}`}
                        aria-label={`Editar ${member.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {confirmDeleteId === member.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            deleteMember(member.id);
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[40px] px-2.5 rounded-xl bg-red-600 text-white text-[11px] font-bold hover:bg-red-700 transition"
                        >
                          Confirmar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(member.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-zinc-800 transition active:scale-95"
                          title={`Excluir ${member.name}`}
                          aria-label={`Excluir ${member.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Ministry & Assiduidade summary */}
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                  {ministry && (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-zinc-300">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: ministry.color || '#2F9B45' }}
                      />
                      <span>{ministry.name}</span>
                    </span>
                  )}
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      stats.attendanceRate >= 80
                        ? 'text-[#1B7A32] dark:text-[#42bb5b]'
                        : 'text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {stats.attendanceRate}% presença ({stats.totalPresent}/{stats.totalAssigned})
                  </span>
                </div>

                {/* Locais habilitados */}
                {member.locais.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {member.locais.map((local) => (
                      <span
                        key={local}
                        className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-medium"
                      >
                        {local}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Phone & WhatsApp Action with 44px hitboxes */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs">
                <a
                  href={`tel:${cleanPhone}`}
                  className="min-h-[44px] flex items-center gap-1.5 text-slate-600 dark:text-zinc-400 font-mono text-xs hover:text-[#2F9B45] transition truncate"
                >
                  <Phone className="w-3.5 h-3.5 text-[#2F9B45] shrink-0" />
                  <span className="truncate">{member.phone || 'Sem telefone'}</span>
                </a>

                {cleanPhone && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 active:scale-95 transition shadow-xs shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#F7B13D]" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal - Bottom Sheet on Mobile */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingMember ? 'Editar Voluntário' : 'Novo Voluntário'}
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
              <h2 className="text-base font-bold text-[#1B7A32] dark:text-[#42bb5b]">
                {editingMember ? 'Editar Voluntário' : 'Novo Voluntário'}
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

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto touch-manipulation">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Mateus Oliveira"
                  className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                    Cargo / Função Ministerial
                  </label>
                  <input
                    type="text"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Ex: Músico, Líder, Diácono, Voluntário"
                    className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 5511999998888"
                    className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400">
                  Ministério Principal
                </label>
                <select
                  value={ministryId}
                  disabled={user?.role === 'leader'}
                  onChange={(e) => {
                    setMinistryId(e.target.value);
                  }}
                  className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 disabled:opacity-75 ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {scopedMinistries.map((min) => (
                    <option key={min.id} value={min.id}>
                      {min.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Locais que o membro pode exercer */}
              {activeMinistryObj && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                      Postos / Funções Habilitadas em {activeMinistryObj.name}
                    </label>
                    {canManageMinistry(user, activeMinistryObj.id) && !isAddingRole && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingRole(true);
                          setNewRoleText('');
                        }}
                        className="min-h-[34px] px-2.5 rounded-lg text-[11px] font-bold text-[#1B7A32] dark:text-[#42bb5b] hover:bg-emerald-50 dark:hover:bg-zinc-800 flex items-center gap-1 transition shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nova função</span>
                      </button>
                    )}
                  </div>
                  <div className="space-y-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                    <div className="flex flex-wrap gap-1.5">
                      {activeMinistryObj.locais.map((local) => {
                        const isSelected = selectedLocais.includes(local);
                        return (
                          <button
                            key={local}
                            type="button"
                            onClick={() => toggleLocalSelection(local)}
                            className={`min-h-[38px] text-xs px-3 py-1.5 rounded-xl font-medium transition active:scale-95 ${
                              isSelected
                                ? 'bg-[#2F9B45] text-white shadow-xs font-semibold'
                                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-[#2F9B45]/40'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {local}
                          </button>
                        );
                      })}
                    </div>

                    {isAddingRole && canManageMinistry(user, activeMinistryObj.id) && (
                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-zinc-700">
                        <input
                          type="text"
                          value={newRoleText}
                          onChange={(e) => setNewRoleText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const res = addMinistryRole(activeMinistryObj.id, newRoleText);
                              if (res.ok && res.normalizedName) {
                                setSelectedLocais((prev) =>
                                  prev.includes(res.normalizedName!)
                                    ? prev
                                    : [...prev, res.normalizedName!]
                                );
                                setNewRoleText('');
                                setIsAddingRole(false);
                              }
                            } else if (e.key === 'Escape') {
                              setIsAddingRole(false);
                            }
                          }}
                          placeholder="Nome do novo posto / função..."
                          aria-label="Nome do novo posto ou função"
                          autoFocus
                          className={`flex-1 min-w-0 min-h-[42px] px-3 py-1.5 text-sm sm:text-xs rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                            isDark
                              ? 'bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const res = addMinistryRole(activeMinistryObj.id, newRoleText);
                            if (res.ok && res.normalizedName) {
                              setSelectedLocais((prev) =>
                                prev.includes(res.normalizedName!)
                                  ? prev
                                  : [...prev, res.normalizedName!]
                              );
                              setNewRoleText('');
                              setIsAddingRole(false);
                            }
                          }}
                          aria-label="Criar nova função"
                          className="min-h-[42px] min-w-[42px] px-3 rounded-xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs flex items-center justify-center transition shrink-0"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingRole(false);
                            setNewRoleText('');
                          }}
                          aria-label="Cancelar nova função"
                          className="min-h-[42px] min-w-[42px] rounded-xl text-slate-500 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                Salvar Voluntário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
