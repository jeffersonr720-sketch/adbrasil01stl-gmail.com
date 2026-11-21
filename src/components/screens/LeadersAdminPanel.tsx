import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { LeaderRole, LeaderUser } from '../../types';
import { validateLeaderFormInput } from '../../utils/authRules';
import { getWhatsAppShareUrl } from '../../utils/rules';
import {
  UserPlus,
  Edit2,
  Trash2,
  Shield,
  KeyRound,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Power,
  Copy,
  Check,
  MessageCircle,
  Clock
} from 'lucide-react';

interface IssuedRecoveryCode {
  code: string;
  leaderName: string;
  leaderLogin: string;
}

export const LeadersAdminPanel: React.FC = () => {
  const {
    user,
    leaders,
    isLeadersLoading,
    recoveryRequests,
    issueRecoveryCode,
    createLeader,
    updateLeader,
    deleteLeader
  } = useAuth();
  const { ministries, isDark, showSnackbar, churchName } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState<LeaderUser | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('Líder de Departamento');
  const [role, setRole] = useState<LeaderRole>('leader');
  const [ministryId, setMinistryId] = useState<string>(ministries[0]?.id || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [issuingLeaderId, setIssuingLeaderId] = useState<string | null>(null);
  const [issuedCodes, setIssuedCodes] = useState<Record<string, IssuedRecoveryCode>>({});
  const [copiedLeaderId, setCopiedLeaderId] = useState<string | null>(null);

  const openNew = () => {
    setEditingLeader(null);
    setName('');
    setLoginInput('');
    setEmail('');
    setCargo('Líder de Departamento');
    setRole('leader');
    setMinistryId(ministries[0]?.id || '');
    setPassword('');
    setShowPassword(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (leader: LeaderUser) => {
    setEditingLeader(leader);
    setName(leader.name);
    setLoginInput(leader.login);
    setEmail(leader.email || '');
    setCargo(leader.cargo || '');
    setRole(leader.role);
    setMinistryId(leader.ministryId || ministries[0]?.id || '');
    setPassword('');
    setShowPassword(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validationError = validateLeaderFormInput({
      name,
      login: loginInput,
      password,
      requirePassword: !editingLeader,
      role,
      ministryId: role === 'admin' ? null : ministryId
    });

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    if (editingLeader) {
      const res = await updateLeader(editingLeader.id, {
        name: name.trim(),
        login: loginInput.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        cargo: cargo.trim(),
        role,
        ministryId: role === 'admin' ? null : ministryId,
        ...(password ? { password } : {})
      });
      setIsSaving(false);
      if (!res.ok) {
        setFormError(res.error || 'Erro ao atualizar acesso.');
        return;
      }
      showSnackbar(`Acesso de ${name.trim()} atualizado!`);
    } else {
      const res = await createLeader({
        name: name.trim(),
        login: loginInput.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        cargo: cargo.trim(),
        role,
        ministryId: role === 'admin' ? null : ministryId,
        password
      });
      setIsSaving(false);
      if (!res.ok) {
        setFormError(res.error || 'Erro ao cadastrar acesso.');
        return;
      }
      showSnackbar(`Novo login criado para ${name.trim()}!`);
    }
    setIsModalOpen(false);
  };

  const handleToggleActive = async (leader: LeaderUser) => {
    const res = await updateLeader(leader.id, { active: !leader.active });
    if (!res.ok) {
      showSnackbar(res.error || 'Não foi possível alterar o status.');
      return;
    }
    showSnackbar(leader.active ? `Acesso de ${leader.name} desativado.` : `Acesso de ${leader.name} reativado.`);
  };

  const handleDelete = async (leader: LeaderUser) => {
    const res = await deleteLeader(leader.id);
    setConfirmDeleteId(null);
    if (!res.ok) {
      showSnackbar(res.error || 'Não foi possível excluir este acesso.');
      return;
    }
    showSnackbar(`Acesso de ${leader.name} removido.`);
  };

  const handleIssueCode = async (leaderId: string, leaderName: string, leaderLogin: string) => {
    setIssuingLeaderId(leaderId);
    const res = await issueRecoveryCode(leaderId);
    setIssuingLeaderId(null);

    if (!res.ok || !res.code) {
      showSnackbar(res.error || 'Não foi possível gerar o código de recuperação.');
      return;
    }

    setIssuedCodes((prev) => ({
      ...prev,
      [leaderId]: {
        code: res.code!,
        leaderName,
        leaderLogin
      }
    }));
    showSnackbar(`Código de recuperação gerado para @${leaderLogin}!`);
  };

  const handleCopyCode = async (leaderId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedLeaderId(leaderId);
      showSnackbar('Código copiado para a área de transferência!');
      setTimeout(() => {
        setCopiedLeaderId((prev) => (prev === leaderId ? null : prev));
      }, 2500);
    } catch {
      showSnackbar(`Código de recuperação: ${code}`);
    }
  };

  const buildRecoveryWhatsAppUrl = (issued: IssuedRecoveryCode, contactNote?: string) => {
    const text = [
      `🔑 *Recuperação de Senha - ${churchName}*`,
      `Olá ${issued.leaderName}!`,
      `Seu código de verificação para o login *@${issued.leaderLogin}* é:`,
      ``,
      `*${issued.code}*`,
      ``,
      `Acesse "Esqueceu a senha?" -> "2. Já Tenho Código" na tela de login para criar sua nova senha. O código expira em 30 minutos.`
    ].join('\n');
    const digits = contactNote ? contactNote.replace(/\D/g, '') : '';
    const phone = digits.length >= 10 && digits.length <= 13 ? digits : undefined;
    return getWhatsAppShareUrl(text, phone);
  };

  return (
    <div className="space-y-4">
      {recoveryRequests.length > 0 && (
        <div
          className={`p-4 sm:p-5 rounded-3xl border ${
            isDark
              ? 'bg-amber-950/20 border-amber-800/60'
              : 'bg-amber-50/70 border-amber-200 shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className={`font-bold text-sm sm:text-base flex items-center gap-2 ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                <KeyRound className="w-4 h-4 text-[#F7B13D]" />
                <span>Pedidos de Recuperação de Senha ({recoveryRequests.length})</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                Gere um código de 6 dígitos (válido por 30 min) e envie ao líder solicitante.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {recoveryRequests.map((req) => {
              const ministry = req.ministryId
                ? ministries.find((m) => m.id === req.ministryId)
                : null;
              const issued = issuedCodes[req.leaderId];
              const isIssuing = issuingLeaderId === req.leaderId;

              return (
                <div
                  key={req.id}
                  className={`p-3.5 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-amber-200/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-mono font-bold text-[#1B7A32] dark:text-[#42bb5b]">
                          @{req.leaderLogin}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {req.leaderName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-500 dark:text-zinc-400">
                          {ministry?.name || 'Coordenação Geral'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                          <Clock className="w-3 h-3" />
                          {req.status === 'code_issued' ? 'Código já emitido (30 min)' : 'Aguardando código'}
                        </span>
                        {req.contactNote && (
                          <span>· Obs: {req.contactNote}</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isIssuing}
                      onClick={() => handleIssueCode(req.leaderId, req.leaderName, req.leaderLogin)}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#2F9B45] hover:bg-[#258239] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition shrink-0"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#F7B13D]" />
                      <span>
                        {isIssuing
                          ? 'Gerando...'
                          : req.status === 'code_issued' || issued
                          ? 'Gerar Novo Código'
                          : 'Gerar Código'}
                      </span>
                    </button>
                  </div>

                  {issued && (
                    <div
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        isDark ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-emerald-50 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                          Código:
                        </span>
                        <span className="font-mono text-lg font-extrabold tracking-[0.2em] text-[#1B7A32] dark:text-[#42bb5b]">
                          {issued.code}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(req.leaderId, issued.code)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold inline-flex items-center gap-1.5 hover:border-[#2F9B45] transition"
                        >
                          {copiedLeaderId === req.leaderId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#2F9B45]" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#2F9B45]" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        <a
                          href={buildRecoveryWhatsAppUrl(issued, req.contactNote)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5b] text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Enviar via WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`p-4 sm:p-5 rounded-3xl border ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className={`font-bold text-base flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Shield className="w-5 h-5 text-[#2F9B45]" />
              <span>Acessos de Líderes de Departamento</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Cadastre logins e senhas individuais para cada líder gerenciar as escalas do seu departamento.
            </p>
          </div>

          <button
            type="button"
            onClick={openNew}
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] text-white font-bold text-xs shadow-sm transition active:scale-95 shrink-0"
          >
            <UserPlus className="w-4 h-4 text-[#F7B13D]" />
            <span>Novo Acesso de Líder</span>
          </button>
        </div>

        {isLeadersLoading ? (
          <p className="text-xs text-slate-500 py-6 text-center">Carregando acessos cadastrados...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {leaders.map((leader) => {
              const ministry = leader.ministryId
                ? ministries.find((m) => m.id === leader.ministryId)
                : null;
              const isSelf = user?.id === leader.id;
              const issued = issuedCodes[leader.id];
              const isIssuing = issuingLeaderId === leader.id;

              return (
                <div
                  key={leader.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition ${
                    !leader.active
                      ? isDark
                        ? 'bg-zinc-950/60 border-zinc-800/80 opacity-65'
                        : 'bg-slate-50 border-slate-200 opacity-70'
                      : isDark
                      ? 'bg-zinc-800/50 border-zinc-700/80'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                        <span className="font-mono font-bold text-[#1B7A32] dark:text-[#42bb5b]">
                          @{leader.login}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {leader.role === 'admin'
                            ? 'Coordenação Geral'
                            : ministry?.name || 'Sem ministério'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={leader.active ? 'text-[#2F9B45] font-semibold' : 'text-red-500 font-semibold'}>
                          {leader.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 truncate">
                        {leader.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {leader.cargo || 'Líder'}{leader.email ? ` · ${leader.email}` : ''}
                      </p>
                    </div>
                  </div>

                  {issued && (
                    <div
                      className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                        isDark ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-emerald-50 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-300">
                          Código (30m):
                        </span>
                        <span className="font-mono text-sm font-extrabold tracking-widest text-[#1B7A32] dark:text-[#42bb5b]">
                          {issued.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(leader.id, issued.code)}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[11px] font-bold inline-flex items-center gap-1"
                        >
                          {copiedLeaderId === leader.id ? (
                            <Check className="w-3 h-3 text-[#2F9B45]" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#2F9B45]" />
                          )}
                          <span>{copiedLeaderId === leader.id ? 'Copiado' : 'Copiar'}</span>
                        </button>
                        <a
                          href={buildRecoveryWhatsAppUrl(issued)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#25D366] hover:bg-[#1ebe5b] text-white text-[11px] font-bold inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200/70 dark:border-zinc-700/60">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(leader)}
                        className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 hover:border-[#2F9B45] transition"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#2F9B45]" />
                        <span>Editar / Senha</span>
                      </button>

                      {leader.active && (
                        <button
                          type="button"
                          disabled={isIssuing}
                          onClick={() => handleIssueCode(leader.id, leader.name, leader.login)}
                          className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:border-[#F7B13D] disabled:opacity-60 transition"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[#F7B13D]" />
                          <span>{isIssuing ? 'Gerando...' : 'Gerar Código'}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {!isSelf && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(leader)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-zinc-800 transition"
                            title={leader.active ? 'Desativar acesso' : 'Reativar acesso'}
                            aria-label={leader.active ? `Desativar ${leader.name}` : `Ativar ${leader.name}`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          {confirmDeleteId === leader.id ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(leader)}
                              className="min-h-[40px] px-2.5 rounded-xl bg-red-600 text-white text-[11px] font-bold hover:bg-red-700 transition"
                            >
                              Confirmar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(leader.id)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-zinc-800 transition"
                              title="Excluir acesso"
                              aria-label={`Excluir acesso de ${leader.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Leader Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leader-modal-title"
            className={`w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden border-t sm:border ${
              isDark
                ? 'bg-zinc-900 text-zinc-100 border-zinc-800'
                : 'bg-white text-slate-800 border-emerald-100'
            }`}
          >
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center w-full bg-inherit">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
            </div>

            <div
              className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between ${
                isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-[#2F9B45]/20 bg-emerald-50/50'
              }`}
            >
              <h2 id="leader-modal-title" className="text-base font-bold text-[#1B7A32] dark:text-[#42bb5b]">
                {editingLeader ? 'Editar Acesso do Líder' : 'Cadastrar Novo Líder'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div
                  role="alert"
                  className={`p-3 rounded-xl border flex items-start gap-2 text-xs font-medium ${
                    isDark
                      ? 'bg-red-950/50 border-red-800 text-red-200'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="leader-name"
                  className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                >
                  Nome Completo do Líder
                </label>
                <input
                  id="leader-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Pr. Marcos Vinícius"
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
                  <label
                    htmlFor="leader-login"
                    className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                  >
                    Login de Acesso
                  </label>
                  <input
                    id="leader-login"
                    type="text"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="Ex: jovens, midia.noite"
                    className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="leader-email"
                    className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                  >
                    E-mail (Opcional)
                  </label>
                  <input
                    id="leader-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: lider@igreja.com.br"
                    className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="leader-role"
                    className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                  >
                    Nível de Permissão
                  </label>
                  <select
                    id="leader-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as LeaderRole)}
                    className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="leader">Líder de Departamento</option>
                    <option value="admin">Coordenação Geral (Total)</option>
                  </select>
                </div>

                {role === 'leader' ? (
                  <div>
                    <label
                      htmlFor="leader-ministry"
                      className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                    >
                      Departamento Responsável
                    </label>
                    <select
                      id="leader-ministry"
                      value={ministryId}
                      onChange={(e) => setMinistryId(e.target.value)}
                      className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                        isDark
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {ministries.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="leader-cargo"
                      className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                    >
                      Cargo
                    </label>
                    <input
                      id="leader-cargo"
                      type="text"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      placeholder="Ex: Coordenação Geral"
                      className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                        isDark
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                )}
              </div>

              {role === 'leader' && (
                <div>
                  <label
                    htmlFor="leader-cargo-dept"
                    className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                  >
                    Cargo / Função
                  </label>
                  <input
                    id="leader-cargo-dept"
                    type="text"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Ex: Líder de Louvor, Coordenador de Mídia"
                    className={`w-full min-h-[46px] text-sm px-3.5 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="leader-password"
                  className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                >
                  {editingLeader
                    ? 'Nova Senha (deixe em branco para manter a atual)'
                    : 'Senha de Acesso (mín. 6 caracteres)'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="leader-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingLeader ? 'Opcional: redefinir senha' : 'Mínimo 6 caracteres'}
                    className={`w-full min-h-[46px] text-sm pl-10 pr-12 py-2.5 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div
                className={`pt-3 border-t flex items-center justify-end gap-2.5 ${
                  isDark ? 'border-zinc-800' : 'border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 sm:flex-none min-h-[46px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 sm:flex-none min-h-[46px] px-6 py-2 rounded-xl text-xs font-bold bg-[#2F9B45] text-white hover:bg-[#258239] disabled:opacity-60 transition shadow-sm"
                >
                  {isSaving ? 'Salvando...' : editingLeader ? 'Salvar Alterações' : 'Criar Acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
