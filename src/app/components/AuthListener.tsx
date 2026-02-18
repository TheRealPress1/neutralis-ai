"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push("/reset-password");
      } else if (event === "SIGNED_IN") {
        // Hash-based sign-in from email confirmation
        if (window.location.hash.includes("access_token")) {
          router.push("/dashboard");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
