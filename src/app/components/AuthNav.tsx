"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import Link from "next/link";

export default function AuthNav() {
  const [user, setUser] = useState<any>(null);
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
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1d21] border border-[#22262d] text-sm font-semibold text-[#eceef0] transition-colors hover:border-[#c0c5cb]/40 hover:text-white"
        >
          {initial}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#22262d] bg-[#0e1117] p-1.5 shadow-xl shadow-black/40">
            <p className="px-3 py-2 text-xs text-[#a1a8b3] truncate">
              {user.email}
            </p>
            <div className="my-1 h-px bg-[#22262d]" />
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-[#eceef0] transition-colors hover:bg-[#1a1d21]"
            >
              My Portfolio
            </Link>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-[#a1a8b3] transition-colors hover:bg-[#1a1d21] hover:text-[#eceef0]"
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
          className="btn-sheen btn-pill bg-[#e8e9ea] px-5 py-2 text-sm font-medium text-[#050608] transition-all duration-250 ease-out hover:-translate-y-[1px] hover:bg-[#c0c5cb] hover:shadow-[0_0_12px_rgba(232,233,234,0.3)]"
        >
          Sign up
        </Link>
      </li>
    </>
  );
}
