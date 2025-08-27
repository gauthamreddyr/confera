import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import s from "../styles/MeetingForm.module.css";
import { createMeeting, joinMeeting } from "../lib/meetings.js";

const cleanCode = (v) =>
  String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

const formatCode = (raw) =>
  cleanCode(raw)
    .replace(/(.{4})/g, "$1-")
    .replace(/-$/, "");

export default function JoinMeeting() {
  const nav = useNavigate();

  // JOIN state
  const [code, setCode] = useState("");
  const [joinPwd, setJoinPwd] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [err, setErr] = useState("");

  // CREATE state (optional side card)
  const [topic, setTopic] = useState("Instant meeting");
  const [newPwd, setNewPwd] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const codeRef = useRef(null);
  useEffect(() => { codeRef.current?.focus(); }, []);

  const onCodeChange = (e) => setCode(formatCode(e.target.value));
  const onCodePaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (text) {
      e.preventDefault();
      setCode(formatCode(text));
    }
  };

  const isCodeValid = cleanCode(code).length === 12;

  const doJoin = async (e) => {
    e?.preventDefault();
    if (!isCodeValid || joinBusy) return;
    setErr("");
    setJoinBusy(true);
    try {
      await joinMeeting(cleanCode(code), joinPwd);
      nav(`/meet/${cleanCode(code)}`);
    } catch (ex) {
      setErr(ex.message || "Failed to join meeting.");
    } finally {
      setJoinBusy(false);
    }
  };

  const doCreate = async () => {
    if (createBusy) return;
    setErr("");
    setCreateBusy(true);
    try {
      const { meeting } = await createMeeting(topic || "Instant meeting", newPwd || "");
      nav(`/meet/${meeting.code}`);
    } catch (ex) {
      setErr(ex.message || "Failed to create meeting.");
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <main className={s.wrap}>
      <div className={s.columns}>
        {/* Join card */}
        <section className={s.card}>
          <header className={s.header}>
            <h1 className={s.h1}>Join a meeting</h1>
            <p className={s.sub}>Enter the meeting code your host shared</p>
          </header>

          <form className={s.form} onSubmit={doJoin}>
            <label className={s.label} htmlFor="code">Meeting code</label>
            <div className={s.codeRow}>
              <input
                id="code"
                ref={codeRef}
                className={`${s.input} ${s.code}`}
                value={code}
                onChange={onCodeChange}
                onPaste={onCodePaste}
                placeholder="ABCD-EFGH-1234"
                inputMode="text"
                autoComplete="off"
                spellCheck="false"
                maxLength={14}
              />
              <span className={`${s.badge} ${isCodeValid ? s.ok : s.warn}`}>
                {isCodeValid ? "✓" : "•••"}
              </span>
            </div>

            <label className={s.label} htmlFor="joinPwd">
              Password <span className={s.muted}>(if required)</span>
            </label>
            <PasswordInput
              id="joinPwd"
              value={joinPwd}
              onChange={setJoinPwd}
              placeholder="Optional"
            />

            {err && <div className={s.error}>{err}</div>}

            <button
              className={s.primary}
              disabled={!isCodeValid || joinBusy}
              type="submit"
            >
              {joinBusy ? "Joining…" : "Join meeting"}
            </button>
          </form>

          <footer className={s.footer}>
            <span className={s.help}>Tip: you can paste the whole code — we’ll format it.</span>
          </footer>
        </section>

        {/* Create card (optional) */}
        <aside className={`${s.card} ${s.secondary}`}>
          <header className={s.header}>
            <h2 className={s.h2}>Start a new meeting</h2>
            <p className={s.sub}>Instantly generate a shareable code</p>
          </header>

          <div className={s.form}>
            <label className={s.label} htmlFor="topic">Topic</label>
            <input
              id="topic"
              className={s.input}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Team sync"
              maxLength={80}
            />

            <label className={s.label} htmlFor="newPwd">
              Password <span className={s.muted}>(optional)</span>
            </label>
            <PasswordInput
              id="newPwd"
              value={newPwd}
              onChange={setNewPwd}
              placeholder="Add a password"
            />

            <button
              className={s.outline}
              onClick={doCreate}
              disabled={createBusy}
              type="button"
            >
              {createBusy ? "Creating…" : "Start now"}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ---------- Small reusable password field ---------- */
function PasswordInput({ id, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className={s.passRow}>
      <input
        id={id}
        className={s.input}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button type="button" className={s.eye} onClick={() => setShow((x) => !x)}>
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
