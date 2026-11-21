import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let cachedSignature = '';

function normalizeEnvValue(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.startsWith('MY_SUPABASE') ||
    trimmed.startsWith('YOUR_SUPABASE') ||
    trimmed.includes('your-project.supabase.co')
  ) {
    return '';
  }
  return trimmed;
}

export function getSupabaseCredentials(): { url: string; key: string } | null {
  const url = normalizeEnvValue(process.env.SUPABASE_URL);
  const serviceKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = normalizeEnvValue(process.env.SUPABASE_ANON_KEY);
  const key = serviceKey || anonKey;

  if (!url || !key) return null;
  if (!/^https?:\/\//i.test(url)) return null;

  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseCredentials() !== null;
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export function getSupabaseClient(): SupabaseClient | null {
  const creds = getSupabaseCredentials();
  if (!creds) {
    cachedClient = null;
    cachedSignature = '';
    return null;
  }

  const signature = `${creds.url}::${creds.key}`;
  if (cachedClient && cachedSignature === signature) {
    return cachedClient;
  }

  cachedClient = createClient(creds.url, creds.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  cachedSignature = signature;
  return cachedClient;
}

export function isSupabaseTableMissingError(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if (code === 'PGRST205' || code === '42P01') return true;
  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('could not find the table') ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('schema cache')
  );
}

export function isSupabaseFallbackError(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  if (isSupabaseTableMissingError(error)) return true;
  const code = String(error.code || '').toUpperCase();
  if (code === '42501' || code === 'PGRST301') return true;
  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('row-level security') ||
    msg.includes('invalid api key') ||
    msg.includes('jwt') ||
    msg.includes('permission denied') ||
    msg.includes('unexpected token') ||
    msg.includes('fetch failed') ||
    msg.includes('enotfound') ||
    msg.includes('eai_again') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('und_err')
  );
}

