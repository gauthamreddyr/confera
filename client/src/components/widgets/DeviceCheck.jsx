import { useState } from "react";
import styles from "./DeviceCheck.module.css";

export default function DeviceCheck(){
  const [camOk, setCamOk] = useState(null);
  const [micOk, setMicOk] = useState(null);
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
      setCamOk(stream.getVideoTracks().length > 0);
      setMicOk(stream.getAudioTracks().length > 0);
      stream.getTracks().forEach(t => t.stop());
    }catch{
      setCamOk(false);
      setMicOk(false);
    }finally{
      setChecking(false);
    }
  };

  return (
    <section className={styles.card} aria-labelledby="dc-title">
      <h2 id="dc-title" className={styles.title}>Device check</h2>
      <div className={styles.rows}>
        <Status label="Camera" ok={camOk} />
        <Status label="Microphone" ok={micOk} />
      </div>
      <button className={`${styles.btn} ${styles.primary}`} onClick={runCheck} disabled={checking}>
        {checking ? "Checking…" : "Run check"}
      </button>
    </section>
  );
}

function Status({ label, ok }){
  let text = "Not checked", color = "#64748b";
  if (ok === true) { text = "Ready"; color = "#166534"; }
  if (ok === false){ text = "Issue"; color = "#b91c1c"; }
  return (
    <div className={styles.status}>
      <span className={styles.badge} style={{background: ok ? "#dcfce7" : ok === false ? "#fee2e2" : "#e5e7eb", color}}>
        {ok ? "OK" : ok === false ? "ERR" : "—"}
      </span>
      <div className={styles.label}>{label}</div>
      <div className={styles.hint} style={{color}}>{text}</div>
    </div>
  );
}
