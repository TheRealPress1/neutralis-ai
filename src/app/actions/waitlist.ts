"use server";

import { createClient } from "@/lib/supabase/server";

export type WaitlistState = {
  success: boolean;
  error: string | null;
};

export async function joinWaitlist(
  _prevState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = formData.get("email");

  if (typeof email !== "string" || !email) {
    return { success: false, error: "Email is required." };
  }

  // Basic server-side email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const supabase = await createClient();

  const { error } = await (supabase as any).from("waitlist").insert({ email });

  if (error) {
    // Unique constraint violation — email already exists
    if (error.code === "23505") {
      return { success: true, error: null };
    }
    return { success: false, error: "Something went wrong. Please try again." };
  }

  return { success: true, error: null };
}
