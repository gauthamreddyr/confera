# Confera

A polished, Zoom-style video conferencing app built with **React (Vite)** + **Express** + **Socket.IO** + **WebRTC**.  
Recruiter-friendly showcase: professional UI, clean architecture, and real-time meetings with screen share, chat, and hand raise.

---

## ✨ Features

- **Branding & Prelogin:** Zoom-like dark theme and layout (no Tailwind)
- **Auth:** Email/password (register, sign in, sign out) with HttpOnly JWT cookie
- **Dashboard:** Start instant meeting (random shareable code + optional password) or join by code
- **Meetings (WebRTC + Socket.IO)**
  - Camera/Mic controls, seamless **Screen Share**, auto-recover to camera
  - **Responsive tile layout** (1, 2, 3+ participants) with professional sizing
  - **Chat** (no self-duplicate) + unread badge
  - **Raise hand** per participant
  - Participant count & live media state sync
- **UX details**
  - Smart meeting code input: `ABCD-EFGH-1234` (paste-friendly, auto-format)
  - Global dark theme via CSS variables; accessible labels & focus rings

---

## 🧱 Tech Stack

- **Frontend:** React 18, Vite, CSS Modules
- **Backend:** Node.js (>=18), Express, Socket.IO, bcrypt, jsonwebtoken
- **RTC:** WebRTC (configurable STUN/TURN via env)
- **Deploy (suggested):** Vercel (client) + Render (server)

---

## 📁 Project Structure

```
Confera/
├─ client/                      # React app (Vite)
│  ├─ src/
│  │  ├─ components/
│  │  ├─ context/               # AuthContext.jsx
│  │  ├─ lib/                   # env.js, auth.js, meetings.js, validators.js
│  │  ├─ styles/                # global.css + CSS Modules
│  │  ├─ views/                 # Prelogin, Register, SignIn, Dashboard, JoinMeeting, MeetRoom
│  │  ├─ App.jsx  main.jsx
│  ├─ vite.config.js
│  ├─ package.json
│
├─ server/                      # Express + Socket.IO API
│  ├─ index.js
│  ├─ package.json
│
├─ .gitignore
├─ README.md
├─ .env                         # local server env (not committed)
```

---

## ⚙️ Environment Variables

### Client (Vite) — set in Vercel for prod; local dev uses fallback
- `VITE_API` — Backend base URL (e.g., `https://confera-api.onrender.com`)
- `VITE_ICE` — JSON for ICE servers (WebRTC). Example:
  ```json
  {"iceServers":[
    {"urls":"stun:stun.l.google.com:19302"},
    {"urls":["turn:turn.yourdomain.com:3478","turns:turn.yourdomain.com:5349"],
     "username":"confera","credential":"<turn-password>"}
  ]}
  ```

### Server (Express) — set in Render or `.env` locally
```
NODE_ENV=development
PORT=4000
JWT_SECRET=dev_super_secret_please_change
# Allow dev UI on both hostnames if needed
ORIGIN=http://localhost:5173,http://127.0.0.1:5173
# For cross-site cookies in prod (Vercel + Render):
# CROSS_SITE=1
# ALLOW_VERCEL_PREVIEWS=1
# ORIGIN=https://your-frontend.vercel.app,https://your-custom-domain.com
```

> The server reads `ORIGIN` (comma-separated) for CORS and sets secure cookies when `CROSS_SITE=1`. Socket.IO uses the same allowlist.

---

## 🧪 Local Development

**Prereqs:** Node 18+ and npm

```bash
# Install deps
cd Confera/client && npm install
cd ../server && npm install

# Create Confera/.env for server (example above), then run:

# Terminal A: start API + Socket.IO
cd Confera/server
node index.js

# Terminal B: start Vite dev server
cd Confera/client
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:4000

**Notes**
- `/api/auth/me` returns **401** until you log in (expected).
- Meeting screen share toggling will recover to camera automatically.

---

## 🚀 Deployment (when you’re ready)

### Option A — Frontend on **Vercel**, Backend on **Render** (recommended)

**Render (server)**
- Root Directory: `server`
- Build Command: `npm ci` (or `npm install` if no lockfile)
- Start Command: `node index.js`
- Env:
  ```
  NODE_ENV=production
  PORT=10000
  JWT_SECRET=<long random>
  CROSS_SITE=1
  ALLOW_VERCEL_PREVIEWS=1
  ORIGIN=https://<your-vercel>.vercel.app,https://<your-custom-domain>
  ```

**Vercel (client)**
- Root Directory: `client`
- Install Command: `npm install`
- Build Command: `npm exec vite build`
- Output: `dist`
- Env:
  ```
  VITE_API=https://<your-render-backend>.onrender.com
  VITE_ICE={"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]}
  ```
- **Redeploy with “Clear Build Cache”** after changing env.

### Option B — Single origin on Render
- Build the client in Render, serve `/client/dist` from the Node server.
- Build Command:
  ```
  npm --prefix client ci && npm --prefix client run build
  npm --prefix server ci
  ```
- Start Command:
  ```
  node server/index.js
  ```

---

## 🌐 TURN (for reliability)

WebRTC often needs TURN for strict NATs. Run **coturn** on a tiny VM (open 3478/5349 UDP+TCP) and set `VITE_ICE` with your TURN creds. This dramatically improves success rates across networks.

---

## 🛡️ Security

- HttpOnly JWT cookie (7d), `SameSite=None; Secure` in production
- CORS restricted to `ORIGIN` list (plus optional `*.vercel.app`)
- Suggested hardening:
  - `helmet` + `compression`
  - `express-rate-limit` on auth endpoints
  - Persist users in a DB (current demo is in-memory)

---

## 🧰 Scripts

**client**
```json
"dev": "npm exec vite",
"build": "npm exec vite build",
"preview": "npm exec vite preview --port 5174"
```

**server**
```json
"start": "node index.js"
```

---

## 🧩 Troubleshooting

- **Register → 400**  
  Ensure body includes `{ name, email, password }` and password ≥ 8.
- **Vercel 404 on /api/**  
  Set `VITE_API` to the Render URL and **rebuild (Clear Cache)**; ensure all fetches use `API_BASE` from `lib/env.js`.
- **/api/auth/me → 401**  
  Normal until you log in; then it returns 200 with user info.
- **CORS or cookie blocked**  
  Check `ORIGIN` (exact origin, no trailing slash) and `CROSS_SITE=1`. Restart server.
- **WebRTC fails on some networks**  
  Add TURN in `VITE_ICE`.
- **White background**  
  Ensure `src/styles/global.css` is imported in `client/src/main.jsx`.

---

## 🗺 Roadmap

- Persist users/meetings in Postgres (Prisma)
- Host controls, waiting room, mute-all
- Recording (SFU/MCU or server-side)
- Device settings panel (camera/mic/speakers)
- Speaker/grid views, pinned tiles, drag-reorder

---

## 📜 License

MIT © Confera
