import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { getDefaultLeaderPresets, validateLoginCredentials } from '../utils/authRules';
import { PasswordRecoveryView } from './PasswordRecoveryView';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  CalendarDays,
  CheckCircle2,
  FileDown,
  AlertCircle,
  Sun,
  Moon,
  ShieldCheck
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { churchName, isDark, toggleTheme } = useApp();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPresetLogin, setSelectedPresetLogin] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const presets = getDefaultLeaderPresets();

  if (isRecoveryMode) {
    return (
      <PasswordRecoveryView
        initialIdentifier={identifier}
        onBackToLogin={(prefill) => {
          if (prefill) {
            setIdentifier(prefill);
            setPassword('');
          }
          setIsRecoveryMode(false);
          setErrorMessage(null);
        }}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationError = validateLoginCredentials(identifier, password);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    const result = await login(identifier, password, rememberMe);
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error || 'Login ou senha inválidos.');
    }
  };

  const handleSelectDepartment = (presetLogin: string) => {
    setIdentifier(presetLogin);
    setPassword('');
    setSelectedPresetLogin(presetLogin);
    setErrorMessage(null);
    requestAnimationFrame(() => {
      passwordInputRef.current?.focus();
    });
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col lg:grid lg:grid-cols-12 transition-colors font-sans antialiased ${
        isDark ? 'dark bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Left Institutional Showcase Panel (Desktop) */}
      <aside className="hidden lg:flex lg:col-span-6 relative overflow-hidden bg-gradient-to-br from-[#134E24] via-[#1B7A32] to-[#248E3B] text-white p-12 xl:p-16 flex-col justify-between">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_top_right,#F7B13D,transparent_55%)]" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white p-2 shadow-lg flex items-center justify-center shrink-0">
            <img
              src="/assets/aistudio/image_533f3802.png"
              alt="AD Brasil Logotipo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#F7B13D]">
              AD Brasil • Escala Fácil
            </p>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {churchName}
            </h2>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-6 my-auto py-8">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#F7B13D]">
              Portal Ministerial
            </p>
            <h1 className="text-4xl xl:text-[42px] font-bold leading-tight tracking-tight text-balance">
              Acesso exclusivo para líderes de departamentos
            </h1>
            <p className="text-base text-emerald-100/90 leading-relaxed">
              Organize os cultos do mês, escale os voluntários do seu ministério, confirme presenças e compartilhe as escalas oficiais com sua equipe.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/15">
            <div className="flex items-start gap-3">
              <CalendarDays className="w-5 h-5 text-[#F7B13D] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">Calendário Mensal & Escalas</h3>
                <p className="text-xs text-emerald-100/80 mt-0.5">
                  Visualize todos os cultos do mês e evite conflitos de voluntários entre departamentos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#F7B13D] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">Chamada de Presença por Ministério</h3>
                <p className="text-xs text-emerald-100/80 mt-0.5">
                  Cada líder acompanha sua equipe e registra a assiduidade em segundos pelo celular.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileDown className="w-5 h-5 text-[#F7B13D] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">Exportação em PDF e WhatsApp</h3>
                <p className="text-xs text-emerald-100/80 mt-0.5">
                  Gere documentos formatados com o logotipo da AD Brasil ou envie direto nos grupos.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-emerald-100/75 border-t border-white/15 pt-5">
          <span>Gestão Ministerial Integrada</span>
          <span>Acesso protegido por login e senha</span>
        </div>
      </aside>

      {/* Right Login Form Surface */}
      <main className="flex-1 lg:col-span-6 flex flex-col justify-between p-4 sm:p-8 lg:p-12">
        {/* Top Bar with Mobile Branding & Theme Toggle */}
        <div className="flex items-center justify-between gap-3 w-full max-w-md mx-auto lg:max-w-lg">
          <div className="flex items-center gap-2.5 lg:hidden min-w-0">
            <div className="h-10 w-10 rounded-xl bg-white p-1.5 border border-emerald-200 shadow-xs flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/image_533f3802.png"
                alt="AD Brasil Logotipo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2F9B45] dark:text-[#42bb5b] truncate">
                AD Brasil • Escala Fácil
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {churchName}
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-[#2F9B45]" />
            <span>Área restrita aos líderes cadastrados</span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:border-[#2F9B45]/50 transition shrink-0"
            aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={isDark ? 'Tema Claro' : 'Tema Escuro'}
          >
            {isDark ? <Sun className="w-4 h-4 text-[#F7B13D]" /> : <Moon className="w-4 h-4 text-[#2F9B45]" />}
          </button>
        </div>

        {/* Center Login Card */}
        <div className="w-full max-w-md mx-auto my-6 lg:my-auto">
          <div
            className={`p-6 sm:p-8 rounded-3xl border shadow-sm transition-colors ${
              isDark
                ? 'bg-zinc-900 border-zinc-800'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Entrar no Escala Fácil
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                Digite seu login e senha de líder de departamento para acessar.
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className={`mb-5 p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs font-medium ${
                  isDark
                    ? 'bg-red-950/50 border-red-800 text-red-200'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-zinc-300"
                >
                  Login ou E-mail
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-identifier"
                    name="login"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => {
                      const next = e.target.value;
                      setIdentifier(next);
                      setSelectedPresetLogin(
                        presets.find((p) => p.login === next.trim().toLowerCase())?.login ?? null
                      );
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Digite seu login ou e-mail"
                    className={`w-full min-h-[48px] pl-10 pr-4 py-2.5 text-sm rounded-xl border outline-none font-medium transition focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-[#2F9B45]'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#2F9B45]'
                    }`}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-zinc-300"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={passwordInputRef}
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Digite sua senha"
                    className={`w-full min-h-[48px] pl-10 pr-12 py-2.5 text-sm rounded-xl border outline-none font-medium transition focus:ring-2 focus:ring-[#2F9B45]/30 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-[#2F9B45]'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#2F9B45]'
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

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer select-none text-xs font-medium text-slate-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#2F9B45] focus:ring-[#2F9B45]"
                  />
                  <span>Manter conectado neste aparelho</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsRecoveryMode(true)}
                  className="min-h-[44px] px-1 text-xs font-bold text-[#2F9B45] dark:text-[#42bb5b] hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#2F9B45] hover:bg-[#258239] disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-[#2F9B45]/20 flex items-center justify-center gap-2 transition active:scale-[0.99]"
              >
                <LogIn className="w-4 h-4 text-[#F7B13D]" />
                <span>{isSubmitting ? 'Validando acesso...' : 'Acessar Escalas'}</span>
              </button>
            </form>

            {/* Department Selection Buttons (titles only, no credentials exposed) */}
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                  Acessos por Departamento
                </p>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap shrink-0">
                  Selecione o título
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => {
                  const isSelected = selectedPresetLogin === preset.login;
                  return (
                    <button
                      key={preset.login}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectDepartment(preset.login)}
                      className={`min-h-[46px] px-3 py-2.5 rounded-xl border text-center flex items-center justify-center transition active:scale-[0.98] ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-[#2F9B45] text-[#1B7A32] dark:text-[#42bb5b] ring-1 ring-[#2F9B45]/25'
                          : isDark
                          ? 'bg-zinc-800/70 border-zinc-700/80 text-zinc-200 hover:border-zinc-600'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#2F9B45]/50'
                      }`}
                    >
                      <span className="text-xs font-bold leading-snug line-clamp-2">
                        {preset.departmentLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 dark:text-zinc-500 max-w-md mx-auto">
          Caso esqueça sua senha, solicite a redefinição à Coordenação Geral.
        </p>
      </main>
    </div>
  );
};
