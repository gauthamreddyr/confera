// Confera/server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

const allowedOrigins = String(
  process.env.ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173'
).split(',').map(s=>s.trim()).filter(Boolean);

// ---------- Core middleware ----------
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin(origin, cb){
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS: ' + origin));
  },
  credentials:true
}));

// ---------- In-memory users ----------
const users = new Map(); // email -> user
const pickUser = u => ({ id:u.id, name:u.name, email:u.email });

// ---------- Auth helpers ----------
function setAuthCookie(res, payload){
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn:'7d' });
  res.cookie('confera_jwt', token, {
    httpOnly:true, secure: NODE_ENV==='production', sameSite:'lax', path:'/',
    maxAge: 7*24*3600*1000
  });
}
function requireAuth(req, _res, next){
  const token = req.cookies?.confera_jwt;
  if (!token) return _res.status(401).json({ error:'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return _res.status(401).json({ error:'Unauthorized' }); }
}

// ---------- API ----------
app.get('/api/health', (_req,res)=>res.json({ ok:true, ts:Date.now() }));

app.post('/api/auth/register', async (req,res)=>{
  const { name, email, password } = req.body||{};
  if (!name || !email || !password) return res.status(400).json({ error:'Missing fields' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ error:'Invalid email' });
  if (String(password).length < 8) return res.status(400).json({ error:'Password too short (min 8)' });
  const key = String(email).toLowerCase();
  if (users.has(key)) return res.status(409).json({ error:'An account with this email already exists' });
  const passHash = await bcrypt.hash(password, 10);
  const user = { id:'u_'+Math.random().toString(36).slice(2,10), name:String(name).trim(), email:key, passHash, createdAt:new Date().toISOString() };
  users.set(key, user);
  return res.status(201).json({ user: pickUser(user) });
});

app.post('/api/auth/login', async (req,res)=>{
  const { email, password } = req.body||{};
  const key = String(email||'').toLowerCase();
  const user = users.get(key);
  if (!user) return res.status(401).json({ error:'Invalid email or password' });
  const ok = await bcrypt.compare(String(password||''), user.passHash);
  if (!ok) return res.status(401).json({ error:'Invalid email or password' });
  setAuthCookie(res, { sub:user.id, email:user.email, name:user.name });
  return res.json({ user: pickUser(user) });
});

app.get('/api/auth/me', requireAuth, (req,res)=>{
  const u = Array.from(users.values()).find(x=>x.id===req.user.sub);
  if (!u) return res.status(401).json({ error:'Unauthorized' });
  return res.json({ user: pickUser(u) });
});

app.post('/api/auth/logout', (_req,res)=>{
  res.clearCookie('confera_jwt', { httpOnly:true, sameSite:'lax', path:'/' });
  return res.json({ ok:true });
});

// ---------- Meetings ----------
const meetings = new Map(); // code -> { code, topic, passHash?, createdBy, createdAt }

function genCode(){
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const take=n=>Array.from({length:n},()=>A[Math.floor(Math.random()*A.length)]).join('');
  let c; do{ c=`${take(4)}-${take(4)}-${take(4)}`; }while(meetings.has(c));
  return c;
}

app.post('/api/meetings', requireAuth, async (req,res)=>{
  const topic = String((req.body||{}).topic ?? 'Instant meeting').trim();
  const password = String((req.body||{}).password ?? '').trim();
  if (password && password.length<4) return res.status(400).json({ error:'Password must be at least 4 characters or leave it blank.' });
  const code = genCode();
  const passHash = password ? await bcrypt.hash(password, 10) : null;
  const meeting = { code, topic: topic||'Meeting', passHash, createdBy:req.user.sub, createdAt:new Date().toISOString() };
  meetings.set(code, meeting);
  return res.status(201).json({ meeting:{ code, topic:meeting.topic, createdBy:meeting.createdBy, createdAt:meeting.createdAt }, joinUrl:`/meet/${code}` });
});

app.get('/api/meetings/:code', requireAuth, (req,res)=>{
  const m = meetings.get(req.params.code);
  if (!m) return res.status(404).json({ error:'Meeting not found' });
  return res.json({ meeting:{ code:m.code, topic:m.topic, protected:!!m.passHash, createdBy:m.createdBy, createdAt:m.createdAt } });
});

app.post('/api/meetings/:code/join', requireAuth, async (req,res)=>{
  const m = meetings.get(req.params.code);
  if (!m) return res.status(404).json({ error:'Meeting not found' });
  const password = String((req.body||{}).password||'').trim();
  if (m.passHash){
    const ok = await bcrypt.compare(password, m.passHash);
    if (!ok) return res.status(401).json({ error:'Incorrect meeting password' });
  }
  return res.json({ ok:true, meeting:{ code:m.code, topic:m.topic }, joinUrl:`/meet/${m.code}` });
});

// ---------- Static ----------
const clientDist = path.resolve(__dirname,'..','client','dist');
const hasBuild = fs.existsSync(clientDist);
if (hasBuild) app.use(express.static(clientDist));

// ---------- Socket.IO ----------
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors:{ origin:(o,cb)=>{ if(!o) return cb(null,true); if(allowedOrigins.includes(o)) return cb(null,true); cb(new Error('Not allowed by CORS: '+o)); }, credentials:true }
});

// room -> Map(socketId -> meta)
const roomState = new Map(); // meta: { name,micOn,camOn,hand:false }

io.on('connection', (socket)=>{
  socket.on('join-room', ({ room, name })=>{
    socket.data.room = room;
    socket.data.name = (name||'User').trim()||'User';

    if (!roomState.has(room)) roomState.set(room, new Map());
    const members = roomState.get(room);

    socket.emit('existing-users', Array.from(members.entries()).map(([id,meta])=>({ socketId:id, name:meta.name, micOn:meta.micOn, camOn:meta.camOn, hand: !!meta.hand })));

    members.set(socket.id, { name:socket.data.name, micOn:true, camOn:true, hand:false });
    socket.join(room);
    socket.to(room).emit('user-joined', { socketId:socket.id, name:socket.data.name, micOn:true, camOn:true, hand:false });
    io.to(room).emit('room-count', { count: members.size });
  });

  // WebRTC signaling passthrough
  socket.on('signal', ({ target, data })=>{
    io.to(target).emit('signal', { from:socket.id, data });
  });

  // Media state
  socket.on('media-state', ({ micOn, camOn })=>{
    const room = socket.data.room, members = roomState.get(room);
    if (members?.has(socket.id)){
      const meta = members.get(socket.id);
      meta.micOn = !!micOn; meta.camOn = !!camOn; members.set(socket.id, meta);
      socket.to(room).emit('media-state', { socketId:socket.id, micOn:!!micOn, camOn:!!camOn });
    }
  });

  // Chat (server echoes to everyone once; client should NOT self-append)
  socket.on('chat', ({ text })=>{
    const room = socket.data.room;
    const msg = { from:socket.id, name:socket.data.name, text:String(text||'').slice(0,1000), ts:Date.now() };
    io.to(room).emit('chat', msg);
  });

  // Raise hand
  socket.on('raise-hand', ({ hand })=>{
    const room = socket.data.room, members = roomState.get(room);
    if (members?.has(socket.id)){
      const meta = members.get(socket.id);
      meta.hand = !!hand; members.set(socket.id, meta);
      io.to(room).emit('raise-hand', { socketId:socket.id, hand: !!hand });
    }
  });

  // Emoji reaction
  socket.on('reaction', ({ emoji })=>{
    const room = socket.data.room;
    io.to(room).emit('reaction', { socketId:socket.id, emoji, ts:Date.now() });
  });

  // Host control: mute-all (no auth gate in demo)
  socket.on('mute-all', ()=>{
    const room = socket.data.room;
    io.to(room).emit('mute-all');
  });

  socket.on('disconnect', ()=>{
    const room = socket.data.room;
    const members = roomState.get(room);
    if (members){
      members.delete(socket.id);
      socket.to(room).emit('user-left', { socketId:socket.id });
      io.to(room).emit('room-count', { count: members.size });
      if (members.size===0) roomState.delete(room);
    }
  });
});

// SPA catch-all
if (hasBuild) {
  app.get(/^(?!\/api\/).*/, (_req,res)=>res.sendFile(path.join(clientDist,'index.html')));
}

// Errors
app.use((err, req, res, _next)=>{
  if (err && String(err.message||'').startsWith('Not allowed by CORS'))
    return res.status(403).json({ error:'CORS blocked', origin:req.headers.origin });
  console.error(err);
  res.status(500).json({ error:'Internal server error' });
});

httpServer.listen(PORT, ()=>{
  console.log(`[api] http://localhost:${PORT}`);
  console.log(`CORS: ${allowedOrigins.join(', ')}`);
  if (hasBuild) console.log(`[ui] Serving ${clientDist}`);
});
