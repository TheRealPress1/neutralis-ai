"use client";

import { useState, useEffect, useRef } from "react";

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
      className={`fixed top-0 z-50 w-full border-b transition-all duration-300 relative overflow-hidden ${
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
        <a
          href="#"
          className="text-lg font-semibold tracking-tight text-white/90"
        >
          Neutralis.ai
        </a>

        <ul className="hidden gap-6 text-sm font-medium text-white/70 sm:flex">
          <li>
            <a
              href="#outputs"
              className="nav-link-glow transition-all duration-250 ease-out hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
            >
              Outputs
            </a>
          </li>
          <li>
            <a
              href="#method"
              className="nav-link-glow transition-all duration-250 ease-out hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
            >
              Method
            </a>
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
        </ul>

        <a
          href="#waitlist"
          className="btn-sheen btn-pill bg-[#e8e9ea] px-5 py-2 text-sm font-medium text-[#050608] transition-all duration-250 ease-out hover:-translate-y-[1px] hover:bg-[#c0c5cb] hover:shadow-[0_0_12px_rgba(232,233,234,0.3)]"
        >
          Request access
        </a>
      </div>
    </nav>
  );
}
