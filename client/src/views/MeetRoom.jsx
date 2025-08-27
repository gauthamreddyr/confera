import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./MeetRoom.module.css";
import { getMeeting } from "../lib/meetings.js";
import { SOCKET_URL } from "../lib/env.js";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext.jsx";

// ICE (use TURN via VITE_ICE if you have it)
const ICE = (() => {
  try { return JSON.parse(import.meta.env.VITE_ICE); }
  catch { return { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }; }
})();

/** Visual constants (keep in sync with CSS where relevant) */
const GAP = 12;      // px space between tiles
const PAD = 14;      // px padding inside stage
const ASPECT = 16/9; // tile aspect ratio
const MAX_COLS = 5;  // gallery caps at 5 columns like Zoom’s larger grids

export default function MeetRoom() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  // ---- Signaling / peers ----
  const socketRef  = useRef(null);
  const pcsRef     = useRef(new Map());   // id -> RTCPeerConnection
  const sendersRef = useRef(new Map());   // id -> { v, a }
  const streamsRef = useRef(new Map());   // id -> MediaStream
  const metaRef    = useRef(new Map());   // id -> { name, micOn, camOn }
  const pendingIceRef = useRef(new Map());

  // ---- Local media ----
  const camTrackRef    = useRef(null);
  const micTrackRef    = useRef(null);
  const screenTrackRef = useRef(null);
  const [localPreview, setLocalPreview] = useState(null);

  // ---- UI state ----
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState("gallery"); // gallery | speaker
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);

  // Chat
  const [openPanel, setOpenPanel] = useState(null); // 'chat' | null
  const [chatUnread, setChatUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [msgs, setMsgs] = useState([]);
  const chatListRef = useRef(null);

  // Raise hand
  const [hands, setHands] = useState(new Set());

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [devices, setDevices] = useState({ mics: [], cams: [], outs: [] });
  const [selIn, setSelIn] = useState({ micId: "", camId: "" });
  const [selOut, setSelOut] = useState({ spkId: "" });
  const previewRef = useRef(null);
  const previewStreamRef = useRef(null);

  // Stage sizing / grid
  const stageRef = useRef(null);
  const [grid, setGrid] = useState({ cols: 1, rows: 1, tileW: 640, tileH: 360 });

  // ---- Load meeting meta ----
  useEffect(() => {
    (async () => {
      const { meeting } = await getMeeting(code);
      setInfo(meeting);
    })();
  }, [code]);

  // ---- Init media + socket ----
  useEffect(() => {
    if (!info) return;
    let disposed = false;

    (async () => {
      const ms = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (disposed) return;
      camTrackRef.current = ms.getVideoTracks()[0] || null;
      micTrackRef.current = ms.getAudioTracks()[0] || null;
      rebuildPreview();

      const s = io(SOCKET_URL, { withCredentials: true, path: "/socket.io" });
      socketRef.current = s;

      s.on("connect", () => s.emit("join-room", { room: code, name: user?.name || "User" }));

      // Newcomer sends offers to incumbents
      s.on("existing-users", (list) => {
        list.forEach(({ socketId, name, micOn, camOn, hand }) => {
          metaRef.current.set(socketId, { name, micOn, camOn });
          if (hand) setHands(prev => new Set(prev).add(socketId));
          makeOffer(socketId);
        });
        force();
      });

      // Incumbents await offers from newcomer
      s.on("user-joined", ({ socketId, name, micOn, camOn, hand }) => {
        metaRef.current.set(socketId, { name, micOn, camOn });
        if (hand) setHands(prev => new Set(prev).add(socketId));
        force();
      });

      s.on("user-left", ({ socketId }) => {
        cleanupPeer(socketId);
        setHands(prev => { const n = new Set(prev); n.delete(socketId); return n; });
      });

      s.on("media-state", ({ socketId, micOn, camOn }) => {
        const m = metaRef.current.get(socketId) || {};
        metaRef.current.set(socketId, { ...m, micOn, camOn });
        force();
      });

      // Server echoes chat (we mark .me on receive)
      s.on("chat", (m) => {
        setMsgs(prev => [...prev, { ...m, id: `${m.from}-${m.ts}-${Math.random()}`, me: m.from === socketRef.current.id }]);
        if (openPanel !== "chat") setChatUnread(x => x + 1);
        queueMicrotask(scrollChatToEnd);
      });

      s.on("raise-hand", ({ socketId, hand }) => {
        setHands(prev => {
          const n = new Set(prev);
          if (hand) n.add(socketId); else n.delete(socketId);
          return n;
        });
      });

      // Perfect negotiation + ICE queue
      s.on("signal", async ({ from, data }) => {
        const pc = await ensurePc(from, false);
        try {
          if (data?.type === "offer") {
            if (pc.signalingState === "have-local-offer") {
              try { await pc.setLocalDescription({ type: "rollback" }); } catch {}
            }
            await pc.setRemoteDescription(data);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketRef.current.emit("signal", { target: from, data: pc.localDescription });
            await flushPendingIce(from);
          } else if (data?.type === "answer") {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(data);
              await flushPendingIce(from);
            }
          } else if (data?.candidate) {
            if (pc.remoteDescription) {
              try { await pc.addIceCandidate(data); } catch {}
            } else {
              const q = pendingIceRef.current.get(from) || [];
              q.push(data); pendingIceRef.current.set(from, q);
            }
          }
        } catch {}
      });
    })();

    return () => {
      disposed = true;
      try { socketRef.current?.disconnect(); } catch {}
      pcsRef.current.forEach(pc => { try { pc.close(); } catch {} });
      pcsRef.current.clear();
      streamsRef.current.forEach(st => st.getTracks().forEach(t => t.stop()));
      streamsRef.current.clear();
      [camTrackRef, micTrackRef, screenTrackRef].forEach(r => { try { r.current?.stop(); } catch {} r.current = null; });
      sendersRef.current.clear(); pendingIceRef.current.clear();
    };
  }, [info, code, user?.name, openPanel]);

  // --- force re-render helper ---
  const [, setTick] = useState(0);
  const force = () => setTick(x => x + 1);

  // --- Build local preview stream ---
  function rebuildPreview() {
    const v = sharing ? screenTrackRef.current : camTrackRef.current;
    const preview = new MediaStream([v, micTrackRef.current].filter(Boolean));
    setLocalPreview(preview);
  }
  const stopTrack = (t) => { try { t && t.stop(); } catch {} };

  // --- ICE queue flush ---
  async function flushPendingIce(id) {
    const pc = pcsRef.current.get(id); if (!pc) return;
    const arr = pendingIceRef.current.get(id) || [];
    for (const c of arr) { try { await pc.addIceCandidate(c); } catch {} }
    pendingIceRef.current.delete(id);
  }

  // --- Peer connection lifecycle ---
  async function ensurePc(id, initiator) {
    if (pcsRef.current.has(id)) return pcsRef.current.get(id);
    const pc = new RTCPeerConnection(ICE);

    let vSender = null, aSender = null;
    const v = sharing ? screenTrackRef.current : camTrackRef.current;
    if (v) vSender = pc.addTrack(v, new MediaStream([v]));
    if (micTrackRef.current) aSender = pc.addTrack(micTrackRef.current, new MediaStream([micTrackRef.current]));
    sendersRef.current.set(id, { v: vSender, a: aSender });

    pc.onicecandidate = (e) => { if (e.candidate) socketRef.current.emit("signal", { target: id, data: e.candidate }); };
    pc.ontrack = (e) => {
      let st = streamsRef.current.get(id);
      if (!st) { st = new MediaStream(); streamsRef.current.set(id, st); }
      st.addTrack(e.track); force();
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) cleanupPeer(id);
    };

    pcsRef.current.set(id, pc);

    if (initiator) {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socketRef.current.emit("signal", { target: id, data: pc.localDescription });
    }
    return pc;
  }
  function cleanupPeer(id) {
    const pc = pcsRef.current.get(id); if (pc) { try { pc.close(); } catch {} pcsRef.current.delete(id); }
    const st = streamsRef.current.get(id); if (st) { st.getTracks().forEach(t => t.stop()); streamsRef.current.delete(id); }
    sendersRef.current.delete(id); pendingIceRef.current.delete(id); metaRef.current.delete(id);
    force();
  }
  const makeOffer = (id) => ensurePc(id, true);

  // --- Controls ---
  const toggleMic = () => {
    if (!micTrackRef.current) return;
    micTrackRef.current.enabled = !micTrackRef.current.enabled;
    setMicOn(!!micTrackRef.current.enabled);
    socketRef.current?.emit("media-state", { micOn: !!micTrackRef.current.enabled, camOn: camOn || sharing });
    rebuildPreview();
  };
  const toggleCam = () => {
    if (!camTrackRef.current) return;
    camTrackRef.current.enabled = !camTrackRef.current.enabled;
    setCamOn(!!camTrackRef.current.enabled);
    socketRef.current?.emit("media-state", { micOn, camOn: !!camTrackRef.current.enabled || sharing });
    rebuildPreview();
  };
  const shareScreen = async () => {
    try {
      if (!sharing) {
        const ds = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenTrackRef.current = ds.getVideoTracks()[0];
        pcsRef.current.forEach((pc, id) => {
          const s = sendersRef.current.get(id);
          if (s?.v) s.v.replaceTrack(screenTrackRef.current);
          else {
            const vSender = pc.addTrack(screenTrackRef.current, new MediaStream([screenTrackRef.current]));
            const prev = sendersRef.current.get(id) || {};
            sendersRef.current.set(id, { ...prev, v: vSender });
          }
        });
        setSharing(true);
        rebuildPreview();
        screenTrackRef.current.onended = () => stopShareInternal();
      } else stopShareInternal();
    } catch {}
  };
  const stopShareInternal = async () => {
    if (!camTrackRef.current || camTrackRef.current.readyState === "ended") {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ video: true });
        camTrackRef.current = ms.getVideoTracks()[0] || null;
      } catch {}
    }
    pcsRef.current.forEach((pc, id) => {
      const s = sendersRef.current.get(id);
      if (s?.v && camTrackRef.current) s.v.replaceTrack(camTrackRef.current);
    });
    stopTrack(screenTrackRef.current); screenTrackRef.current = null;
    setSharing(false); rebuildPreview();
  };
  const leave = () => {
    try { socketRef.current?.disconnect(); } catch {}
    pcsRef.current.forEach(pc => { try { pc.close(); } catch {} });
    stopTrack(camTrackRef.current); stopTrack(micTrackRef.current); stopTrack(screenTrackRef.current);
    nav("/dashboard", { replace: true });
  };

  // --- Tiles data ---
  const remoteTiles = Array.from(streamsRef.current.entries()).map(([id, stream]) => {
    const m = metaRef.current.get(id) || {};
    return { id, stream, name: m.name || "Guest", micOn: m.micOn !== false, camOn: m.camOn !== false };
  });
  const localVideoOn = sharing || (camOn && !!camTrackRef.current);
  const tiles = [{ id: "local", stream: localPreview, name: user?.name || "You", micOn, camOn: localVideoOn }, ...remoteTiles];

  // --- Responsive mosaic (handles 1 person beautifully) ---
  useLayoutEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver(() => setGrid(calcBestGrid(stageRef.current, tiles.length, MAX_COLS, GAP, PAD, ASPECT)));
    ro.observe(stageRef.current);
    setGrid(calcBestGrid(stageRef.current, tiles.length, MAX_COLS, GAP, PAD, ASPECT));
    return () => ro.disconnect();
  }, [tiles.length, openPanel]);

  // --- Chat helpers ---
  const sendChat = () => {
    const text = draft.trim(); if (!text) return;
    socketRef.current?.emit("chat", { text }); // server echoes to all (including me)
    setDraft(""); queueMicrotask(scrollChatToEnd);
  };
  const scrollChatToEnd = () => { const el = chatListRef.current; if (el) el.scrollTop = el.scrollHeight; };
  useEffect(() => { if (openPanel === "chat") { setChatUnread(0); scrollChatToEnd(); } }, [openPanel]);

  // --- Raise hand toggle ---
  const toggleHand = () => {
    const me = socketRef.current?.id;
    const has = hands.has(me);
    socketRef.current?.emit("raise-hand", { hand: !has });
    setHands(prev => { const n = new Set(prev); if (has) n.delete(me); else n.add(me); return n; });
  };

  // --- Settings modal handlers ---
  const openSettings = async () => {
    setShowSettings(true);
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        mics: list.filter(d => d.kind === "audioinput"),
        cams: list.filter(d => d.kind === "videoinput"),
        outs: list.filter(d => d.kind === "audiooutput"),
      });
      setSelIn({
        micId: micTrackRef.current?.getSettings?.().deviceId || "",
        camId: camTrackRef.current?.getSettings?.().deviceId || "",
      });
      setSelOut({ spkId: "" });
      const pv = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      previewStreamRef.current = pv;
      if (previewRef.current) previewRef.current.srcObject = pv;
    } catch {}
  };
  const closeSettings = () => {
    setShowSettings(false);
    if (previewStreamRef.current) { previewStreamRef.current.getTracks().forEach(t => t.stop()); previewStreamRef.current = null; }
  };
  const applySettings = async () => {
    try {
      const constraints = {
        video: selIn.camId ? { deviceId: { exact: selIn.camId } } : true,
        audio: selIn.micId ? { deviceId: { exact: selIn.micId } } : true,
      };
      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      const v = ms.getVideoTracks()[0] || null;
      const a = ms.getAudioTracks()[0] || null;

      if (v) {
        camTrackRef.current?.stop(); camTrackRef.current = v;
        pcsRef.current.forEach((pc, id) => { const s = sendersRef.current.get(id); if (s?.v) s.v.replaceTrack(v); });
      }
      if (a) {
        micTrackRef.current?.stop(); micTrackRef.current = a;
        pcsRef.current.forEach((pc, id) => { const s = sendersRef.current.get(id); if (s?.a) s.a.replaceTrack(a); });
      }
      if (selOut.spkId && "setSinkId" in HTMLMediaElement.prototype) {
        try { await (document.querySelector("video")?.setSinkId?.(selOut.spkId)); } catch {}
      }
      rebuildPreview();
      closeSettings();
    } catch {}
  };

  return (
    <div className={styles.shell}>
      {/* Top bar */}
      <div className={styles.top}>
        <div className={styles.left}>
          <div className={styles.badge}><span className={styles.dotRec}></span>Recording</div>
          <div className={styles.badge}>
            Speaker View:
            <button className={styles.arrow} onClick={() => setMode(m => m === "gallery" ? "speaker" : "gallery")}>
              {mode === "gallery" ? "On" : "Off"}
            </button>
          </div>
        </div>
        <div className={styles.right}><div className={styles.badge}>Code: <code>{code}</code></div></div>
      </div>

      {/* Stage (pads right when chat opens) */}
      <div ref={stageRef} className={`${styles.stage} ${openPanel ? styles.stagePad : ""}`}>
        {mode === "gallery" ? (
          <>
            {/* Pixel-measured grid so 1-person can be centered with a proper 16:9 size */}
            <div
              className={styles.grid}
              style={{
                gridTemplateColumns: `repeat(${grid.cols}, ${Math.floor(grid.tileW)}px)`,
                gridAutoRows: `${Math.floor(grid.tileH)}px`,
                gap: `${GAP}px`,
                padding: `${PAD}px`,
                placeContent: "center",
                gridAutoFlow: "row dense",
              }}
            >
              {tiles.map((t, idx) => (
                <Tile
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  stream={t.stream}
                  micOn={t.micOn}
                  camOn={t.camOn}
                  handUp={t.id === "local" ? hands.has(socketRef.current?.id) : hands.has(t.id)}
                  style={placeInLastRow(idx, tiles.length, grid.cols)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className={styles.speaker}>
            <div className={styles.active}>
              <Tile id={"local"} name={user?.name || "You"} stream={localPreview} micOn={micOn} camOn={localVideoOn} handUp={hands.has(socketRef.current?.id)} />
            </div>
            <div className={styles.filmstrip}>
              {remoteTiles.map(t => <Tile key={t.id} {...t} handUp={hands.has(t.id)} />)}
            </div>
          </div>
        )}

        {/* Chat drawer */}
        <div className={`${styles.panel} ${openPanel === 'chat' ? styles.open : ''}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Chat</div>
            <button className={styles.closeBtn} onClick={() => setOpenPanel(null)}>Close</button>
          </div>
          <div ref={chatListRef} className={`${styles.panelBody} ${styles.chatList}`}>
            {msgs.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.me ? 'flex-end' : 'flex-start' }}>
                <div className={`${styles.msg} ${m.me ? styles.mine : ''}`}>
                  <div>{m.text}</div>
                  <div className={styles.meta}>{m.me ? 'You' : m.name} • {new Date(m.ts).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.panelFooter}>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Type a message…"
                onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
              />
              <button className={styles.send} onClick={sendChat}>Send</button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom controls (Settings → Mute → Stop Video → Chat → Share Screen → Raise Hand → Leave) */}
      <div className={styles.controls}>
        <div className={styles.group}>
          <button className={styles.btn} onClick={openSettings}>Settings</button>
          <button className={`${styles.btn} ${micOn ? "" : styles.muted}`} onClick={toggleMic}>{micOn ? "Mute" : "Unmute"}</button>
          <button className={`${styles.btn} ${ (sharing || (camOn && !!camTrackRef.current)) ? "" : styles.muted}`} onClick={toggleCam}>
            {(sharing || (camOn && !!camTrackRef.current)) ? "Stop Video" : "Start Video"}
          </button>
          <button className={styles.btn} onClick={() => { setOpenPanel(p => p === 'chat' ? null : 'chat'); setChatUnread(0); }}>
            Chat <span className={styles.badgeNum}>{chatUnread}</span>
          </button>
          <button className={`${styles.btn} ${styles.live}`} onClick={shareScreen}>{sharing ? "Stop Share" : "Share Screen"}</button>
          <button className={styles.btn} onClick={toggleHand}>{hands.has(socketRef.current?.id) ? "Lower Hand" : "Raise Hand ✋"}</button>
        </div>
        <div className={styles.group}>
          <button className={`${styles.btn} ${styles.danger}`} onClick={leave}>Leave</button>
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <strong>Device settings</strong>
              <button className={styles.closeBtn} onClick={closeSettings}>Close</button>
            </div>
            <div className={styles.grid2}>
              <div>
                <label>Camera</label>
                <select className={styles.select} value={selIn.camId} onChange={e => setSelIn(p => ({ ...p, camId: e.target.value }))}>
                  <option value="">Default</option>
                  {devices.cams.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>)}
                </select>
              </div>
              <div>
                <label>Microphone</label>
                <select className={styles.select} value={selIn.micId} onChange={e => setSelIn(p => ({ ...p, micId: e.target.value }))}>
                  <option value="">Default</option>
                  {devices.mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
                </select>
              </div>
              <div>
                <label>Speaker</label>
                <select className={styles.select} value={selOut.spkId} onChange={e => setSelOut({ spkId: e.target.value })}>
                  <option value="">Default</option>
                  {devices.outs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Speaker'}</option>)}
                </select>
              </div>
              <div>
                <video ref={previewRef} className={styles.preview} autoPlay playsInline muted />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className={styles.applyBtn} onClick={applySettings}>Apply</button>
              <button className={styles.closeBtn} onClick={closeSettings}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= Mosaic helpers ======================= */

/**
 * Compute best grid + exact pixel tile size so we can center a single
 * participant cleanly, and leave elegant empty space like Zoom.
 */
function calcBestGrid(stageEl, count, maxCols, gap, pad, aspect) {
  if (!stageEl) return { cols: 1, rows: 1, tileW: 640, tileH: 360 };
  const W = stageEl.clientWidth  - pad * 2;
  const H = stageEl.clientHeight - pad * 2;
  const max = Math.min(maxCols, Math.max(1, count));

  let best = { cols: 1, rows: count || 1, tileW: 640, tileH: 360, score: 0 };

  for (let cols = 1; cols <= max; cols++) {
    const rows = Math.ceil(count / cols);

    // Width-constrained tile size
    const tW_byW = (W - gap * (cols - 1)) / cols;
    const tH_byW = tW_byW / aspect;

    // Height-constrained tile size
    const tH_byH = (H - gap * (rows - 1)) / rows;
    const tW_byH = tH_byH * aspect;

    // Final tile fits both
    const tileW = Math.min(tW_byW, tW_byH);
    const tileH = tileW / aspect;
    const score = tileW * tileH;

    // Prefer odd columns when last row has a single tile (nicer centering)
    const lastCount = count - cols * (rows - 1);
    const oddBonus = (lastCount === 1 && cols % 2 === 1) ? 0.1 : 0;

    if (score + oddBonus > best.score) best = { cols, rows, tileW, tileH, score };
  }

  // If last row single & columns even, nudge to next odd if possible
  const lastCount = count - best.cols * (best.rows - 1);
  if (lastCount === 1 && best.cols < max && best.cols % 2 === 0) {
    best.cols += 1;
    best.rows = Math.ceil(count / best.cols);
    // Recompute tile size for adjusted cols
    const tW = (W - gap * (best.cols - 1)) / best.cols;
    const tH = (H - gap * (best.rows - 1)) / best.rows;
    const tileW = Math.min(tW, tH * aspect);
    best.tileW = tileW;
    best.tileH = tileW / aspect;
  }

  // Soft cap to avoid comically large solo tile on ultra-wide screens
  if (count === 1) {
    const SOLO_MAX_W = Math.min(1280, W); // up to 1280px wide or container width
    best.tileW = Math.min(best.tileW, SOLO_MAX_W);
    best.tileH = best.tileW / aspect;
  }

  return { cols: best.cols, rows: best.rows, tileW: best.tileW, tileH: best.tileH };
}

// Center the last row items (2 items centered in 4 cols, 1 spans/centers, etc.)
function placeInLastRow(index, total, cols) {
  const rows = Math.ceil(total / cols);
  const lastCount = total - cols * (rows - 1);
  if (lastCount === 0 || lastCount === cols) return {};
  const inLast = index >= (rows - 1) * cols;
  if (!inLast) return {};

  const pos = index - (rows - 1) * cols; // 0..lastCount-1
  const first = Math.floor((cols - lastCount) / 2) + 1;
  return { gridColumn: `${first + pos} / span 1`, gridRow: `${rows}` };
}

/* ========================= Tile ========================= */
function Tile({ id, name, stream, micOn, camOn, handUp, style }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
  const initials = (name || "U").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className={styles.tile} style={style} data-id={id}>
      {camOn && stream ? (
        <video className={styles.video} ref={ref} autoPlay playsInline muted={id === "local"} />
      ) : (
        <div className={styles.avatar}>{initials}</div>
      )}
      <div className={styles.nameTag}>{name}</div>
      {!micOn && <div className={styles.mic}>🔇</div>}
      {handUp && <div className={styles.hand}>✋</div>}
    </div>
  );
}
