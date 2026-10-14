"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "../../landing.module.css";

export default function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    nav.current?.querySelector<HTMLAnchorElement>("#landing-navigation a")?.focus();
    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); menuButton.current?.focus(); }
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !nav.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", dismiss); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  return (
    <nav ref={nav} className={styles.nav} aria-label="Main navigation">
      <div className={styles.navInner}>
        <Link href="/" className={styles.brand} aria-label="Neutralis home">Neutralis.ai</Link>
        <div id="landing-navigation" className={`${styles.navLinks} ${open ? styles.navLinksOpen : ""}`}>
          <a href="#terminal" onClick={() => setOpen(false)}>The terminal <span className={styles.navNew}>EXPLORE</span></a>
          <a href="#features" onClick={() => setOpen(false)}>Features</a>
          <Link href="/pricing" onClick={() => setOpen(false)}>Pricing</Link>
          <Link href="/docs" onClick={() => setOpen(false)}>Docs <span className={styles.navExternal}>↗</span></Link>
          <Link href={signedIn ? "/dashboard" : "/login"} className={styles.mobileSignIn} onClick={() => setOpen(false)}>{signedIn ? "Dashboard" : "Sign in"}</Link>
        </div>
        <div className={styles.navActions}>
          <Link href={signedIn ? "/dashboard" : "/login"} className={styles.signIn}>{signedIn ? "Dashboard" : "Sign in"}</Link>
          <Link href={signedIn ? "/dashboard" : "/signup"} className={styles.navCta}>{signedIn ? "Open terminal" : "Get started"}<span>↗</span></Link>
          <button ref={menuButton} type="button" className={styles.menuButton} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="landing-navigation" onClick={() => setOpen(!open)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{open ? <path d="m5 5 10 10M5 15 15 5" /> : <path d="M3 6h14M3 10h14M3 14h14" />}</svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
