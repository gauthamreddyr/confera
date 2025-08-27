const API = import.meta.env.VITE_API_URL;

const json = async (res) => {
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
};

export async function registerUser({ name, email, password }) {
  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, email, password }),
  });
  return json(res);
}

export async function signIn({ email, password }) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return json(res);
}

export async function getMe() {
  const res = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  return json(res);
}

export async function signOut() {
  await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' });
}
