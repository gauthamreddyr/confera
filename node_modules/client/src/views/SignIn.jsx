import { useEffect, useState } from "react";
import f from "../styles/AuthForm.module.css";
import { isEmail } from "../lib/validators.js";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function SignIn(){
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState(loc.state?.email || "");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState("");

  useEffect(()=>{
    if (loc.state?.justRegistered) {
      setFlash("Account created. You can sign in now.");
      // clear history state so banner doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [loc.state]);

  const emailOk = isEmail(email);

  async function onSubmit(e){
    e.preventDefault();
    setErr("");

    if (!emailOk || !pw){
      setShake(true); setTimeout(()=>setShake(false),180);
      setErr("Please enter a valid email and password.");
      return;
    }

    try{
      setBusy(true);
      await login(email.trim(), pw);       // sets cookie-backed session via API
      nav("/dashboard", { replace: true }); // redirect after successful login
    }catch(ex){
      setErr(ex.message || "Sign in failed.");
      setShake(true); setTimeout(()=>setShake(false),180);
    }finally{
      setBusy(false);
    }
  }

  return (
    <main className={f.wrap}>
      <section className={f.panel}>
        <div className={f.brand}>
          <div className={f.logo}>confera</div>
          <div className={f.heading}>Sign in</div>
        </div>

        <form className={f.form} onSubmit={onSubmit} noValidate>
          {flash && (
            <div
              style={{
                color:"#065f46",
                background:"#ecfdf5",
                border:"1px solid #a7f3d0",
                padding:"10px 12px",
                borderRadius:8,
                fontSize:14
              }}
            >
              {flash}
            </div>
          )}

          <div className={f.group}>
            <label className={f.label} htmlFor="email">Email</label>
            <input
              id="email"
              className={f.input}
              value={email}
              onChange={e=>setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              aria-invalid={email && !emailOk ? "true" : "false"}
            />
            {!emailOk && email && <div className={f.error}>Enter a valid email.</div>}
          </div>

          <div className={f.group}>
            <label className={f.label} htmlFor="pw">Password</label>
            <div className={f.passwordRow}>
              <input
                id="pw"
                className={f.input}
                style={{flex:1}}
                value={pw}
                onChange={e=>setPw(e.target.value)}
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
              />
              <button type="button" className={f.toggle} onClick={()=>setShowPw(s=>!s)} aria-pressed={showPw}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {err && <div className={f.error} role="alert">{err}</div>}

          <button className={`${f.submit} ${shake ? f.shake : ""}`} disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div className={f.secondaryLink}>
            New here? <Link to="/register">Create an account</Link>
          </div>
        </form>

        <footer className={f.footer}>
          <span>© {new Date().getFullYear()} Confera</span>
          <span aria-hidden>•</span><a href="/privacy">Privacy</a>
          <span aria-hidden>•</span><a href="/terms">Terms</a>
        </footer>
      </section>
    </main>
  );
}
