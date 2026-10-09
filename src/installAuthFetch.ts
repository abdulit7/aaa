// Adds "Authorization: Bearer <token>" to every request to /api/*,
// and signs the user out cleanly when the server says the session is dead (401).

const TOKEN_KEY = 'gatemaster_token';
const SESSION_KEYS = ['gatemaster_token', 'gatemaster_refresh_token', 'gatemaster_session_id'];

const looksLikeJwt = (v: unknown): v is string =>
  typeof v === 'string' && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v);

function getToken(): string | null {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) return t;
    // fallback: any JWT-looking value in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const v = localStorage.getItem(localStorage.key(i) || '');
      if (looksLikeJwt(v)) return v;
    }
  } catch { /* storage blocked */ }
  return null;
}

function handleDeadSession() {
  // Avoid reload loops: only once every 10 seconds.
  const last = Number(sessionStorage.getItem('gm_401_reload') || 0);
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem('gm_401_reload', String(Date.now()));
  SESSION_KEYS.forEach(k => localStorage.removeItem(k));
  console.warn('[auth] Session rejected by server (401). Signed out, please log in again.');
  location.reload();
}

const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  const isApi = url.includes('/api/');
  const isLogin = url.includes('/api/auth/login') || url.includes('/api/auth/refresh');

  let sentToken = false;
  if (isApi && !isLogin) {
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const token = getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
      sentToken = true;
    } else if (headers.has('Authorization')) {
      sentToken = true;
    }
    init = { ...init, headers };
  }

  const res = await originalFetch(input, init);
  if (isApi && !isLogin && res.status === 401 && sentToken) handleDeadSession();
  return res;
};

export {};
