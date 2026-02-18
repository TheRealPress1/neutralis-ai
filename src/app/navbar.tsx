"use client";

import { useState, useEffect, useRef } from "react";
import AuthNav from "./components/AuthNav";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const nav = navRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    nav.style.setProperty("--spotlight-x", e.clientX - rect.left + "px");
    nav.style.setProperty("--spotlight-y", e.clientY - rect.top + "px");
  };

  return (
    <nav
      ref={navRef}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onMouseMove={handleMouseMove}
      className={`fixed top-0 z-50 w-full border-b transition-all duration-300 relative ${
        scrolled
          ? "border-white/10 bg-black/30 backdrop-blur-xl"
          : "border-white/[0.06] bg-black/15 backdrop-blur-[10px]"
      }`}
    >
      <div
        className={`nav-spotlight pointer-events-none absolute -inset-4 z-0 transition-opacity duration-300 ${
          hovering ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-[family-name:var(--font-italiana)] text-xl font-normal tracking-[0.08em] text-white/90"
        >
          Neutralis.ai
        </Link>

        <ul className="hidden items-center gap-6 text-sm font-medium text-white/70 sm:flex">
          <li>
            <a
              href="#features"
              className="nav-link-glow transition-all duration-250 ease-out hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
            >
              Features
            </a>
          </li>
          <li>
            <Link
              href="/docs"
              className="nav-link-glow transition-all duration-250 ease-out hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
            >
              How it Works
            </Link>
          </li>
          <li>
            <a
              href="#waitlist"
              className="nav-link-glow transition-all duration-250 ease-out hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
            >
              Waitlist
            </a>
          </li>
          <li>
            <a
              href="/dashboard"
              className="nav-link-glow transition-all duration-250 ease-out hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
            >
              Dashboard
            </a>
          </li>
          <AuthNav />
        </ul>

        <div className="flex items-center gap-4 text-sm font-medium text-white/70 sm:hidden">
          <AuthNav />
        </div>
      </div>
    </nav>
  );
}
