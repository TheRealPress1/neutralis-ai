"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthListener() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    // Parse hash fragment: #access_token=...&type=recovery&refresh_token=...
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (!accessToken || !refreshToken) return;

    const supabase = createClient();

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          console.error("Failed to set session:", error.message);
          return;
        }
        // Clear the hash so tokens aren't visible in the URL
        window.history.replaceState(null, "", window.location.pathname);

        if (type === "recovery") {
          window.location.href = "/reset-password";
        } else {
          window.location.href = "/dashboard";
        }
      });
  }, []);

  return null;
}
