import { useMemo, useState } from "react";
import styles from "./UpcomingTable.module.css";

const sample = [
  { id: "A8XP12", topic: "Weekly Stand-up", time: "Today, 4:00 PM", duration: "30 min", host: "You" },
  { id: "BR934Q", topic: "Client Review – Q3", time: "Tue, 11:30 AM", duration: "45 min", host: "You" },
  { id: "K1M7Z2", topic: "Product Sync", time: "Fri, 10:00 AM", duration: "60 min", host: "You" },
];

export default function UpcomingTable(){
  const [rows] = useState(sample);
  const links = useMemo(() => {
    const base = "https://confera.app/meet/";
    const o = {}; rows.forEach(r => { o[r.id] = base + r.id; });
    return o;
  }, [rows]);

  const copy = async (id) => {
    try{
      await navigator.clipboard.writeText(links[id]);
      alert("Link copied: " + links[id]);
    }catch{
      alert("Copy failed");
    }
  };

  const start = (id) => {
    // integrate your real route later
    alert("Starting meeting " + id);
  };

  return (
    <section className={styles.card} aria-labelledby="up-title">
      <h2 id="up-title" className={styles.title}>Upcoming meetings</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Time</th>
              <th>Duration</th>
              <th>Meeting ID</th>
              <th aria-label="actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className={styles.topic}>
                  <div className={styles.topicMain}>{r.topic}</div>
                  <div className={styles.sub}>Host: {r.host}</div>
                </td>
                <td>{r.time}</td>
                <td>{r.duration}</td>
                <td><code>{r.id}</code></td>
                <td className={styles.actions}>
                  <button className={`${styles.btn} ${styles.primary}`} onClick={()=>start(r.id)}>Start</button>
                  <button className={styles.btn} onClick={()=>copy(r.id)}>Copy Link</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
