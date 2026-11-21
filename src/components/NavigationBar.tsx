import React, { useEffect, useRef } from 'react';
import { useApp, TabType } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  getScopedMembers,
  getScopedMinistries,
  scopeSchedulesForUser
} from '../utils/authRules';
import {
  LayoutDashboard,
  CalendarDays,
  Church,
  Users2,
  UserCheck,
  BarChart3
} from 'lucide-react';

interface TabItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

export const NavigationBar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isDark,
    schedules,
    members,
    ministries,
    unreadNotificationCount
  } = useApp();
  const { user } = useAuth();
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  const scopedMinistries = getScopedMinistries(ministries, user);
  const scopedMembers = getScopedMembers(members, user);
  const scopedSchedules = scopeSchedulesForUser(schedules, user);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest'
    });
  }, [activeTab]);

  const tabs: TabItem[] = [
    {
      id: 'dashboard',
      label: 'Início',
      icon: LayoutDashboard,
      badgeCount: unreadNotificationCount > 0 ? unreadNotificationCount : undefined
    },
    {
      id: 'schedules',
      label: 'Escalas',
      icon: CalendarDays,
      badgeCount: scopedSchedules.length
    },
    {
      id: 'services',
      label: 'Cultos',
      icon: Church
    },
    {
      id: 'ministries',
      label: 'Departamentos',
      icon: Users2,
      badgeCount: scopedMinistries.length
    },
    {
      id: 'members',
      label: 'Voluntários',
      icon: UserCheck,
      badgeCount: scopedMembers.length
    },
    {
      id: 'attendance',
      label: 'Relatórios',
      icon: BarChart3
    }
  ];

  return (
    <nav
      className={`w-full select-none transition-colors duration-200 ${
        isDark ? 'bg-zinc-900/95 text-zinc-300' : 'bg-white/95 text-slate-600'
      }`}
      role="navigation"
      aria-label="Barra de Funções"
    >
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar snap-x px-3 py-1.5 min-h-[48px]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              ref={isActive ? activeButtonRef : null}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`snap-start min-h-[38px] px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0 transition-all active:scale-95 touch-manipulation border ${
                isActive
                  ? 'bg-[#2F9B45] border-[#2F9B45] text-white font-bold shadow-xs'
                  : isDark
                    ? 'bg-zinc-800/80 border-zinc-700/80 text-zinc-300 font-semibold hover:border-[#2F9B45]/60 hover:text-white'
                    : 'bg-slate-50 border-slate-200/90 text-slate-700 font-semibold hover:border-emerald-300 hover:text-[#1B7A32]'
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 shrink-0 ${
                  isActive ? 'text-[#F7B13D]' : 'text-[#2F9B45] dark:text-[#42bb5b]'
                }`}
              />
              <span>{tab.label}</span>
              {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
                <span
                  className={`text-[10px] font-extrabold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center tabular-nums ${
                    isActive
                      ? 'bg-[#F7B13D] text-[#6d3e00]'
                      : isDark
                        ? 'bg-zinc-700 text-zinc-200'
                        : 'bg-emerald-100 text-[#1B7A32]'
                  }`}
                >
                  {tab.badgeCount > 99 ? '99+' : tab.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
