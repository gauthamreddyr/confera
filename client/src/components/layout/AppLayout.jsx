import styles from "./AppLayout.module.css";
import Header from "./Header.jsx";
import Sidebar from "./Sidebar.jsx";

export default function AppLayout({ children, active = "dashboard" }) {
  return (
    <div className={styles.shell}>
      <Header />
      <Sidebar active={active} />
      <main className={styles.content} role="main">
        {children}
      </main>
    </div>
  );
}
