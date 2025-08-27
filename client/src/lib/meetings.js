import { API_BASE } from "./env.js";

async function j(r) {
  let data; try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error((data && data.error) || `Request failed (${r.status})`);
  return data;
}

export async function createMeeting(topic, password) {
  const r = await fetch(`${API_BASE}/api/meetings`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, password }),
  });
  return j(r);
}

export async function getMeeting(code) {
  const r = await fetch(`${API_BASE}/api/meetings/${code}`, {
    credentials: "include",
  });
  return j(r);
}

export async function joinMeeting(code, password) {
  const r = await fetch(`${API_BASE}/api/meetings/${code}/join`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return j(r);
}
