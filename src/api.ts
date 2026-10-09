// Small fetch wrapper: stores the session, sends the token, refreshes once on 401.
// Works the same on phone, tablet and desktop browsers.

const KEY = 'gm_session';
type Session = { token: string; refreshToken: string; sessionId: string; user: any };

export const getSession = (): Session | null => {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
};
const setSession = (s: Session | null) =>
  s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY);

export async function login(loginName: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: loginName,
      password,
      device_type: /Mobi|Android|iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : 'web'
    })
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Login failed');
  setSession({ token: data.token, refreshToken: data.refreshToken, sessionId: data.sessionId, user: data.user });
  return data.user;
}

export async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  setSession(null);
  location.href = '/login';
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const s = getSession();
  if (!s) return false;
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: s.sessionId, refreshToken: s.refreshToken })
  });
  if (!res.ok) return false;
  const d = await res.json();
  setSession({ ...s, token: d.token, refreshToken: d.refreshToken, user: d.user });
  return true;
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const doFetch = () => {
    const s = getSession();
    return fetch('/api' + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...(s ? { Authorization: `Bearer ${s.token}` } : {})
      }
    });
  };

  let res = await doFetch();
  if (res.status === 401 && getSession()) {
    refreshing = refreshing || refresh().finally(() => (refreshing = null));
    if (await refreshing) res = await doFetch();
    else { setSession(null); location.href = '/login'; throw new Error('Session expired'); }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Notification bell: poll every 20s (no websockets needed).
export function pollNotifications(onCount: (n: number) => void) {
  const tick = () => api<{ count: number }>('/notifications/unread-count').then(d => onCount(d.count)).catch(() => {});
  tick();
  const id = setInterval(tick, 20000);
  return () => clearInterval(id);
}
