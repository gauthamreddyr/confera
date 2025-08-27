import { useAuth } from "../../context/AuthContext.jsx";
import styles from "./Header.module.css";
import { useNavigate } from "react-router-dom";
import { createMeeting } from "../../lib/meetings.js";
import { useState } from "react";

export default function Header(){
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    await logout();
    nav("/signin", { replace: true });
  };

  const onNewMeeting = async () => {
    try{
      setBusy(true);
      const { meeting } = await createMeeting({ topic: "Instant meeting", password: "" });
      nav(`/meet/${meeting.code}`);
    }catch(ex){
      alert(ex.message || "Could not create meeting");
    }finally{
      setBusy(false);
    }
  };

  return (
    <header className={`${styles.header} header-area`}>
      <div className={styles.brand}>
        <span className={styles.logo}>confera</span>
      </div>

      <div className={styles.searchWrap}>
        <input className={styles.search} placeholder="Search meetings, recordings, contacts" />
      </div>

      <div className={styles.actions}>
        <button className={styles.primary} onClick={onNewMeeting} disabled={busy}>
          {busy ? "Starting…" : "New Meeting"}
        </button>
        <div className={styles.user}>
          <div className={styles.avatar}>{(user?.name || "U").slice(0,1).toUpperCase()}</div>
          <div className={styles.meta}>
            <div className={styles.name}>{user?.name || "User"}</div>
            <div className={styles.email}>{user?.email}</div>
          </div>
          <button className={styles.signout} onClick={onLogout}>Sign out</button>
        </div>
      </div>
    </header>
  );
}
