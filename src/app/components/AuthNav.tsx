"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

export default function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
  }

  if (loading) {
    return null;
  }

  if (user) {
    const initial = (user.email?.[0] ?? "U").toUpperCase();

    return (
      <li className="relative list-none" ref={dropdownRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-elevated border border-border text-sm font-semibold text-text-primary transition-colors hover:border-neon-green/40 hover:text-neon-green"
        >
          {initial}
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-border bg-bg-primary p-1.5 shadow-xl shadow-black/40">
            <p className="px-3 py-2 text-xs text-text-secondary truncate">
              {user.email}
            </p>
            <div className="my-1 h-px bg-border" />
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-elevated"
            >
              My Portfolio
            </Link>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-elevated"
            >
              My Profile
            </Link>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={handleSignOut}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
            >
              Sign out
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <>
      <li>
        <Link
          href="/login"
          className="nav-link-glow transition-all duration-250 ease-out hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
        >
          Sign in
        </Link>
      </li>
      <li>
        <Link
          href="/signup"
          className="btn-sheen btn-pill border border-neon-green/50 bg-neon-green/10 px-5 py-2 text-sm font-medium text-neon-green transition-all duration-250 ease-out hover:-translate-y-[1px] hover:bg-neon-green/20 hover:shadow-[0_0_12px_rgba(0,255,170,0.3)]"
        >
          Sign up
        </Link>
      </li>
    </>
  );
}
