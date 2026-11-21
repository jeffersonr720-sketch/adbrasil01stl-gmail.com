const TOKEN_LOCAL_KEY = 'escala_facil_auth_token';
const TOKEN_SESSION_KEY = 'escala_facil_auth_session';

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_LOCAL_KEY) || sessionStorage.getItem(TOKEN_SESSION_KEY);
  } catch {
    return null;
  }
}

export function storeAuthToken(token: string, rememberMe: boolean): void {
  try {
    localStorage.removeItem(TOKEN_LOCAL_KEY);
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
    if (rememberMe) {
      localStorage.setItem(TOKEN_LOCAL_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_SESSION_KEY, token);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearStoredAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_LOCAL_KEY);
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
  } catch {
    // ignore
  }
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredAuthToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
}
