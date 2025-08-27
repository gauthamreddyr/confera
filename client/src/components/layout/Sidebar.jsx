import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

const items = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "meetings", label: "Meetings", href: "#meetings" },
  { key: "recordings", label: "Recordings", href: "#recordings" },
  { key: "contacts", label: "Contacts", href: "#contacts" },
  { key: "settings", label: "Settings", href: "#settings" },
];

export default function Sidebar({ active = "dashboard" }) {
  return (
    <aside className={`${styles.sidebar} sidebar-area`} aria-label="Primary">
      <nav className={styles.nav}>
        {items.map((it) => (
          <NavLink
            key={it.key}
            to={it.href}
            className={({ isActive }) =>
              `${styles.item} ${active === it.key || isActive ? styles.active : ""}`
            }
          >
            <span className={styles.dot} aria-hidden>•</span>
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
