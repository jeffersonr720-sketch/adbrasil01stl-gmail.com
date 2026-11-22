import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { LeaderRepository } from './server/leaderRepository.ts';
import { PasswordRecoveryStore } from './server/passwordRecoveryStore.ts';
import { AppDataStore } from './server/appDataStore.ts';
import { NotificationStore } from './server/notificationStore.ts';
import {
  getSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured
} from './server/supabaseClient.ts';
import type {
  CreateLeaderPayload,
  LeaderUser,
  Member,
  Ministry,
  Schedule,
  Service,
  UpdateLeaderPayload
} from './src/types/index.ts';
import type { RoleDraftItem } from './src/utils/ministryRoles.ts';

interface AuthenticatedRequest extends Request {
  authUser?: LeaderUser;
}

const SESSION_COOKIE_NAME = 'escala_session';

function extractCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = pair.slice(0, eqIndex).trim();
    if (key === SESSION_COOKIE_NAME) {
      return decodeURIComponent(pair.slice(eqIndex + 1).trim());
    }
  }
  return null;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return extractCookieToken(req.headers.cookie);
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  const authRepo = new LeaderRepository();
  const recoveryStore = new PasswordRecoveryStore({ leaderRepo: authRepo });
  const appDataStore = new AppDataStore();
  const notificationStore = new NotificationStore();

  const formatBrDate = (dateIso: string): string => {
    const parts = dateIso.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateIso;
  };

  const emitNotificationSafe = async (
    input: Parameters<NotificationStore['createNotification']>[0]
  ) => {
    try {
      await notificationStore.createNotification(input);
    } catch (err) {
      console.warn('Não foi possível registrar notificação:', err);
    }
  };

  app.use(express.json({ limit: '1mb' }));

  const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token = extractToken(req);
      if (!token) {
        res.status(401).json({ error: 'Sessão não autenticada. Faça login para continuar.' });
        return;
      }
      const user = await authRepo.verifyToken(token);
      if (!user) {
        res.status(401).json({ error: 'Sessão expirada ou inválida. Entre novamente.' });
        return;
      }
      req.authUser = user;
      next();
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      res.status(500).json({ error: 'Erro interno ao validar sessão.' });
    }
  };

  const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || req.authUser.role !== 'admin') {
      res.status(403).json({ error: 'Apenas a Coordenação Geral pode gerenciar acessos de líderes.' });
      return;
    }
    next();
  };

  app.get('/api/health', async (req, res) => {
    const supabaseConfigured = isSupabaseConfigured();
    const serviceRoleConfigured = isServiceRoleConfigured();
    const base = {
      ok: true,
      storage: supabaseConfigured ? 'supabase' : 'local',
      serviceRoleConfigured
    };

    if (req.query.deep !== '1') {
      res.json(base);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      res.json({
        ...base,
        connected: false,
        writable: false,
        activeMode: 'local_fallback',
        hint: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nos Segredos (Secrets).',
        tables: []
      });
      return;
    }

    // Limpa cooldown temporário para validar o estado real no Supabase imediatamente
    authRepo.resetSupabaseCooldown();
    appDataStore.resetSupabaseCooldown();
    notificationStore.resetSupabaseCooldown();

    // Garante inicialização padrão antes da checagem de contagem
    await Promise.allSettled([
      authRepo.listLeaders(),
      appDataStore.getFullData(),
      notificationStore.listForUser({
        id: 'health-probe',
        name: 'Probe',
        login: 'probe',
        email: '',
        cargo: '',
        role: 'admin',
        ministryId: null,
        active: true,
        createdAt: 0
      })
    ]);

    const tableNames = [
      'app_settings',
      'ministries',
      'members',
      'services',
      'schedules',
      'leaders',
      'password_resets',
      'notifications'
    ] as const;

    const tables = await Promise.all(
      tableNames.map(async (table) => {
        try {
          const { count, error } = await client
            .from(table)
            .select('id', { count: 'exact', head: true });
          return {
            table,
            ok: !error,
            count: error ? null : (count ?? 0),
            errorCode: error?.code ?? null,
            errorMessage: error?.message ?? null
          };
        } catch (err) {
          return {
            table,
            ok: false,
            count: null,
            errorCode: 'NETWORK_ERROR',
            errorMessage: err instanceof Error ? err.message : 'Erro desconhecido'
          };
        }
      })
    );

    const allTablesExist = tables.every((t) => t.ok);
    const hasNetworkFailure = tables.some(
      (t) =>
        !t.ok &&
        (t.errorCode === 'NETWORK_ERROR' ||
          /fetch failed|enotfound|econnrefused|etimedout|network/i.test(t.errorMessage || ''))
    );
    const hasAuthFailure = tables.some(
      (t) => !t.ok && /invalid api key|jwt|401|403/i.test(t.errorMessage || '')
    );

    const writable = allTablesExist && serviceRoleConfigured;
    const activeMode = writable ? 'supabase' : 'local_fallback';
    let hint: string | undefined;

    if (hasNetworkFailure) {
      hint =
        'Não foi possível alcançar a URL do projeto Supabase (erro de rede/DNS ou projeto pausado/excluído). Verifique SUPABASE_URL nos Segredos.';
    } else if (hasAuthFailure) {
      hint =
        'A chave do Supabase foi recusada (Invalid API key / JWT). Verifique SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY nos Segredos.';
    } else if (!allTablesExist) {
      hint =
        'Uma ou mais tabelas ainda não existem no projeto Supabase. Execute o arquivo supabase/setup_projeto_novo.sql no SQL Editor.';
    } else if (!serviceRoleConfigured) {
      hint =
        'As tabelas existem, mas SUPABASE_SERVICE_ROLE_KEY ainda não está configurada. Como o RLS protege as tabelas, adicione SUPABASE_SERVICE_ROLE_KEY nos Segredos para ativar leitura e gravação reais.';
    }

    let urlHost: string | null = null;
    try {
      urlHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : null;
    } catch {
      urlHost = null;
    }

    res.json({
      ...base,
      urlHost,
      connected: allTablesExist,
      writable,
      activeMode,
      ...(hint ? { hint } : {}),
      tables
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { login, password, rememberMe } = req.body as {
        login?: string;
        password?: string;
        rememberMe?: boolean;
      };
      const result = await authRepo.authenticate(login || '', password || '');
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }

      const maxAgeMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : undefined;
      res.cookie(SESSION_COOKIE_NAME, result.token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        ...(maxAgeMs ? { maxAge: maxAgeMs } : {})
      });

      res.json({ user: result.user, token: result.token });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ error: 'Erro ao autenticar acesso.' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/session', async (req, res) => {
    try {
      const token = extractToken(req);
      if (!token) {
        res.json({ authenticated: false, user: null });
        return;
      }
      const user = await authRepo.verifyToken(token);
      if (!user) {
        res.json({ authenticated: false, user: null });
        return;
      }
      res.json({ authenticated: true, user });
    } catch {
      res.json({ authenticated: false, user: null });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
      };
      const result = await authRepo.changePassword(
        req.authUser!.id,
        currentPassword || '',
        newPassword || ''
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      res.status(500).json({ error: 'Erro ao atualizar senha.' });
    }
  });

  // Public Password Recovery Flow (requested by leader, code issued by Coordenação Geral)
  app.post('/api/auth/recovery/request', async (req, res) => {
    try {
      const { identifier, contactNote } = req.body as {
        identifier?: string;
        contactNote?: string;
      };
      const result = await recoveryStore.requestRecovery({
        identifier: identifier || '',
        contactNote
      });
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      res.status(201).json({ ok: true, request: result.request });
    } catch (error) {
      console.error('Erro ao registrar recuperação de senha:', error);
      res.status(500).json({ error: 'Erro ao solicitar recuperação de senha.' });
    }
  });

  app.post('/api/auth/recovery/confirm', async (req, res) => {
    try {
      const { identifier, code, newPassword } = req.body as {
        identifier?: string;
        code?: string;
        newPassword?: string;
      };
      const result = await recoveryStore.confirmRecoveryReset({
        identifier: identifier || '',
        code: code || '',
        newPassword: newPassword || ''
      });
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      res.json({ ok: true, login: result.login });
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      res.status(500).json({ error: 'Erro ao concluir redefinição de senha.' });
    }
  });

  app.get('/api/auth/recovery/requests', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const requests = await recoveryStore.listActiveRequests();
      res.json({ requests });
    } catch (error) {
      console.error('Erro ao listar pedidos de recuperação:', error);
      res.status(500).json({ error: 'Erro ao listar pedidos de recuperação.' });
    }
  });

  app.post('/api/auth/recovery/issue-code', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { leaderId } = req.body as { leaderId?: string };
      const result = await recoveryStore.issueRecoveryCode(leaderId || '');
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      res.json({ ok: true, code: result.code, request: result.request });
    } catch (error) {
      console.error('Erro ao gerar código de recuperação:', error);
      res.status(500).json({ error: 'Erro ao gerar código de recuperação.' });
    }
  });

  // Admin: Manage Department Leaders
  app.get('/api/leaders', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const leaders = await authRepo.listLeaders();
      res.json({ leaders });
    } catch (error) {
      console.error('Erro ao listar líderes:', error);
      res.status(500).json({ error: 'Erro ao listar líderes.' });
    }
  });

  app.post('/api/leaders', requireAuth, requireAdmin, async (req, res) => {
    try {
      const payload = req.body as CreateLeaderPayload;
      const result = await authRepo.createLeader(payload);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      res.status(201).json({ leader: result.leader });
    } catch (error) {
      console.error('Erro ao criar líder:', error);
      res.status(500).json({ error: 'Erro ao criar acesso de líder.' });
    }
  });

  app.patch('/api/leaders/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const targetId = String(req.params.id);
      const payload = req.body as UpdateLeaderPayload;
      const result = await authRepo.updateLeader(targetId, payload, req.authUser!.id);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      res.json({ leader: result.leader });
    } catch (error) {
      console.error('Erro ao atualizar líder:', error);
      res.status(500).json({ error: 'Erro ao atualizar acesso.' });
    }
  });

  app.delete('/api/leaders/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const targetId = String(req.params.id);
      const result = await authRepo.deleteLeader(targetId, req.authUser!.id);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Erro ao excluir líder:', error);
      res.status(500).json({ error: 'Erro ao excluir acesso.' });
    }
  });

  // Scoped App Domain Data Routes (Supabase or local store)
  app.get('/api/data', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const data = await appDataStore.getDataForUser(req.authUser!);
      res.json(data);
    } catch (error) {
      console.error('Erro ao carregar dados do aplicativo:', error);
      res.status(500).json({ error: 'Erro ao carregar dados sincronizados.' });
    }
  });

  app.put('/api/settings/church', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { churchName } = req.body as { churchName?: string };
      const result = await appDataStore.setChurchName(churchName || '', req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      res.json({ churchName: result.churchName });
    } catch (error) {
      console.error('Erro ao salvar nome da igreja:', error);
      res.status(500).json({ error: 'Erro ao atualizar configuração da igreja.' });
    }
  });

  app.post('/api/ministries', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payload = req.body as Omit<Ministry, 'id'> & { id?: string };
      const result = await appDataStore.addMinistry(payload, req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'ministry',
        ministryId: result.ministry.id,
        title: `Novo departamento: ${result.ministry.name}`,
        message: `Criado com ${result.ministry.locais.length} posto(s)/função(ões).`,
        targetTab: 'ministries',
        targetId: result.ministry.id,
        actorName: req.authUser!.name
      });
      res.status(201).json({ ministry: result.ministry });
    } catch (error) {
      console.error('Erro ao criar departamento:', error);
      res.status(500).json({ error: 'Erro ao criar departamento.' });
    }
  });

  app.patch('/api/ministries/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payload = { ...(req.body as Ministry), id: String(req.params.id) };
      const result = await appDataStore.updateMinistry(payload, req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'ministry',
        ministryId: result.ministry.id,
        title: `Departamento atualizado: ${result.ministry.name}`,
        message: `Configurações e postos de ${result.ministry.name} foram atualizados.`,
        targetTab: 'ministries',
        targetId: result.ministry.id,
        actorName: req.authUser!.name
      });
      res.json({ ministry: result.ministry });
    } catch (error) {
      console.error('Erro ao atualizar departamento:', error);
      res.status(500).json({ error: 'Erro ao atualizar departamento.' });
    }
  });

  app.post('/api/ministries/:id/roles', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ministryId = String(req.params.id);
      const { roleName } = req.body as { roleName?: string };
      const result = await appDataStore.addMinistryRole(ministryId, roleName || '', req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'ministry',
        ministryId: result.ministry.id,
        title: `Nova função em ${result.ministry.name}`,
        message: `Posto "${result.normalizedName}" adicionado ao departamento.`,
        targetTab: 'ministries',
        targetId: result.ministry.id,
        actorName: req.authUser!.name
      });
      res.status(201).json({ ministry: result.ministry, normalizedName: result.normalizedName });
    } catch (error) {
      console.error('Erro ao adicionar posto:', error);
      res.status(500).json({ error: 'Erro ao adicionar posto.' });
    }
  });

  app.patch('/api/ministries/:id/roles', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ministryId = String(req.params.id);
      const { drafts, name, color } = req.body as {
        drafts?: RoleDraftItem[];
        name?: string;
        color?: string;
      };
      const result = await appDataStore.saveMinistryRoles(
        { ministryId, drafts: drafts || [], name, color },
        req.authUser!
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'ministry',
        ministryId: result.ministry.id,
        title: `Postos atualizados em ${result.ministry.name}`,
        message: `${result.ministry.locais.length} função(ões) configurada(s) no departamento.`,
        targetTab: 'ministries',
        targetId: result.ministry.id,
        actorName: req.authUser!.name
      });
      res.json({
        ministry: result.ministry,
        updatedMembers: result.updatedMembers,
        updatedSchedules: result.updatedSchedules
      });
    } catch (error) {
      console.error('Erro ao salvar postos do departamento:', error);
      res.status(500).json({ error: 'Erro ao salvar postos e funções.' });
    }
  });

  app.delete('/api/ministries/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ministryId = String(req.params.id);
      const result = await appDataStore.deleteMinistry(ministryId, req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'ministry',
        ministryId: null,
        title: `Departamento removido`,
        message: `${result.ministryName || 'Departamento'} foi removido da estrutura ministerial.`,
        targetTab: 'ministries',
        actorName: req.authUser!.name
      });
      res.json({ ok: true });
    } catch (error) {
      console.error('Erro ao excluir departamento:', error);
      res.status(500).json({ error: 'Erro ao remover departamento.' });
    }
  });

  app.post('/api/members', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payload = req.body as Omit<Member, 'id'> & { id?: string };
      const result = await appDataStore.addMember(payload, req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'member',
        ministryId: result.member.ministryId,
        title: `Novo voluntário cadastrado`,
        message: `${result.member.name} (${result.member.cargo || 'Voluntário'}) entrou para a equipe.`,
        targetTab: 'members',
        targetId: result.member.id,
        actorName: req.authUser!.name
      });
      res.status(201).json({ member: result.member });
    } catch (error) {
      console.error('Erro ao adicionar voluntário:', error);
      res.status(500).json({ error: 'Erro ao cadastrar voluntário.' });
    }
  });

  app.patch('/api/members/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payload = { ...(req.body as Member), id: String(req.params.id) };
      const result = await appDataStore.updateMember(payload, req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'member',
        ministryId: result.member.ministryId,
        title: `Dados de voluntário atualizados`,
        message: `Cadastro e funções de ${result.member.name} foram atualizados.`,
        targetTab: 'members',
        targetId: result.member.id,
        actorName: req.authUser!.name
      });
      res.json({ member: result.member });
    } catch (error) {
      console.error('Erro ao atualizar voluntário:', error);
      res.status(500).json({ error: 'Erro ao atualizar voluntário.' });
    }
  });

  app.delete('/api/members/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await appDataStore.deleteMember(String(req.params.id), req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      if (result.ministryId) {
        await emitNotificationSafe({
          category: 'member',
          ministryId: result.ministryId,
          title: `Voluntário removido da equipe`,
          message: `${result.memberName || 'Voluntário'} foi removido da lista do departamento.`,
          targetTab: 'members',
          actorName: req.authUser!.name
        });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Erro ao remover voluntário:', error);
      res.status(500).json({ error: 'Erro ao remover voluntário.' });
    }
  });

  app.post('/api/services', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payload = req.body as Omit<Service, 'id'> & { id?: string };
      const result = await appDataStore.addService(payload, req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'service',
        ministryId: null,
        title: `Novo culto cadastrado`,
        message: `"${result.service.label}" foi adicionado à agenda de cultos da igreja.`,
        targetTab: 'services',
        targetId: result.service.id,
        actorName: req.authUser!.name
      });
      res.status(201).json({ service: result.service });
    } catch (error) {
      console.error('Erro ao cadastrar culto:', error);
      res.status(500).json({ error: 'Erro ao cadastrar culto.' });
    }
  });

  app.patch('/api/services/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payload = { ...(req.body as Service), id: String(req.params.id) };
      const result = await appDataStore.updateService(payload, req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'service',
        ministryId: null,
        title: `Culto atualizado`,
        message: `Programação de "${result.service.label}" foi atualizada.`,
        targetTab: 'services',
        targetId: result.service.id,
        actorName: req.authUser!.name
      });
      res.json({ service: result.service });
    } catch (error) {
      console.error('Erro ao atualizar culto:', error);
      res.status(500).json({ error: 'Erro ao atualizar culto.' });
    }
  });

  app.delete('/api/services/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await appDataStore.deleteService(String(req.params.id), req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'service',
        ministryId: null,
        title: `Culto removido da agenda`,
        message: `"${result.serviceLabel || 'Culto'}" foi removido da programação regular.`,
        targetTab: 'services',
        actorName: req.authUser!.name
      });
      res.json({ ok: true });
    } catch (error) {
      console.error('Erro ao remover culto:', error);
      res.status(500).json({ error: 'Erro ao remover culto.' });
    }
  });

  app.post('/api/schedules', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payload = req.body as Omit<Schedule, 'id' | 'createdAt'> & { id?: string; createdAt?: number };
      const result = await appDataStore.addSchedule(payload, req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      const dateStr = formatBrDate(result.schedule.dateIso);
      await emitNotificationSafe({
        category: 'schedule',
        ministryId: req.authUser!.role === 'admin' ? null : req.authUser!.ministryId,
        title: `Nova escala: ${result.schedule.serviceLabel}`,
        message: `Escala criada para ${dateStr}. Verifique os postos do seu departamento.`,
        targetTab: 'schedules',
        targetId: result.schedule.id,
        actorName: req.authUser!.name
      });
      res.status(201).json({ schedule: result.schedule });
    } catch (error) {
      console.error('Erro ao criar escala:', error);
      res.status(500).json({ error: 'Erro ao criar escala.' });
    }
  });

  app.patch('/api/schedules/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payload = { ...(req.body as Schedule), id: String(req.params.id) };
      const result = await appDataStore.updateSchedule(payload, req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      const dateStr = formatBrDate(result.schedule.dateIso);
      if (result.metadataChanged) {
        await emitNotificationSafe({
          category: 'schedule',
          ministryId: req.authUser!.role === 'admin' ? null : req.authUser!.ministryId,
          title: `Escala atualizada: ${result.schedule.serviceLabel}`,
          message: `Informações ou observações do culto de ${dateStr} foram atualizadas.`,
          targetTab: 'schedules',
          targetId: result.schedule.id,
          actorName: req.authUser!.name
        });
      }
      for (const minId of result.changedMinistryIds) {
        await emitNotificationSafe({
          category: 'schedule',
          ministryId: minId,
          title: `Alteração de equipe: ${result.schedule.serviceLabel}`,
          message: `Voluntários escalados para ${dateStr} foram atualizados.`,
          targetTab: 'schedules',
          targetId: result.schedule.id,
          actorName: req.authUser!.name
        });
      }
      res.json({ schedule: result.schedule });
    } catch (error) {
      console.error('Erro ao atualizar escala:', error);
      res.status(500).json({ error: 'Erro ao atualizar escala.' });
    }
  });

  app.delete('/api/schedules/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await appDataStore.deleteSchedule(String(req.params.id), req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      const dateStr = result.dateIso ? ` (${formatBrDate(result.dateIso)})` : '';
      await emitNotificationSafe({
        category: 'schedule',
        ministryId: req.authUser!.role === 'admin' ? null : req.authUser!.ministryId,
        title: `Escala removida`,
        message: `${result.serviceLabel || 'Escala'}${dateStr} foi excluída.`,
        targetTab: 'schedules',
        actorName: req.authUser!.name
      });
      res.json({ ok: true });
    } catch (error) {
      console.error('Erro ao excluir escala:', error);
      res.status(500).json({ error: 'Erro ao excluir escala.' });
    }
  });

  app.post('/api/schedules/:id/toggle-presence', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const scheduleId = String(req.params.id);
      const { ministryId, assignmentId } = req.body as {
        ministryId?: string;
        assignmentId?: string;
      };
      const result = await appDataStore.toggleAssignmentPresence(
        scheduleId,
        ministryId || '',
        assignmentId || '',
        req.authUser!
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      const dateStr = formatBrDate(result.schedule.dateIso);
      await emitNotificationSafe({
        category: 'schedule',
        ministryId: ministryId || req.authUser!.ministryId,
        title: `Presença atualizada: ${result.schedule.serviceLabel}`,
        message: `Confirmação de voluntário alterada para o culto de ${dateStr}.`,
        targetTab: 'schedules',
        targetId: result.schedule.id,
        actorName: req.authUser!.name
      });
      res.json({ schedule: result.schedule });
    } catch (error) {
      console.error('Erro ao confirmar presença:', error);
      res.status(500).json({ error: 'Erro ao atualizar presença.' });
    }
  });

  app.get('/api/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payload = await notificationStore.listForUser(req.authUser!);
      res.json(payload);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      res.status(500).json({ error: 'Erro ao carregar notificações.' });
    }
  });

  app.post('/api/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await notificationStore.markAsRead(
        String(req.params.id),
        req.authUser!
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      res.json({ notification: result.notification });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      res.status(500).json({ error: 'Erro ao marcar notificação.' });
    }
  });

  app.post('/api/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await notificationStore.markAllAsRead(req.authUser!);
      res.json(result);
    } catch (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
      res.status(500).json({ error: 'Erro ao marcar notificações.' });
    }
  });

  app.post('/api/data/reset', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await appDataStore.resetToSampleData(req.authUser!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await emitNotificationSafe({
        category: 'service',
        ministryId: null,
        title: 'Base de dados restaurada',
        message: 'Os dados de demonstração da igreja foram restaurados pela Coordenação Geral.',
        targetTab: 'dashboard',
        actorName: req.authUser!.name
      });
      res.json(result.data);
    } catch (error) {
      console.error('Erro ao restaurar dados:', error);
      res.status(500).json({ error: 'Erro ao restaurar dados padrão.' });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('{*path}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Escala Fácil server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
