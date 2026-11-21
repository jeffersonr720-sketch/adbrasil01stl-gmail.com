import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { validatePasswordChange } from '../../utils/authRules';
import {
  ArrowLeft,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Check
} from 'lucide-react';

export const ChangePasswordScreen: React.FC = () => {
  const { user, changePassword } = useAuth();
  const { isDark, showSnackbar, closePasswordTab, ministries } = useApp();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const userMinistry = user?.ministryId
    ? ministries.find((m) => m.id === user.ministryId)
    : null;
  const departmentLabel =
    user?.role === 'admin'
      ? 'Coordenação Geral'
      : userMinistry?.name || user?.cargo || 'Departamento';

  const hasMinLength = newPassword.length >= 6;
  const isDifferent = Boolean(newPassword && currentPassword && newPassword !== currentPassword);
  const matchesConfirm = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validationError = validatePasswordChange(currentPassword, newPassword, confirmPassword);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setIsSaving(true);
    const result = await changePassword(currentPassword, newPassword);
    setIsSaving(false);

    if (!result.ok) {
      setErrorMsg(result.error || 'Erro ao alterar a senha.');
      return;
    }

    setIsSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showSnackbar('Sua senha foi alterada com sucesso!');
  };

  return (
    <div className="w-full flex flex-col items-center justify-start pt-1 sm:pt-4 pb-8 lg:pb-10">
      <div className="w-full max-w-md mx-auto space-y-2.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={closePasswordTab}
            className="min-h-[40px] inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-4 h-4 text-[#2F9B45]" />
            <span>Voltar</span>
          </button>

          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Segurança da Conta
          </span>
        </div>

        <section
          aria-labelledby="change-password-page-title"
          className={`w-full rounded-3xl border shadow-sm overflow-hidden transition-colors ${
            isDark
              ? 'bg-zinc-900 text-zinc-100 border-zinc-800'
              : 'bg-white text-slate-800 border-emerald-100'
          }`}
        >
          <div
            className={`px-4 sm:px-6 py-4 border-b text-center ${
              isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-emerald-100 bg-emerald-50/50'
            }`}
          >
            <div className="w-10 h-10 rounded-2xl bg-[#2F9B45]/10 border border-[#2F9B45]/20 flex items-center justify-center mx-auto mb-2">
              <KeyRound className="w-5 h-5 text-[#2F9B45]" />
            </div>
            <h1
              id="change-password-page-title"
              className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white"
            >
              Alterar Minha Senha
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              @{user?.login} · {user?.name} ({departmentLabel})
            </p>
          </div>

          {isSuccess ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#2F9B45] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Senha atualizada!
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Sua nova senha já está ativa para os próximos acessos.
                </p>
              </div>
              <button
                type="button"
                onClick={closePasswordTab}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#2F9B45] hover:bg-[#258239] text-white shadow-sm transition"
              >
                Voltar ao Aplicativo
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3">
              {errorMsg && (
                <div
                  role="alert"
                  className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs font-medium ${
                    isDark
                      ? 'bg-red-950/50 border-red-800 text-red-200'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="page-current-password"
                  className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                >
                  Senha Atual
                </label>
                <input
                  id="page-current-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Digite sua senha atual"
                  className={`w-full min-h-[44px] text-sm px-3.5 py-2 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white focus:border-[#2F9B45]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#2F9B45]'
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="page-new-password"
                  className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                >
                  Nova Senha
                </label>
                <input
                  id="page-new-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Mínimo 6 caracteres"
                  className={`w-full min-h-[44px] text-sm px-3.5 py-2 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white focus:border-[#2F9B45]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#2F9B45]'
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="page-confirm-password"
                  className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-zinc-400"
                >
                  Confirmar Nova Senha
                </label>
                <input
                  id="page-confirm-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Repita a nova senha"
                  className={`w-full min-h-[44px] text-sm px-3.5 py-2 rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white focus:border-[#2F9B45]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#2F9B45]'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPasswords((prev) => !prev)}
                  className="min-h-[36px] inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F9B45] dark:text-[#42bb5b] hover:underline"
                >
                  {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPasswords ? 'Ocultar senhas' : 'Mostrar senhas digitadas'}</span>
                </button>
              </div>

              <div
                className={`p-2.5 rounded-2xl border text-[11px] space-y-1 ${
                  isDark ? 'bg-zinc-950/60 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <p className={`flex items-center gap-1.5 ${hasMinLength ? 'text-[#2F9B45] font-semibold' : ''}`}>
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Pelo menos 6 caracteres</span>
                </p>
                <p className={`flex items-center gap-1.5 ${isDifferent ? 'text-[#2F9B45] font-semibold' : ''}`}>
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Diferente da senha atual</span>
                </p>
                <p className={`flex items-center gap-1.5 ${matchesConfirm ? 'text-[#2F9B45] font-semibold' : ''}`}>
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Confirmação igual à nova senha</span>
                </p>
              </div>

              <div className="pt-1 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={closePasswordTab}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-black/5 dark:hover:bg-white/10 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold bg-[#2F9B45] text-white hover:bg-[#258239] disabled:opacity-60 flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#F7B13D]" />
                  <span>{isSaving ? 'Salvando...' : 'Atualizar Senha'}</span>
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};
