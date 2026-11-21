import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import {
  validateRecoveryConfirmInput,
  validateRecoveryRequestInput
} from '../utils/authRules';
import {
  ArrowLeft,
  KeyRound,
  User,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Send,
  Sun,
  Moon,
  ShieldCheck
} from 'lucide-react';

interface Props {
  initialIdentifier?: string;
  onBackToLogin: (prefillLogin?: string) => void;
}

type RecoveryStep = 'request' | 'confirm';

export const PasswordRecoveryView: React.FC<Props> = ({
  initialIdentifier = '',
  onBackToLogin
}) => {
  const { requestPasswordRecovery, confirmPasswordRecovery } = useAuth();
  const { churchName, isDark, toggleTheme, showSnackbar } = useApp();

  const [step, setStep] = useState<RecoveryStep>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [contactNote, setContactNote] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationError = validateRecoveryRequestInput(identifier);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    const result = await requestPasswordRecovery(identifier, contactNote);
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error || 'Não foi possível enviar a solicitação.');
      return;
    }

    setRequestSent(true);
    showSnackbar('Solicitação enviada à Coordenação Geral!');
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationError = validateRecoveryConfirmInput({
      identifier,
      code,
      newPassword,
      confirmPassword
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    const result = await confirmPasswordRecovery({
      identifier,
      code,
      newPassword
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error || 'Não foi possível redefinir a senha.');
      return;
    }

    setResetDone(true);
    showSnackbar('Senha redefinida com sucesso!');
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col transition-colors font-sans antialiased ${
        isDark ? 'dark bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Cabeçalho Unificado (Web e Móvel) */}
      <header
        className={`sticky top-0 z-40 w-full border-b backdrop-blur-md ${
          isDark
            ? 'bg-zinc-900/90 border-zinc-800 text-zinc-100'
            : 'bg-white/95 border-emerald-100 text-slate-800 shadow-xs'
        }`}
      >
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 min-h-[56px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white p-1 border border-emerald-100 dark:border-zinc-700 flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/image_533f3802.png"
                alt="AD Brasil Logotipo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#2F9B45] dark:text-[#42bb5b] truncate">
                AD Brasil • Escala Fácil
              </p>
              <p className="text-xs sm:text-sm font-bold truncate">{churchName}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onBackToLogin()}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold hover:border-[#2F9B45] transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#2F9B45]" />
              <span>Voltar ao Login</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-[#2F9B45]/50 transition"
              aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#F7B13D]" />
              ) : (
                <Moon className="w-4 h-4 text-[#2F9B45]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Centralizado Abaixo do Cabeçalho (Web e Móvel) */}
      <main className="flex-1 w-full flex flex-col items-center justify-start px-3 sm:px-6 pt-6 sm:pt-12 pb-10">
        <div className="w-full max-w-md mx-auto">
          <section
            aria-labelledby="recovery-page-title"
            className={`rounded-3xl border shadow-sm overflow-hidden transition-colors ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                : 'bg-white border-emerald-100 text-slate-800'
            }`}
          >
            <div
              className={`px-5 sm:px-6 py-5 border-b text-center ${
                isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-emerald-100 bg-emerald-50/50'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-[#2F9B45]/10 border border-[#2F9B45]/20 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-6 h-6 text-[#2F9B45]" />
              </div>
              <h1
                id="recovery-page-title"
                className="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
              >
                Recuperação de Senha
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Solicite um código à Coordenação Geral ou redefina usando o código recebido.
              </p>
            </div>

            {resetDone ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#2F9B45] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Senha redefinida com sucesso!
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Entre agora com o login <span className="font-mono font-bold">@{identifier}</span> e sua nova senha.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onBackToLogin(identifier.trim().toLowerCase())}
                  className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] text-white text-xs font-bold shadow-sm transition"
                >
                  Ir para o Login
                </button>
              </div>
            ) : (
              <div className="p-5 sm:p-6 space-y-5">
                {/* Alternador de Etapa */}
                <div
                  role="tablist"
                  aria-label="Etapas de recuperação de senha"
                  className={`grid grid-cols-2 gap-1 p-1 rounded-2xl border ${
                    isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={step === 'request'}
                    onClick={() => {
                      setStep('request');
                      setErrorMessage(null);
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      step === 'request'
                        ? isDark
                          ? 'bg-[#2F9B45] text-white shadow-xs'
                          : 'bg-white text-[#1B7A32] shadow-xs'
                        : 'text-slate-500 dark:text-zinc-400'
                    }`}
                  >
                    1. Solicitar Código
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={step === 'confirm'}
                    onClick={() => {
                      setStep('confirm');
                      setErrorMessage(null);
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      step === 'confirm'
                        ? isDark
                          ? 'bg-[#2F9B45] text-white shadow-xs'
                          : 'bg-white text-[#1B7A32] shadow-xs'
                        : 'text-slate-500 dark:text-zinc-400'
                    }`}
                  >
                    2. Já Tenho Código
                  </button>
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs font-medium ${
                      isDark
                        ? 'bg-red-950/50 border-red-800 text-red-200'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {step === 'request' ? (
                  requestSent ? (
                    <div className="space-y-4 text-center py-2">
                      <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#2F9B45] flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          Solicitação registrada!
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                          A Coordenação Geral recebeu seu pedido para <span className="font-semibold">@{identifier}</span>. Assim que receber o código de 6 dígitos, clique abaixo para criar sua nova senha.
                        </p>
                      </div>
                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setStep('confirm');
                            setErrorMessage(null);
                          }}
                          className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] text-white text-xs font-bold transition shadow-sm"
                        >
                          Informar Código de 6 Dígitos
                        </button>
                        <button
                          type="button"
                          onClick={() => onBackToLogin()}
                          className="w-full min-h-[44px] px-4 py-2 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 transition"
                        >
                          Voltar ao Login
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestSubmit} noValidate className="space-y-4">
                      <div>
                        <label
                          htmlFor="recovery-identifier"
                          className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-zinc-300"
                        >
                          Login ou E-mail
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="recovery-identifier"
                            type="text"
                            autoComplete="username"
                            value={identifier}
                            onChange={(e) => {
                              setIdentifier(e.target.value);
                              if (errorMessage) setErrorMessage(null);
                            }}
                            placeholder="Ex: louvor, midia ou seu e-mail"
                            className={`w-full min-h-[48px] pl-10 pr-4 py-2.5 text-sm rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                              isDark
                                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-[#2F9B45]'
                                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#2F9B45]'
                            }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="recovery-contact"
                          className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-zinc-300"
                        >
                          WhatsApp ou Observação (Opcional)
                        </label>
                        <input
                          id="recovery-contact"
                          type="text"
                          value={contactNote}
                          onChange={(e) => setContactNote(e.target.value)}
                          placeholder="Ex: Enviar código para (11) 99999-8888"
                          className={`w-full min-h-[48px] px-3.5 py-2.5 text-sm rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                            isDark
                              ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-[#2F9B45]'
                              : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#2F9B45]'
                          }`}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-[#2F9B45]/20 flex items-center justify-center gap-2 transition"
                      >
                        <Send className="w-4 h-4 text-[#F7B13D]" />
                        <span>{isSubmitting ? 'Enviando...' : 'Solicitar Código de Acesso'}</span>
                      </button>
                    </form>
                  )
                ) : (
                  <form onSubmit={handleConfirmSubmit} noValidate className="space-y-4">
                    <div>
                      <label
                        htmlFor="confirm-recovery-identifier"
                        className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-zinc-300"
                      >
                        Login ou E-mail
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="confirm-recovery-identifier"
                          type="text"
                          autoComplete="username"
                          value={identifier}
                          onChange={(e) => {
                            setIdentifier(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          placeholder="Ex: louvor"
                          className={`w-full min-h-[48px] pl-10 pr-4 py-2.5 text-sm rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                            isDark
                              ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-[#2F9B45]'
                              : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#2F9B45]'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="recovery-code"
                        className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-zinc-300"
                      >
                        Código de 6 Dígitos
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="recovery-code"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={code}
                          onChange={(e) => {
                            setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                            if (errorMessage) setErrorMessage(null);
                          }}
                          placeholder="000000"
                          className={`w-full min-h-[48px] pl-10 pr-4 py-2.5 text-base font-mono tracking-[0.25em] rounded-xl border outline-none font-bold focus:ring-2 focus:ring-[#2F9B45]/30 ${
                            isDark
                              ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-[#2F9B45]'
                              : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#2F9B45]'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="recovery-new-password"
                        className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-zinc-300"
                      >
                        Nova Senha (mín. 6 caracteres)
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="recovery-new-password"
                          type={showPasswords ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          placeholder="Digite a nova senha"
                          className={`w-full min-h-[48px] pl-10 pr-12 py-2.5 text-sm rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                            isDark
                              ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-[#2F9B45]'
                              : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#2F9B45]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords((prev) => !prev)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition"
                          aria-label={showPasswords ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="recovery-confirm-password"
                        className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-zinc-300"
                      >
                        Confirmar Nova Senha
                      </label>
                      <input
                        id="recovery-confirm-password"
                        type={showPasswords ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Repita a nova senha"
                        className={`w-full min-h-[48px] px-3.5 py-2.5 text-sm rounded-xl border outline-none font-medium focus:ring-2 focus:ring-[#2F9B45]/30 ${
                          isDark
                            ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-[#2F9B45]'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#2F9B45]'
                        }`}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-[#2F9B45]/20 flex items-center justify-center gap-2 transition"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#F7B13D]" />
                      <span>{isSubmitting ? 'Salvando...' : 'Redefinir Minha Senha'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
