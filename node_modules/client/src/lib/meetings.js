// Confera/client/src/lib/meetings.js
const BASE = ""; // use Vite proxy

const json = async (res) => {
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
};

export async function createMeeting({ topic, password }) {
  const res = await fetch(`${BASE}/api/meetings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ topic, password }),
  });
  return json(res);
}
export async function getMeeting(code) {
  const res = await fetch(`${BASE}/api/meetings/${encodeURIComponent(code)}`, {
    credentials: "include",
  });
  return json(res);
}
export async function joinMeeting(code, password) {
  const res = await fetch(`${BASE}/api/meetings/${encodeURIComponent(code)}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  return json(res);
}
