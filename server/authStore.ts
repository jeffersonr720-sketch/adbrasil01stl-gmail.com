import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  CreateLeaderPayload,
  LeaderRole,
  LeaderUser,
  UpdateLeaderPayload
} from '../src/types/index.ts';

export interface StoredLeaderRecord extends LeaderUser {
  passwordHash: string;
}

interface LeadersDb {
  leaders: StoredLeaderRecord[];
}

export interface SessionTokenPayload {
  sub: string;
  role: LeaderRole;
  iat: number;
  exp: number;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function hashPassword(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  if (!salt || !originalHex) return false;

  const derivedBuf = crypto.scryptSync(password, salt, 64);
  const originalBuf = Buffer.from(originalHex, 'hex');
  if (derivedBuf.length !== originalBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, originalBuf);
}

export function sanitizeLeader(record: StoredLeaderRecord): LeaderUser {
  const { passwordHash: _omitted, ...safe } = record;
  return safe;
}

export function signSessionToken(
  user: Pick<LeaderUser, 'id' | 'role'>,
  secret: string,
  nowMs: number = Date.now()
): string {
  const payload: SessionTokenPayload = {
    sub: user.id,
    role: user.role,
    iat: nowMs,
    exp: nowMs + SESSION_TTL_MS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  nowMs: number = Date.now()
): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;

  const encodedPayload = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionTokenPayload;
    if (!parsed || typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (nowMs > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildDefaultSeedLeaders(nowMs: number = Date.now()): StoredLeaderRecord[] {
  return [
    {
      id: 'ldr-admin',
      name: 'Pr. Lucas Ribeiro',
      login: 'admin',
      email: 'lucas.pastor@igreja.com.br',
      cargo: 'Pastor Titular · Coordenação Geral',
      role: 'admin',
      ministryId: null,
      active: true,
      createdAt: nowMs,
      passwordHash: hashPassword('admin123')
    },
    {
      id: 'ldr-louvor',
      name: 'Camila Fernandes',
      login: 'louvor',
      email: 'camila.louvor@igreja.com.br',
      cargo: 'Líder de Louvor',
      role: 'leader',
      ministryId: 'min-louvor',
      active: true,
      createdAt: nowMs,
      passwordHash: hashPassword('adbrasil123')
    },
    {
      id: 'ldr-midia',
      name: 'Beatriz Lima',
      login: 'midia',
      email: 'beatriz.midia@igreja.com.br',
      cargo: 'Líder de Mídia',
      role: 'leader',
      ministryId: 'min-midia',
      active: true,
      createdAt: nowMs,
      passwordHash: hashPassword('adbrasil123')
    },
    {
      id: 'ldr-recepcao',
      name: 'Juliana Barbosa',
      login: 'recepcao',
      email: 'juliana.recepcao@igreja.com.br',
      cargo: 'Líder de Recepção',
      role: 'leader',
      ministryId: 'min-recepcao',
      active: true,
      createdAt: nowMs,
      passwordHash: hashPassword('adbrasil123')
    },
    {
      id: 'ldr-infantil',
      name: 'Tia Débora Santos',
      login: 'infantil',
      email: 'debora.kids@igreja.com.br',
      cargo: 'Coordenadora Infantil',
      role: 'leader',
      ministryId: 'min-infantil',
      active: true,
      createdAt: nowMs,
      passwordHash: hashPassword('adbrasil123')
    },
    {
      id: 'ldr-diaconato',
      name: 'Diácono Paulo Andrade',
      login: 'diaconato',
      email: 'paulo.diacono@igreja.com.br',
      cargo: 'Diácono Chefe',
      role: 'leader',
      ministryId: 'min-diaconato',
      active: true,
      createdAt: nowMs,
      passwordHash: hashPassword('adbrasil123')
    }
  ];
}

export class LeaderAuthStore {
  private dbPath: string;
  private secretPath: string;
  private sessionSecret: string;

  constructor(dataDir: string = path.resolve(process.cwd(), '.data')) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.dbPath = path.join(dataDir, 'leaders.json');
    this.secretPath = path.join(dataDir, 'session.key');
    this.sessionSecret = this.loadOrCreateSecret();
    this.ensureInitialized();
  }

  private loadOrCreateSecret(): string {
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
      return process.env.SESSION_SECRET;
    }
    if (fs.existsSync(this.secretPath)) {
      const saved = fs.readFileSync(this.secretPath, 'utf8').trim();
      if (saved.length >= 16) return saved;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(this.secretPath, generated, { mode: 0o600 });
    return generated;
  }

  private ensureInitialized(): void {
    if (!fs.existsSync(this.dbPath)) {
      const initial: LeadersDb = { leaders: buildDefaultSeedLeaders() };
      fs.writeFileSync(this.dbPath, JSON.stringify(initial, null, 2), 'utf8');
    }
  }

  private readDb(): LeadersDb {
    this.ensureInitialized();
    const raw = fs.readFileSync(this.dbPath, 'utf8');
    const parsed = JSON.parse(raw) as LeadersDb;
    if (!parsed || !Array.isArray(parsed.leaders)) {
      return { leaders: buildDefaultSeedLeaders() };
    }
    return parsed;
  }

  private writeDb(db: LeadersDb): void {
    fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2), 'utf8');
  }

  getSecret(): string {
    return this.sessionSecret;
  }

  listLeaders(): LeaderUser[] {
    return this.readDb().leaders.map(sanitizeLeader);
  }

  findById(id: string): LeaderUser | null {
    const found = this.readDb().leaders.find((l) => l.id === id);
    return found ? sanitizeLeader(found) : null;
  }

  findByIdentifier(identifier: string): LeaderUser | null {
    const normalized = identifier.trim().toLowerCase();
    if (!normalized) return null;
    const found = this.readDb().leaders.find(
      (l) => l.login.toLowerCase() === normalized || (l.email && l.email.toLowerCase() === normalized)
    );
    return found ? sanitizeLeader(found) : null;
  }

  resetPasswordById(
    userId: string,
    newPassword: string
  ): { ok: true } | { ok: false; reason: string; status: number } {
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, reason: 'A nova senha deve ter pelo menos 6 caracteres.', status: 400 };
    }
    const db = this.readDb();
    const record = db.leaders.find((l) => l.id === userId);
    if (!record) {
      return { ok: false, reason: 'Usuário não encontrado.', status: 404 };
    }
    record.passwordHash = hashPassword(newPassword);
    this.writeDb(db);
    return { ok: true };
  }

  authenticate(
    identifier: string,
    password: string
  ): { ok: true; user: LeaderUser; token: string } | { ok: false; reason: string; status: number } {
    const normalized = identifier.trim().toLowerCase();
    if (!normalized || !password) {
      return { ok: false, reason: 'Informe login e senha para acessar.', status: 400 };
    }

    const db = this.readDb();
    const record = db.leaders.find(
      (l) => l.login.toLowerCase() === normalized || (l.email && l.email.toLowerCase() === normalized)
    );

    if (!record || !verifyPassword(password, record.passwordHash)) {
      return { ok: false, reason: 'Login ou senha incorretos.', status: 401 };
    }

    if (!record.active) {
      return {
        ok: false,
        reason: 'Este acesso está desativado. Procure a Coordenação Geral.',
        status: 403
      };
    }

    record.lastLoginAt = Date.now();
    this.writeDb(db);

    const safeUser = sanitizeLeader(record);
    const token = signSessionToken(safeUser, this.sessionSecret);
    return { ok: true, user: safeUser, token };
  }

  verifyToken(token: string): LeaderUser | null {
    const payload = verifySessionToken(token, this.sessionSecret);
    if (!payload) return null;
    const found = this.findById(payload.sub);
    if (!found || !found.active) return null;
    return found;
  }

  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): { ok: true } | { ok: false; reason: string; status: number } {
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return { ok: false, reason: 'A nova senha deve ter pelo menos 6 caracteres.', status: 400 };
    }

    const db = this.readDb();
    const record = db.leaders.find((l) => l.id === userId);
    if (!record) {
      return { ok: false, reason: 'Usuário não encontrado.', status: 404 };
    }

    if (!verifyPassword(currentPassword, record.passwordHash)) {
      return { ok: false, reason: 'A senha atual está incorreta.', status: 401 };
    }

    record.passwordHash = hashPassword(newPassword);
    this.writeDb(db);
    return { ok: true };
  }

  createLeader(
    payload: CreateLeaderPayload
  ): { ok: true; leader: LeaderUser } | { ok: false; reason: string; status: number } {
    const cleanLogin = payload.login.trim().toLowerCase();
    const cleanEmail = payload.email.trim().toLowerCase();
    if (!payload.name.trim() || !cleanLogin || !payload.password || payload.password.length < 6) {
      return { ok: false, reason: 'Preencha nome, login válido e senha com no mínimo 6 caracteres.', status: 400 };
    }

    if (!/^[a-z0-9._-]+$/.test(cleanLogin)) {
      return { ok: false, reason: 'Login inválido. Use letras, números, ponto, hífen ou _.', status: 400 };
    }

    const db = this.readDb();
    const duplicate = db.leaders.find(
      (l) =>
        l.login.toLowerCase() === cleanLogin ||
        (cleanEmail && l.email && l.email.toLowerCase() === cleanEmail)
    );
    if (duplicate) {
      return { ok: false, reason: 'Já existe um líder cadastrado com este login ou e-mail.', status: 409 };
    }

    const newRecord: StoredLeaderRecord = {
      id: `ldr-${crypto.randomUUID().slice(0, 8)}`,
      name: payload.name.trim(),
      login: cleanLogin,
      email: cleanEmail,
      cargo: payload.cargo.trim() || (payload.role === 'admin' ? 'Coordenação Geral' : 'Líder de Departamento'),
      role: payload.role,
      ministryId: payload.role === 'admin' ? null : payload.ministryId,
      active: true,
      createdAt: Date.now(),
      passwordHash: hashPassword(payload.password)
    };

    db.leaders.push(newRecord);
    this.writeDb(db);
    return { ok: true, leader: sanitizeLeader(newRecord) };
  }

  updateLeader(
    targetId: string,
    payload: UpdateLeaderPayload,
    actingUserId: string
  ): { ok: true; leader: LeaderUser } | { ok: false; reason: string; status: number } {
    const db = this.readDb();
    const target = db.leaders.find((l) => l.id === targetId);
    if (!target) {
      return { ok: false, reason: 'Líder não encontrado.', status: 404 };
    }

    if (payload.login !== undefined) {
      const cleanLogin = payload.login.trim().toLowerCase();
      if (!/^[a-z0-9._-]+$/.test(cleanLogin) || cleanLogin.length < 3) {
        return { ok: false, reason: 'Login inválido (mínimo 3 caracteres sem espaços).', status: 400 };
      }
      const conflict = db.leaders.find(
        (l) => l.id !== targetId && l.login.toLowerCase() === cleanLogin
      );
      if (conflict) {
        return { ok: false, reason: 'Este login já está em uso por outro líder.', status: 409 };
      }
      target.login = cleanLogin;
    }

    if (payload.email !== undefined) {
      const cleanEmail = payload.email.trim().toLowerCase();
      if (cleanEmail) {
        const conflict = db.leaders.find(
          (l) => l.id !== targetId && l.email && l.email.toLowerCase() === cleanEmail
        );
        if (conflict) {
          return { ok: false, reason: 'Este e-mail já está em uso por outro líder.', status: 409 };
        }
      }
      target.email = cleanEmail;
    }

    if (payload.name !== undefined && payload.name.trim()) {
      target.name = payload.name.trim();
    }
    if (payload.cargo !== undefined) {
      target.cargo = payload.cargo.trim();
    }
    if (payload.role !== undefined) {
      if (target.id === actingUserId && payload.role !== 'admin') {
        return { ok: false, reason: 'Você não pode remover seu próprio acesso de Coordenação Geral.', status: 400 };
      }
      target.role = payload.role;
      if (payload.role === 'admin') {
        target.ministryId = null;
      }
    }
    if (payload.ministryId !== undefined && target.role !== 'admin') {
      target.ministryId = payload.ministryId;
    }
    if (payload.active !== undefined) {
      if (target.id === actingUserId && !payload.active) {
        return { ok: false, reason: 'Você não pode desativar o seu próprio usuário conectado.', status: 400 };
      }
      target.active = payload.active;
    }
    if (payload.password !== undefined && payload.password.length > 0) {
      if (payload.password.length < 6) {
        return { ok: false, reason: 'A nova senha deve ter pelo menos 6 caracteres.', status: 400 };
      }
      target.passwordHash = hashPassword(payload.password);
    }

    this.writeDb(db);
    return { ok: true, leader: sanitizeLeader(target) };
  }

  deleteLeader(
    targetId: string,
    actingUserId: string
  ): { ok: true } | { ok: false; reason: string; status: number } {
    if (targetId === actingUserId) {
      return { ok: false, reason: 'Você não pode excluir o seu próprio acesso.', status: 400 };
    }
    const db = this.readDb();
    const target = db.leaders.find((l) => l.id === targetId);
    if (!target) {
      return { ok: false, reason: 'Líder não encontrado.', status: 404 };
    }

    const activeAdmins = db.leaders.filter((l) => l.role === 'admin' && l.active);
    if (target.role === 'admin' && activeAdmins.length <= 1) {
      return { ok: false, reason: 'Deve existir ao menos um administrador ativo no sistema.', status: 400 };
    }

    db.leaders = db.leaders.filter((l) => l.id !== targetId);
    this.writeDb(db);
    return { ok: true };
  }
}
