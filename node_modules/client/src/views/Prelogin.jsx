import styles from "./Prelogin.module.css";

export default function Prelogin() {
  return (
    <main className={styles.wrap}>
      <section className={styles.card} aria-label="Confera prelogin">
        <header className={styles.brand}>
          <div className={styles.logoText}>confera</div>
          <div className={styles.workplace}>Workplace</div>
        </header>

        <div className={styles.actions}>
          <a className={styles.primary} href="/register">Register</a>
          <a className={styles.secondary} href="/signin">Sign In</a>
        </div>

        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} Confera</span>
          <span className={styles.dot} aria-hidden>•</span>
          <a href="/privacy">Privacy</a>
          <span className={styles.dot} aria-hidden>•</span>
          <a href="/terms">Terms</a>
        </footer>
      </section>
    </main>
  );
}
