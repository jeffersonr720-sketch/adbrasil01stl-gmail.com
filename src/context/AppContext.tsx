import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { LeaderNotification, Ministry, Member, Service, Schedule } from '../types';
import { getInitialSeedData } from '../utils/rules';
import {
  addQuickMinistryRole,
  applyMinistryRoleChanges,
  RoleDraftItem,
  validateRoleDrafts
} from '../utils/ministryRoles';
import { apiFetch } from '../utils/apiClient';
import { useAuth } from './AuthContext';

export type TabType =
  | 'dashboard'
  | 'schedules'
  | 'services'
  | 'ministries'
  | 'members'
  | 'attendance'
  | 'password';
export type AttendanceSubTab = 'metrics' | 'leaders';

interface AppContextType {
  ministries: Ministry[];
  members: Member[];
  services: Service[];
  schedules: Schedule[];
  isDark: boolean;
  toggleTheme: () => void;
  churchName: string;
  setChurchName: (name: string) => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  closePasswordTab: () => void;
  attendanceSubTab: AttendanceSubTab;
  setAttendanceSubTab: (sub: AttendanceSubTab) => void;
  deviceMode: 'phone' | 'fullscreen';
  setDeviceMode: (mode: 'phone' | 'fullscreen') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedScheduleId: string | null;
  setSelectedScheduleId: (id: string | null) => void;
  isSyncing: boolean;
  lastSyncedTime: string;
  syncWithCloud: () => Promise<void>;
  notifications: LeaderNotification[];
  unreadNotificationCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  snackbarMessage: string | null;
  showSnackbar: (msg: string) => void;
  hideSnackbar: () => void;

  // Actions
  addSchedule: (sch: Omit<Schedule, 'id' | 'createdAt'>) => string;
  updateSchedule: (sch: Schedule) => void;
  deleteSchedule: (id: string) => void;
  toggleAssignmentPresence: (scheduleId: string, ministryId: string, assignmentId: string) => void;
  assignMember: (scheduleId: string, ministryId: string, local: string, memberId: string) => void;
  removeAssignment: (scheduleId: string, ministryId: string, assignmentId: string) => void;

  // Member CRUD
  addMember: (m: Omit<Member, 'id'>) => string;
  updateMember: (m: Member) => void;
  deleteMember: (id: string) => void;

  // Ministry CRUD
  addMinistry: (min: Omit<Ministry, 'id'>) => string;
  updateMinistry: (min: Ministry) => void;
  saveMinistryRoles: (params: {
    ministryId: string;
    drafts: RoleDraftItem[];
    name?: string;
    color?: string;
  }) => boolean;
  addMinistryRole: (ministryId: string, roleName: string) => { ok: boolean; normalizedName?: string };
  deleteMinistry: (id: string) => void;

  // Service CRUD
  addService: (srv: Omit<Service, 'id'>) => string;
  updateService: (srv: Service) => void;
  deleteService: (id: string) => void;

  // Reset
  resetToSampleData: () => void;
}

const THEME_KEY = 'escala_facil_theme';
const DEFAULT_CHURCH_NAME = 'Assembleia de Deus • AD Brasil';

interface AppDataPayload {
  churchName?: string;
  ministries: Ministry[];
  members: Member[];
  services: Service[];
  schedules: Schedule[];
}

function formatCurrentHourMinute(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [data, setData] = useState<{
    ministries: Ministry[];
    members: Member[];
    services: Service[];
    schedules: Schedule[];
  }>(() => getInitialSeedData());

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved !== null) return saved === 'dark';
    } catch {
      // ignore
    }
    return false;
  });

  const [churchName, setChurchNameState] = useState<string>(DEFAULT_CHURCH_NAME);
  const [activeTab, setActiveTabState] = useState<TabType>('dashboard');
  const [previousTab, setPreviousTab] = useState<TabType>('dashboard');
  const [attendanceSubTab, setAttendanceSubTab] = useState<AttendanceSubTab>('metrics');

  const setActiveTab = useCallback(
    (tab: TabType) => {
      if (tab === 'password' && activeTab !== 'password') {
        setPreviousTab(activeTab);
      }
      setActiveTabState(tab);
    },
    [activeTab]
  );

  const closePasswordTab = useCallback(() => {
    setActiveTabState(previousTab !== 'password' ? previousTab : 'dashboard');
  }, [previousTab]);
  const [deviceMode, setDeviceMode] = useState<'phone' | 'fullscreen'>('fullscreen');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Agora');
  const [notifications, setNotifications] = useState<LeaderNotification[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const showSnackbar = useCallback((msg: string) => {
    setSnackbarMessage(msg);
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbarMessage(null);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch('/api/notifications');
      if (!res.ok) return;
      const payload = (await res.json()) as { notifications?: LeaderNotification[] };
      if (Array.isArray(payload.notifications)) {
        setNotifications(payload.notifications);
      }
    } catch {
      // ignore transient polling failure
    }
  }, [user]);

  const unreadNotificationCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter((n) => !n.readBy.includes(user.id)).length;
  }, [notifications, user]);

  const markNotificationRead = useCallback(
    async (id: string) => {
      if (!user) return;
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === id && !item.readBy.includes(user.id)
            ? { ...item, readBy: [...item.readBy, user.id] }
            : item
        )
      );
      try {
        await apiFetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
          method: 'POST'
        });
      } catch {
        // ignore
      }
    },
    [user]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) =>
      prev.map((item) =>
        item.readBy.includes(user.id)
          ? item
          : { ...item, readBy: [...item.readBy, user.id] }
      )
    );
    try {
      await apiFetch('/api/notifications/read-all', {
        method: 'POST'
      });
    } catch {
      // ignore
    }
  }, [user]);

  const loadFromServer = useCallback(async (showSuccessToast: boolean = false) => {
    setIsSyncing(true);
    try {
      const [dataRes, notifRes] = await Promise.all([
        apiFetch('/api/data'),
        apiFetch('/api/notifications').catch(() => null)
      ]);
      if (!dataRes.ok) {
        const err = (await dataRes.json().catch(() => ({}))) as { error?: string };
        if (showSuccessToast) {
          showSnackbar(err.error || 'Não foi possível sincronizar os dados agora.');
        }
        return;
      }
      const payload = (await dataRes.json()) as AppDataPayload;
      setData({
        ministries: payload.ministries || [],
        members: payload.members || [],
        services: payload.services || [],
        schedules: payload.schedules || []
      });
      if (payload.churchName) {
        setChurchNameState(payload.churchName);
      }
      if (notifRes && notifRes.ok) {
        const notifPayload = (await notifRes.json()) as { notifications?: LeaderNotification[] };
        if (Array.isArray(notifPayload.notifications)) {
          setNotifications(notifPayload.notifications);
        }
      }
      setLastSyncedTime(formatCurrentHourMinute());
      if (showSuccessToast) {
        showSnackbar('Dados sincronizados com sucesso!');
      }
    } catch {
      if (showSuccessToast) {
        showSnackbar('Sem conexão com o servidor no momento.');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    if (!user) {
      setSelectedScheduleId(null);
      setData(getInitialSeedData());
      setChurchNameState(DEFAULT_CHURCH_NAME);
      setNotifications([]);
      setActiveTabState('dashboard');
      return;
    }
    loadFromServer(false);
  }, [user, loadFromServer]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      void refreshNotifications();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [user, refreshNotifications]);

  const persistMutation = useCallback(
    async (url: string, options: RequestInit) => {
      try {
        const res = await apiFetch(url, options);
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          showSnackbar(err.error || 'Não foi possível salvar alteração no servidor.');
          await loadFromServer(false);
          return null;
        }
        setLastSyncedTime(formatCurrentHourMinute());
        const json = await res.json().catch(() => ({}));
        void refreshNotifications();
        return json;
      } catch {
        showSnackbar('Falha de conexão ao salvar no servidor.');
        return null;
      }
    },
    [loadFromServer, refreshNotifications, showSnackbar]
  );

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const setChurchName = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      setChurchNameState(clean);
      void persistMutation('/api/settings/church', {
        method: 'PUT',
        body: JSON.stringify({ churchName: clean })
      });
    },
    [persistMutation]
  );

  const syncWithCloud = useCallback(async () => {
    if (!user) return;
    await loadFromServer(true);
  }, [user, loadFromServer]);

  // Schedule Actions
  const addSchedule = useCallback(
    (schData: Omit<Schedule, 'id' | 'createdAt'>): string => {
      const id = `sch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const createdAt = Date.now();
      const newSchedule: Schedule = {
        ...schData,
        id,
        createdAt
      };
      setData((prev) => ({
        ...prev,
        schedules: [newSchedule, ...prev.schedules]
      }));
      showSnackbar('Nova escala criada com sucesso!');
      void persistMutation('/api/schedules', {
        method: 'POST',
        body: JSON.stringify(newSchedule)
      });
      return id;
    },
    [persistMutation, showSnackbar]
  );

  const updateSchedule = useCallback(
    (updated: Schedule) => {
      setData((prev) => ({
        ...prev,
        schedules: prev.schedules.map((s) => (s.id === updated.id ? updated : s))
      }));
      showSnackbar('Escala atualizada!');
      void persistMutation(`/api/schedules/${encodeURIComponent(updated.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updated)
      });
    },
    [persistMutation, showSnackbar]
  );

  const deleteSchedule = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        schedules: prev.schedules.filter((s) => s.id !== id)
      }));
      if (selectedScheduleId === id) {
        setSelectedScheduleId(null);
      }
      showSnackbar('Escala removida.');
      void persistMutation(`/api/schedules/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    },
    [persistMutation, selectedScheduleId, showSnackbar]
  );

  const toggleAssignmentPresence = useCallback(
    (scheduleId: string, ministryId: string, assignmentId: string) => {
      setData((prev) => {
        const schedule = prev.schedules.find((s) => s.id === scheduleId);
        if (!schedule) return prev;

        const currentList = schedule.assignments[ministryId] || [];
        const updatedList = currentList.map((item) =>
          item.id === assignmentId ? { ...item, present: !item.present } : item
        );

        const updatedSchedule: Schedule = {
          ...schedule,
          assignments: {
            ...schedule.assignments,
            [ministryId]: updatedList
          }
        };

        return {
          ...prev,
          schedules: prev.schedules.map((s) => (s.id === scheduleId ? updatedSchedule : s))
        };
      });

      void persistMutation(`/api/schedules/${encodeURIComponent(scheduleId)}/toggle-presence`, {
        method: 'POST',
        body: JSON.stringify({ ministryId, assignmentId })
      });
    },
    [persistMutation]
  );

  const assignMember = useCallback(
    (scheduleId: string, ministryId: string, local: string, memberId: string) => {
      let updatedForServer: Schedule | null = null;
      setData((prev) => {
        const schedule = prev.schedules.find((s) => s.id === scheduleId);
        if (!schedule) return prev;

        const currentList = [...(schedule.assignments[ministryId] || [])];
        const existingIdx = currentList.findIndex((item) => item.local === local);

        if (existingIdx >= 0) {
          currentList[existingIdx] = {
            ...currentList[existingIdx],
            memberId
          };
        } else {
          currentList.push({
            id: `as-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            memberId,
            local,
            present: false
          });
        }

        const updatedSchedule: Schedule = {
          ...schedule,
          assignments: {
            ...schedule.assignments,
            [ministryId]: currentList
          }
        };
        updatedForServer = updatedSchedule;

        return {
          ...prev,
          schedules: prev.schedules.map((s) => (s.id === scheduleId ? updatedSchedule : s))
        };
      });

      if (updatedForServer) {
        const sch: Schedule = updatedForServer;
        void persistMutation(`/api/schedules/${encodeURIComponent(sch.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(sch)
        });
      }
    },
    [persistMutation]
  );

  const removeAssignment = useCallback(
    (scheduleId: string, ministryId: string, assignmentId: string) => {
      let updatedForServer: Schedule | null = null;
      setData((prev) => {
        const schedule = prev.schedules.find((s) => s.id === scheduleId);
        if (!schedule) return prev;

        const currentList = (schedule.assignments[ministryId] || []).filter(
          (item) => item.id !== assignmentId
        );

        const updatedSchedule: Schedule = {
          ...schedule,
          assignments: {
            ...schedule.assignments,
            [ministryId]: currentList
          }
        };
        updatedForServer = updatedSchedule;

        return {
          ...prev,
          schedules: prev.schedules.map((s) => (s.id === scheduleId ? updatedSchedule : s))
        };
      });

      if (updatedForServer) {
        const sch: Schedule = updatedForServer;
        void persistMutation(`/api/schedules/${encodeURIComponent(sch.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(sch)
        });
      }
    },
    [persistMutation]
  );

  // Member CRUD
  const addMember = useCallback(
    (m: Omit<Member, 'id'>): string => {
      const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newMember: Member = { ...m, id };
      setData((prev) => ({
        ...prev,
        members: [...prev.members, newMember]
      }));
      showSnackbar(`Voluntário ${newMember.name} cadastrado!`);
      void persistMutation('/api/members', {
        method: 'POST',
        body: JSON.stringify(newMember)
      });
      return id;
    },
    [persistMutation, showSnackbar]
  );

  const updateMember = useCallback(
    (m: Member) => {
      setData((prev) => ({
        ...prev,
        members: prev.members.map((item) => (item.id === m.id ? m : item))
      }));
      showSnackbar('Dados do voluntário atualizados!');
      void persistMutation(`/api/members/${encodeURIComponent(m.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(m)
      });
    },
    [persistMutation, showSnackbar]
  );

  const deleteMember = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        members: prev.members.filter((item) => item.id !== id)
      }));
      showSnackbar('Voluntário removido.');
      void persistMutation(`/api/members/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    },
    [persistMutation, showSnackbar]
  );

  // Ministry CRUD
  const addMinistry = useCallback(
    (min: Omit<Ministry, 'id'>): string => {
      const id = `min-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newMin: Ministry = { ...min, id };
      setData((prev) => ({
        ...prev,
        ministries: [...prev.ministries, newMin]
      }));
      showSnackbar(`Ministério ${newMin.name} adicionado!`);
      void persistMutation('/api/ministries', {
        method: 'POST',
        body: JSON.stringify(newMin)
      });
      return id;
    },
    [persistMutation, showSnackbar]
  );

  const updateMinistry = useCallback(
    (min: Ministry) => {
      setData((prev) => ({
        ...prev,
        ministries: prev.ministries.map((item) => (item.id === min.id ? min : item))
      }));
      showSnackbar('Ministério atualizado!');
      void persistMutation(`/api/ministries/${encodeURIComponent(min.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(min)
      });
    },
    [persistMutation, showSnackbar]
  );

  const saveMinistryRoles = useCallback(
    (params: {
      ministryId: string;
      drafts: RoleDraftItem[];
      name?: string;
      color?: string;
    }): boolean => {
      const draftError = validateRoleDrafts(params.drafts);
      if (draftError) {
        showSnackbar(draftError);
        return false;
      }

      const target = data.ministries.find((m) => m.id === params.ministryId);
      if (!target) {
        showSnackbar('Departamento não encontrado.');
        return false;
      }

      const { updatedMinistry, updatedMembers, updatedSchedules } = applyMinistryRoleChanges({
        ministry: {
          ...target,
          name: params.name !== undefined ? params.name : target.name,
          color: params.color !== undefined ? params.color : target.color
        },
        drafts: params.drafts,
        members: data.members,
        schedules: data.schedules
      });

      setData((prev) => ({
        ...prev,
        ministries: prev.ministries.map((item) =>
          item.id === params.ministryId ? updatedMinistry : item
        ),
        members: updatedMembers,
        schedules: updatedSchedules
      }));
      showSnackbar(`Postos e funções de ${updatedMinistry.name} salvos!`);
      void persistMutation(`/api/ministries/${encodeURIComponent(params.ministryId)}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({
          drafts: params.drafts,
          name: params.name,
          color: params.color
        })
      });
      return true;
    },
    [data.members, data.ministries, data.schedules, persistMutation, showSnackbar]
  );

  const addMinistryRole = useCallback(
    (ministryId: string, roleName: string): { ok: boolean; normalizedName?: string } => {
      const target = data.ministries.find((m) => m.id === ministryId);
      if (!target) {
        showSnackbar('Departamento não encontrado.');
        return { ok: false };
      }

      const result = addQuickMinistryRole(target, roleName);
      if (result.error || !result.updatedMinistry || !result.normalizedName) {
        showSnackbar(result.error || 'Não foi possível criar o posto.');
        return { ok: false };
      }

      const nextMin = result.updatedMinistry;
      setData((prev) => ({
        ...prev,
        ministries: prev.ministries.map((item) => (item.id === ministryId ? nextMin : item))
      }));
      showSnackbar(`Função "${result.normalizedName}" adicionada em ${target.name}!`);
      void persistMutation(`/api/ministries/${encodeURIComponent(ministryId)}/roles`, {
        method: 'POST',
        body: JSON.stringify({ roleName: result.normalizedName })
      });
      return { ok: true, normalizedName: result.normalizedName };
    },
    [data.ministries, persistMutation, showSnackbar]
  );

  const deleteMinistry = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        ministries: prev.ministries.filter((item) => item.id !== id),
        members: prev.members.filter((item) => item.ministryId !== id)
      }));
      showSnackbar('Ministério removido.');
      void persistMutation(`/api/ministries/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    },
    [persistMutation, showSnackbar]
  );

  // Service CRUD
  const addService = useCallback(
    (srv: Omit<Service, 'id'>): string => {
      const id = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newService: Service = { ...srv, id };
      setData((prev) => ({
        ...prev,
        services: [...prev.services, newService]
      }));
      showSnackbar(`Culto ${newService.label} cadastrado!`);
      void persistMutation('/api/services', {
        method: 'POST',
        body: JSON.stringify(newService)
      });
      return id;
    },
    [persistMutation, showSnackbar]
  );

  const updateService = useCallback(
    (srv: Service) => {
      setData((prev) => ({
        ...prev,
        services: prev.services.map((item) => (item.id === srv.id ? srv : item))
      }));
      showSnackbar('Culto atualizado!');
      void persistMutation(`/api/services/${encodeURIComponent(srv.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(srv)
      });
    },
    [persistMutation, showSnackbar]
  );

  const deleteService = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        services: prev.services.filter((item) => item.id !== id)
      }));
      showSnackbar('Culto removido.');
      void persistMutation(`/api/services/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    },
    [persistMutation, showSnackbar]
  );

  const resetToSampleData = useCallback(() => {
    const initial = getInitialSeedData();
    setData(initial);
    setChurchNameState(DEFAULT_CHURCH_NAME);
    showSnackbar('Dados restaurados para o padrão de demonstração!');
    void persistMutation('/api/data/reset', {
      method: 'POST'
    });
  }, [persistMutation, showSnackbar]);

  const contextValue = useMemo(
    () => ({
      ministries: data.ministries,
      members: data.members,
      services: data.services,
      schedules: data.schedules,
      isDark,
      toggleTheme,
      churchName,
      setChurchName,
      activeTab,
      setActiveTab,
      closePasswordTab,
      attendanceSubTab,
      setAttendanceSubTab,
      deviceMode,
      setDeviceMode,
      searchQuery,
      setSearchQuery,
      selectedScheduleId,
      setSelectedScheduleId,
      isSyncing,
      lastSyncedTime,
      syncWithCloud,
      notifications,
      unreadNotificationCount,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      snackbarMessage,
      showSnackbar,
      hideSnackbar,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      toggleAssignmentPresence,
      assignMember,
      removeAssignment,
      addMember,
      updateMember,
      deleteMember,
      addMinistry,
      updateMinistry,
      saveMinistryRoles,
      addMinistryRole,
      deleteMinistry,
      addService,
      updateService,
      deleteService,
      resetToSampleData
    }),
    [
      data,
      isDark,
      toggleTheme,
      churchName,
      setChurchName,
      activeTab,
      setActiveTab,
      closePasswordTab,
      attendanceSubTab,
      deviceMode,
      searchQuery,
      selectedScheduleId,
      isSyncing,
      lastSyncedTime,
      syncWithCloud,
      notifications,
      unreadNotificationCount,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      snackbarMessage,
      showSnackbar,
      hideSnackbar,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      toggleAssignmentPresence,
      assignMember,
      removeAssignment,
      addMember,
      updateMember,
      deleteMember,
      addMinistry,
      updateMinistry,
      saveMinistryRoles,
      addMinistryRole,
      deleteMinistry,
      addService,
      updateService,
      deleteService,
      resetToSampleData
    ]
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
