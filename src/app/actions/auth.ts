"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AUTH_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function signUp(formData: FormData) {
  const ip = await getClientIp();
  if (!rateLimit(`auth:signup:${ip}`, AUTH_LIMIT).success) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validation
  if (!firstName || !lastName) {
    return { error: "First name and last name are required" };
  }

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/onboarding`,
      data: { first_name: firstName, last_name: lastName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Only redirect if signup was successful
  if (data.user) {
    logAudit("auth.signup", { userId: data.user.id, details: { email } });
    revalidatePath("/", "layout");
    redirect("/onboarding");
  }

  return { error: "Something went wrong. Please try again." };
}

export async function signIn(formData: FormData) {
  const ip = await getClientIp();
  if (!rateLimit(`auth:signin:${ip}`, AUTH_LIMIT).success) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = formData.get("redirect") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logAudit("auth.signin_failed", { details: { email, reason: error.message } });
    return { error: error.message };
  }

  logAudit("auth.signin", { details: { email } });
  revalidatePath("/", "layout");

  // If a specific redirect was requested (not just /dashboard), honor it
  if (redirectTo && redirectTo !== "/dashboard") {
    redirect(redirectTo);
  }

  // Check onboarding status — redirect new users to onboarding
  const userId = signInData.user?.id;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", userId)
      .single();

    if (!profile?.onboarding_completed_at) {
      redirect("/onboarding");
    }
  }

  redirect("/dashboard");
}

export async function signOut() {
  logAudit("auth.signout");
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function forgotPassword(formData: FormData) {
  const ip = await getClientIp();
  if (!rateLimit(`auth:forgot:${ip}`, AUTH_LIMIT).success) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();

  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  logAudit("auth.password_reset_requested", { details: { email } });
  return { success: true };
}

export async function resetPassword(formData: FormData) {
  const ip = await getClientIp();
  if (!rateLimit(`auth:reset:${ip}`, AUTH_LIMIT).success) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password) {
    return { error: "Password is required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  logAudit("auth.password_reset");
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function completeOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  logAudit("onboarding.completed", { entityType: "profile" });
  revalidatePath("/", "layout");
  return { success: true };
}
