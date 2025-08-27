// client/src/lib/env.js
// Resolves the backend base URL for fetches & Socket.IO.
// Works locally (localhost) and in prod (Vercel uses VITE_API).
const RAW = import.meta.env.VITE_API;

let base = "";
if (typeof RAW === "string" && RAW.trim()) {
  base = RAW.replace(/\/$/, ""); // strip trailing slash
} else if (
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1"
) {
  // Local dev fallback (client on 5173, server on 4000)
  base = "http://localhost:4000";
}

export const API_BASE = base;
// For Socket.IO; if API_BASE is empty (same-origin), fall back to current origin
export const SOCKET_URL = base || window.location.origin;
