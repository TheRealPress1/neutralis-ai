"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", profile: null };

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, email, full_name, first_name, last_name, date_of_birth, subscription_tier, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error) return { error: error.message, profile: null };
  return { profile: data };
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const firstName = (formData.get("first_name") as string)?.trim() ?? "";
  const lastName = (formData.get("last_name") as string)?.trim() ?? "";
  const dateOfBirth = (formData.get("date_of_birth") as string)?.trim() || null;

  const { error } = await (supabase as any)
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: [firstName, lastName].filter(Boolean).join(" "),
      date_of_birth: dateOfBirth,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: true };
}

export async function updateEmail(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const newEmail = (formData.get("email") as string)?.trim();
  if (!newEmail) return { error: "Email is required" };

  if (newEmail === user.email) {
    return { error: "New email is the same as your current email" };
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) return { error: error.message };

  return {
    success: true,
    message:
      "Confirmation email sent — check your new inbox to verify the change.",
  };
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword) {
    return { error: "All password fields are required" };
  }

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match" };
  }

  // Verify current password by re-authenticating
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (signInError) {
    return { error: "Current password is incorrect" };
  }

  // Update to new password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) return { error: updateError.message };

  return { success: true, message: "Password updated successfully." };
}
