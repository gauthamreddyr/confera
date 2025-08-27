import styles from "./QuickActions.module.css";
import { useNavigate } from "react-router-dom";

export default function QuickActions(){
  const nav = useNavigate();
  return (
    <section className={styles.card} aria-labelledby="qa-title">
      <h2 id="qa-title" className={styles.title}>Quick actions</h2>
      <div className={styles.row}>
        <button className={`${styles.btn} ${styles.primary}`} onClick={()=>nav("/join")}>New Meeting</button>
        <button className={styles.btn} onClick={()=>nav("/join")}>Join</button>
        <button className={styles.btn} onClick={()=>nav("/join#schedule")}>Schedule</button>
      </div>
    </section>
  );
}
