"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthNav() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await signOut();
  }

  if (loading) {
    return null;
  }

  const dashboardLink = (
    <Link
      href="/dashboard"
      className="nav-link-glow transition-all duration-250 ease-out hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
    >
      Dashboard
    </Link>
  );

  const signOutButton = (
    <button
      onClick={handleSignOut}
      className="nav-link-glow transition-all duration-250 ease-out hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
    >
      Sign out
    </button>
  );

  const signInLink = (
    <Link
      href="/login"
      className="nav-link-glow transition-all duration-250 ease-out hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
    >
      Sign in
    </Link>
  );

  const signUpLink = (
    <Link
      href="/signup"
      className="btn-sheen btn-pill bg-[#e8e9ea] px-5 py-2 text-sm font-medium text-[#050608] transition-all duration-250 ease-out hover:-translate-y-[1px] hover:bg-[#c0c5cb] hover:shadow-[0_0_12px_rgba(232,233,234,0.3)]"
    >
      Sign up
    </Link>
  );

  if (user) {
    return (
      <>
        <li>{dashboardLink}</li>
        <li>{signOutButton}</li>
      </>
    );
  }

  return (
    <>
      <li>{signInLink}</li>
      <li>{signUpLink}</li>
    </>
  );
}
