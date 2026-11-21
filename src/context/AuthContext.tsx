import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  CreateLeaderPayload,
  LeaderUser,
  PasswordResetRequest,
  UpdateLeaderPayload
} from '../types';
import { apiFetch, clearStoredAuthToken, storeAuthToken } from '../utils/apiClient';

interface AuthContextType {
  user: LeaderUser | null;
  isAuthLoading: boolean;
  leaders: LeaderUser[];
  isLeadersLoading: boolean;
  recoveryRequests: PasswordResetRequest[];
  login: (
    identifier: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  requestPasswordRecovery: (
    identifier: string,
    contactNote?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  confirmPasswordRecovery: (params: {
    identifier: string;
    code: string;
    newPassword: string;
  }) => Promise<{ ok: boolean; login?: string; error?: string }>;
  fetchRecoveryRequests: () => Promise<void>;
  issueRecoveryCode: (
    leaderId: string
  ) => Promise<{ ok: boolean; code?: string; error?: string }>;
  fetchLeaders: () => Promise<void>;
  createLeader: (payload: CreateLeaderPayload) => Promise<{ ok: boolean; error?: string }>;
  updateLeader: (id: string, payload: UpdateLeaderPayload) => Promise<{ ok: boolean; error?: string }>;
  deleteLeader: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<LeaderUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [leaders, setLeaders] = useState<LeaderUser[]>([]);
  const [isLeadersLoading, setIsLeadersLoading] = useState<boolean>(false);
  const [recoveryRequests, setRecoveryRequests] = useState<PasswordResetRequest[]>([]);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const res = await apiFetch('/api/auth/session');
        if (res.ok) {
          const data = (await res.json()) as { authenticated?: boolean; user: LeaderUser | null };
          if (active && data.user) {
            setUser(data.user);
          } else if (!data.user) {
            clearStoredAuthToken();
          }
        } else {
          clearStoredAuthToken();
        }
      } catch {
        // Server unreachable or not authenticated
      } finally {
        if (active) setIsAuthLoading(false);
      }
    };
    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const fetchLeaders = useCallback(async () => {
    setIsLeadersLoading(true);
    try {
      const res = await apiFetch('/api/leaders');
      if (res.ok) {
        const data = (await res.json()) as { leaders: LeaderUser[] };
        setLeaders(data.leaders || []);
      }
    } finally {
      setIsLeadersLoading(false);
    }
  }, []);

  const fetchRecoveryRequests = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/recovery/requests');
      if (res.ok) {
        const data = (await res.json()) as { requests?: PasswordResetRequest[] };
        setRecoveryRequests(data.requests || []);
      }
    } catch {
      // ignore network error
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchLeaders();
      fetchRecoveryRequests();
    } else {
      setLeaders([]);
      setRecoveryRequests([]);
    }
  }, [user, fetchLeaders, fetchRecoveryRequests]);

  const login = useCallback(
    async (
      identifier: string,
      password: string,
      rememberMe: boolean = true
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ login: identifier, password, rememberMe })
        });
        const data = (await res.json()) as { user?: LeaderUser; token?: string; error?: string };
        if (!res.ok || !data.user || !data.token) {
          return { ok: false, error: data.error || 'Não foi possível validar o acesso.' };
        }
        storeAuthToken(data.token, rememberMe);
        setUser(data.user);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Erro de conexão com o servidor de autenticação.' };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network failure on logout
    }
    clearStoredAuthToken();
    setUser(null);
    setLeaders([]);
    setRecoveryRequests([]);
  }, []);

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await apiFetch('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) {
          return { ok: false, error: data.error || 'Não foi possível alterar a senha.' };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Erro ao conectar com o servidor.' };
      }
    },
    []
  );

  const requestPasswordRecovery = useCallback(
    async (
      identifier: string,
      contactNote: string = ''
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await apiFetch('/api/auth/recovery/request', {
          method: 'POST',
          body: JSON.stringify({ identifier, contactNote })
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) {
          return { ok: false, error: data.error || 'Não foi possível registrar a solicitação.' };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Erro ao conectar com o servidor.' };
      }
    },
    []
  );

  const confirmPasswordRecovery = useCallback(
    async (params: {
      identifier: string;
      code: string;
      newPassword: string;
    }): Promise<{ ok: boolean; login?: string; error?: string }> => {
      try {
        const res = await apiFetch('/api/auth/recovery/confirm', {
          method: 'POST',
          body: JSON.stringify(params)
        });
        const data = (await res.json()) as { ok?: boolean; login?: string; error?: string };
        if (!res.ok) {
          return { ok: false, error: data.error || 'Não foi possível redefinir a senha.' };
        }
        return { ok: true, login: data.login };
      } catch {
        return { ok: false, error: 'Erro ao conectar com o servidor.' };
      }
    },
    []
  );

  const issueRecoveryCode = useCallback(
    async (leaderId: string): Promise<{ ok: boolean; code?: string; error?: string }> => {
      try {
        const res = await apiFetch('/api/auth/recovery/issue-code', {
          method: 'POST',
          body: JSON.stringify({ leaderId })
        });
        const data = (await res.json()) as {
          ok?: boolean;
          code?: string;
          request?: PasswordResetRequest;
          error?: string;
        };
        if (!res.ok || !data.code) {
          return { ok: false, error: data.error || 'Não foi possível gerar o código.' };
        }
        await fetchRecoveryRequests();
        return { ok: true, code: data.code };
      } catch {
        return { ok: false, error: 'Erro ao conectar com o servidor.' };
      }
    },
    [fetchRecoveryRequests]
  );

  const createLeader = useCallback(
    async (payload: CreateLeaderPayload): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await apiFetch('/api/leaders', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        const data = (await res.json()) as { leader?: LeaderUser; error?: string };
        if (!res.ok || !data.leader) {
          return { ok: false, error: data.error || 'Erro ao criar acesso do líder.' };
        }
        setLeaders((prev) => [...prev, data.leader!]);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Erro ao conectar com o servidor.' };
      }
    },
    []
  );

  const updateLeader = useCallback(
    async (id: string, payload: UpdateLeaderPayload): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await apiFetch(`/api/leaders/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        const data = (await res.json()) as { leader?: LeaderUser; error?: string };
        if (!res.ok || !data.leader) {
          return { ok: false, error: data.error || 'Erro ao atualizar acesso.' };
        }
        setLeaders((prev) => prev.map((l) => (l.id === id ? data.leader! : l)));
        setUser((prev) => (prev && prev.id === id ? data.leader! : prev));
        return { ok: true };
      } catch {
        return { ok: false, error: 'Erro ao conectar com o servidor.' };
      }
    },
    []
  );

  const deleteLeader = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await apiFetch(`/api/leaders/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        return { ok: false, error: data.error || 'Erro ao excluir acesso.' };
      }
      setLeaders((prev) => prev.filter((l) => l.id !== id));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erro ao conectar com o servidor.' };
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthLoading,
      leaders,
      isLeadersLoading,
      recoveryRequests,
      login,
      logout,
      changePassword,
      requestPasswordRecovery,
      confirmPasswordRecovery,
      fetchRecoveryRequests,
      issueRecoveryCode,
      fetchLeaders,
      createLeader,
      updateLeader,
      deleteLeader
    }),
    [
      user,
      isAuthLoading,
      leaders,
      isLeadersLoading,
      recoveryRequests,
      login,
      logout,
      changePassword,
      requestPasswordRecovery,
      confirmPasswordRecovery,
      fetchRecoveryRequests,
      issueRecoveryCode,
      fetchLeaders,
      createLeader,
      updateLeader,
      deleteLeader
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
