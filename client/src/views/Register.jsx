import { useState } from "react";
import f from "../styles/AuthForm.module.css";
import { isEmail, passwordIssues } from "../lib/validators.js";
import { registerUser } from "../lib/auth.js";
import { Link, useNavigate } from "react-router-dom";

export default function Register(){
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [cpw, setCpw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  const emailOk = isEmail(email);
  const pwIssues = passwordIssues(pw);
  const pwOk = pwIssues.length === 0;
  const match = pw && cpw && pw === cpw;

  async function onSubmit(e){
    e.preventDefault();
    setErr("");

    if (!name.trim() || !emailOk || !pwOk || !match){
      setShake(true); setTimeout(()=>setShake(false),180);
      setErr("Please fix the highlighted fields.");
      return;
    }

    try{
      setBusy(true);
      await registerUser({ name: name.trim(), email: email.trim(), password: pw });
      // Go to sign-in with a flash message + prefill email
      nav("/signin", { state: { justRegistered: true, email } });
    }catch(ex){
      setErr(ex.message || "Registration failed.");
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
          <div className={f.heading}>Create your account</div>
        </div>

        <form className={f.form} onSubmit={onSubmit} noValidate>
          <div className={f.group}>
            <label className={f.label} htmlFor="name">Full name</label>
            <input
              id="name"
              className={f.input}
              value={name}
              onChange={e=>setName(e.target.value)}
              placeholder="Jane Doe"
              aria-invalid={!name.trim() ? "true" : "false"}
            />
            {!name.trim() && <div className={f.error}>Name is required.</div>}
          </div>

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
                aria-invalid={pw && !pwOk ? "true" : "false"}
              />
              <button type="button" className={f.toggle} onClick={()=>setShowPw(s=>!s)} aria-pressed={showPw}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {pw && pwIssues.length > 0 && (
              <div className={f.error}>Password needs: {pwIssues.join(", ")}.</div>
            )}
          </div>

          <div className={f.group}>
            <label className={f.label} htmlFor="cpw">Confirm password</label>
            <input
              id="cpw"
              className={f.input}
              value={cpw}
              onChange={e=>setCpw(e.target.value)}
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              aria-invalid={cpw && !match ? "true" : "false"}
            />
            {cpw && !match && <div className={f.error}>Passwords don’t match.</div>}
          </div>

          {err && <div className={f.error} role="alert">{err}</div>}

          <button className={`${f.submit} ${shake ? f.shake : ""}`} disabled={busy} type="submit">
            {busy ? "Creating…" : "Create account"}
          </button>

          <div className={f.secondaryLink}>
            Already have an account? <Link to="/signin">Sign in</Link>
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
