import React, { useState, useRef, useEffect } from 'react';
import { useApp, TabType } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  canManageLeaderAccounts,
  canManageServicesAndMinistries,
  getScopedMembers,
  getScopedMinistries,
  scopeSchedulesForUser
} from '../utils/authRules';
import {
  Sun,
  Moon,
  Cloud,
  Search,
  X,
  Church,
  Edit2,
  Check,
  CheckCheck,
  Share2,
  LayoutDashboard,
  CalendarDays,
  Users2,
  UserCheck,
  BarChart3,
  Globe,
  KeyRound,
  LogOut,
  Shield,
  ChevronDown,
  Bell
} from 'lucide-react';
import { formatRelativeNotificationTimePtBr } from '../utils/dashboardMetrics';
import { LeaderNotification } from '../types';
import { NavigationBar } from './NavigationBar';

export const TopAppBar: React.FC = () => {
  const {
    isDark,
    toggleTheme,
    churchName,
    setChurchName,
    activeTab,
    setActiveTab,
    setAttendanceSubTab,
    setSelectedScheduleId,
    searchQuery,
    setSearchQuery,
    isSyncing,
    lastSyncedTime,
    syncWithCloud,
    showSnackbar,
    schedules,
    members,
    ministries,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead
  } = useApp();

  const { user, logout } = useAuth();

  const [isSearching, setIsSearching] = useState(false);
  const [isEditingChurch, setIsEditingChurch] = useState(false);
  const [tempChurchName, setTempChurchName] = useState(churchName);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsAccountMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
    };
    if (isAccountMenuOpen || isNotificationsOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isAccountMenuOpen, isNotificationsOpen]);

  const userMinistry = user?.ministryId
    ? ministries.find((m) => m.id === user.ministryId)
    : null;
  const userDepartmentLabel =
    user?.role === 'admin'
      ? 'Coordenação Geral'
      : userMinistry?.name || user?.cargo || 'Líder';
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'AD';

  const handleSaveChurchName = () => {
    if (tempChurchName.trim()) {
      setChurchName(tempChurchName.trim());
    }
    setIsEditingChurch(false);
  };

  const handleShareApp = async () => {
    const currentUrl = window.location.href;
    const shareData = {
      title: `${churchName} - Escala Fácil`,
      text: `Acesse as escalas de voluntários e cultos da ${churchName} online:`,
      url: currentUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        showSnackbar('Link compartilhado com sucesso!');
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(currentUrl);
      showSnackbar('Link do aplicativo web copiado! Envie no WhatsApp dos voluntários.');
    } catch {
      showSnackbar(`Link do App: ${currentUrl}`);
    }
  };

  const scopedMinistries = getScopedMinistries(ministries, user);
  const scopedMembers = getScopedMembers(members, user);
  const scopedSchedules = scopeSchedulesForUser(schedules, user);
  const canEditChurchName = canManageServicesAndMinistries(user);

  const handleNotificationItemClick = async (item: LeaderNotification) => {
    setIsNotificationsOpen(false);
    if (user && !item.readBy.includes(user.id)) {
      await markNotificationRead(item.id);
    }
    if (item.targetTab === 'schedules' && item.targetId) {
      setSelectedScheduleId(item.targetId);
    }
    setActiveTab(item.targetTab || 'dashboard');
  };

  const navItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'schedules', label: 'Escalas', icon: CalendarDays, count: scopedSchedules.length },
    { id: 'services', label: 'Cultos', icon: Church },
    { id: 'ministries', label: 'Ministérios', icon: Users2, count: scopedMinistries.length },
    { id: 'members', label: 'Voluntários', icon: UserCheck, count: scopedMembers.length },
    { id: 'attendance', label: 'Relatórios', icon: BarChart3 }
  ];

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-colors duration-200 border-b backdrop-blur-md ${
        isDark
          ? 'bg-zinc-900/95 border-zinc-800 text-zinc-100'
          : 'bg-white/95 border-emerald-100 text-slate-800 shadow-xs'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between gap-2 sm:gap-4 min-h-[48px] sm:min-h-[56px]">
        {/* Left: Church branding with AD Brasil Logo or Search Input */}
        {isSearching ? (
          <div className="flex-1 flex items-center gap-2 max-w-lg">
            <Search className="w-4 h-4 text-[#2F9B45] shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Buscar escalas, voluntários, cultos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full min-h-[40px] text-sm px-3 py-1.5 rounded-xl outline-none transition-colors border ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-400'
                  : 'bg-slate-100 border-slate-300 text-slate-900 focus:border-[#2F9B45]'
              }`}
            />
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearching(false);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
              aria-label="Fechar busca"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 lg:min-w-[220px] overflow-hidden">
            {/* AD Brasil Logo Image */}
            <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl bg-white p-1 flex items-center justify-center shrink-0 shadow-xs border border-emerald-100 dark:border-zinc-700">
              <img
                src="/assets/aistudio/image_533f3802.png"
                alt="AD Brasil Logotipo"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-[11px] uppercase font-extrabold tracking-wider text-[#2F9B45] dark:text-[#42bb5b] flex items-center gap-1 whitespace-nowrap truncate">
                  <Globe className="w-3 h-3 text-[#F7B13D] shrink-0" />
                  <span className="truncate">AD Brasil • Escala Fácil</span>
                </span>
              </div>

              {isEditingChurch && canEditChurchName ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="text"
                    value={tempChurchName}
                    onChange={(e) => setTempChurchName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveChurchName()}
                    className="text-xs font-semibold px-2 py-0.5 rounded border border-[#2F9B45] bg-transparent w-full max-w-[200px]"
                    autoFocus
                  />
                  <button onClick={handleSaveChurchName} className="p-0.5 text-[#2F9B45] shrink-0" aria-label="Confirmar">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : canEditChurchName ? (
                <button
                  onClick={() => {
                    setTempChurchName(churchName);
                    setIsEditingChurch(true);
                  }}
                  className="flex items-center gap-1 text-sm sm:text-base font-bold max-w-full hover:opacity-80 text-left"
                  title="Clique para editar o nome da congregação"
                >
                  <span className="truncate">{churchName}</span>
                  <Edit2 className="w-3 h-3 opacity-60 shrink-0 text-[#F7B13D]" />
                </button>
              ) : (
                <p className="text-sm sm:text-base font-bold max-w-full truncate">
                  {churchName}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Center Desktop Navigation Tabs */}
        {!isSearching && (
          <nav className="hidden lg:flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-2xl text-xs font-semibold border border-slate-200/60 dark:border-zinc-700/60">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-xl transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? isDark
                        ? 'bg-[#2F9B45] text-white shadow-xs'
                        : 'bg-white text-[#1B7A32] shadow-sm font-bold border border-emerald-100'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-[#2F9B45]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#F7B13D]' : ''}`} />
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums ${
                        isActive
                          ? 'bg-[#F7B13D] text-[#6d3e00]'
                          : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right Action Controls: Clean on mobile (Search + Account), Full quick actions on sm+ */}
        {!isSearching && (
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Desktop/Tablet Quick Share Web App Link */}
            <button
              onClick={handleShareApp}
              className="hidden sm:flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl font-bold text-xs bg-[#2F9B45]/10 text-[#2F9B45] dark:text-[#42bb5b] hover:bg-[#2F9B45] hover:text-white transition shadow-xs border border-[#2F9B45]/20 whitespace-nowrap shrink-0"
              title="Copiar ou compartilhar link do Web App para voluntários"
              aria-label="Compartilhar App"
            >
              <Share2 className="w-3.5 h-3.5 text-[#F7B13D]" />
              <span className="hidden 2xl:inline">Compartilhar App</span>
            </button>

            {/* Search (44x44 touch target on mobile) */}
            <button
              onClick={() => setIsSearching(true)}
              className={`min-h-[44px] min-w-[44px] sm:min-h-[38px] sm:min-w-[38px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${
                searchQuery
                  ? 'text-[#2F9B45] bg-emerald-50 dark:bg-emerald-950/60'
                  : 'text-slate-600 dark:text-zinc-300'
              }`}
              title="Buscar"
              aria-label="Buscar"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications Bell Popover */}
            {user && (
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    setIsNotificationsOpen((prev) => !prev);
                  }}
                  aria-expanded={isNotificationsOpen}
                  aria-haspopup="menu"
                  aria-label="Notificações de cultos e departamentos"
                  title="Notificações de cultos e departamentos"
                  className={`relative min-h-[44px] min-w-[44px] sm:min-h-[38px] sm:min-w-[38px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${
                    isNotificationsOpen
                      ? 'text-[#2F9B45] bg-emerald-50 dark:bg-emerald-950/60'
                      : 'text-slate-600 dark:text-zinc-300'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#F7B13D] text-[#6d3e00] text-[9px] font-extrabold flex items-center justify-center tabular-nums">
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div
                    role="menu"
                    className={`fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-[54px] sm:top-auto sm:mt-2 sm:w-96 rounded-2xl border shadow-xl z-50 overflow-hidden ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div
                      className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${
                        isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-slate-100 bg-slate-50/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          Atualizações Ministeriais
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate tabular-nums">
                          {unreadNotificationCount > 0
                            ? `${unreadNotificationCount} não lida(s) · Cultos e ${userDepartmentLabel}`
                            : `Cultos e ${userDepartmentLabel}`}
                        </p>
                      </div>
                      {unreadNotificationCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markAllNotificationsRead()}
                          className="text-[11px] font-semibold text-[#1B7A32] dark:text-[#42bb5b] hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Ler todas</span>
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
                      {notifications.length > 0 ? (
                        notifications.slice(0, 8).map((item) => {
                          const isRead = item.readBy.includes(user.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="menuitem"
                              onClick={() => void handleNotificationItemClick(item)}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/70 transition flex items-start gap-2.5 ${
                                !isRead
                                  ? isDark
                                    ? 'bg-emerald-950/15'
                                    : 'bg-emerald-50/40'
                                  : ''
                              }`}
                            >
                              <span
                                className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                                  !isRead ? 'bg-[#2F9B45]' : 'bg-transparent'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {item.title}
                                </p>
                                <p className="text-[11px] text-slate-600 dark:text-zinc-300 line-clamp-2 mt-0.5">
                                  {item.message}
                                </p>
                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 tabular-nums">
                                  {formatRelativeNotificationTimePtBr(item.createdAt)} ·{' '}
                                  {item.actorName}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-zinc-400">
                          Nenhuma atualização recente.
                        </div>
                      )}
                    </div>

                    <div
                      className={`px-4 py-2.5 border-t ${
                        isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-100 bg-slate-50/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          setActiveTab('dashboard');
                        }}
                        className="w-full text-center text-xs font-semibold text-[#1B7A32] dark:text-[#42bb5b] hover:underline"
                      >
                        Ver painel completo no Início
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Desktop/Tablet Cloud Sync */}
            <button
              onClick={syncWithCloud}
              disabled={isSyncing}
              className={`hidden sm:flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${
                isSyncing ? 'text-[#2F9B45] animate-pulse' : 'text-slate-600 dark:text-zinc-300'
              }`}
              title={`Sincronização Nuvem. Última: ${lastSyncedTime}`}
              aria-label="Sincronizar dados"
            >
              <Cloud className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#F7B13D]' : ''}`} />
            </button>

            {/* Desktop/Tablet Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="hidden sm:flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 transition-colors"
              title={isDark ? 'Tema Claro' : 'Tema Escuro'}
              aria-label="Alternar tema"
            >
              {isDark ? <Sun className="w-4 h-4 text-[#F7B13D]" /> : <Moon className="w-4 h-4 text-[#2F9B45]" />}
            </button>

            {/* Logged-in Leader Account Menu */}
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                  aria-expanded={isAccountMenuOpen}
                  aria-haspopup="menu"
                  aria-label={`Conta de ${user.name}`}
                  className={`min-h-[44px] sm:min-h-[38px] flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-xl border transition active:scale-95 ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:border-[#2F9B45]'
                      : 'bg-emerald-50/70 border-emerald-200 text-slate-800 hover:border-[#2F9B45]'
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-[#2F9B45] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {userInitials}
                  </span>
                  <span className="hidden xl:block text-left max-w-[110px]">
                    <span className="block text-[11px] font-bold leading-tight truncate">
                      {user.login}
                    </span>
                    <span className="block text-[10px] text-slate-500 dark:text-zinc-400 leading-tight truncate">
                      {userDepartmentLabel}
                    </span>
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                </button>

                {isAccountMenuOpen && (
                  <div
                    role="menu"
                    className={`absolute right-0 mt-2 w-72 sm:w-64 rounded-2xl border shadow-xl z-50 overflow-hidden ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div
                      className={`px-4 py-3 border-b ${
                        isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-slate-100 bg-emerald-50/50'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-[#1B7A32] dark:text-[#42bb5b] font-semibold truncate mt-0.5">
                        @{user.login} · {userDepartmentLabel}
                      </p>
                    </div>

                    <div className="p-1.5 space-y-1">
                      {/* Mobile-only quick actions cleanly tucked inside menu */}
                      <div className="sm:hidden space-y-1 pb-1 mb-1 border-b border-slate-100 dark:border-zinc-800">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            handleShareApp();
                          }}
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-emerald-50 dark:hover:bg-zinc-800 transition"
                        >
                          <Share2 className="w-4 h-4 text-[#2F9B45]" />
                          <span>Compartilhar Link do App</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            syncWithCloud();
                          }}
                          disabled={isSyncing}
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 hover:bg-emerald-50 dark:hover:bg-zinc-800 transition"
                        >
                          <span className="flex items-center gap-2.5">
                            <Cloud className={`w-4 h-4 text-[#2F9B45] ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>Sincronizar Dados</span>
                          </span>
                          <span className="text-[10px] text-slate-400 tabular-nums">{lastSyncedTime}</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            toggleTheme();
                          }}
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-emerald-50 dark:hover:bg-zinc-800 transition"
                        >
                          {isDark ? (
                            <Sun className="w-4 h-4 text-[#F7B13D]" />
                          ) : (
                            <Moon className="w-4 h-4 text-[#2F9B45]" />
                          )}
                          <span>{isDark ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}</span>
                        </button>
                      </div>

                      {canManageLeaderAccounts(user) && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            setActiveTab('attendance');
                            setAttendanceSubTab('leaders');
                          }}
                          className="w-full min-h-[44px] sm:min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-emerald-50 dark:hover:bg-zinc-800 transition"
                        >
                          <Shield className="w-4 h-4 text-[#2F9B45]" />
                          <span>Gerenciar Acessos de Líderes</span>
                        </button>
                      )}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          setActiveTab('password');
                        }}
                        className="w-full min-h-[44px] sm:min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-emerald-50 dark:hover:bg-zinc-800 transition"
                      >
                        <KeyRound className="w-4 h-4 text-[#F7B13D]" />
                        <span>Alterar Minha Senha</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          setIsAccountMenuOpen(false);
                          await logout();
                          showSnackbar('Sessão encerrada com segurança.');
                        }}
                        className="w-full min-h-[44px] sm:min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sair do Aplicativo</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile/Tablet Fixed Top Function Bar */}
      {!isSearching && (
        <div
          className={`lg:hidden border-t ${
            isDark ? 'border-zinc-800/90' : 'border-emerald-100/90'
          }`}
        >
          <NavigationBar />
        </div>
      )}
    </header>
  );
};
