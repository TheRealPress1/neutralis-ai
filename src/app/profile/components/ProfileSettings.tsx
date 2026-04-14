"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getProfile,
  updateProfile,
  updateEmail,
  changePassword,
} from "@/app/actions/profile";

const INPUT_CLASS =
  "w-full rounded-lg bg-bg-elevated border border-border px-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-text-primary/20 focus:border-text-primary/40 transition-colors text-sm";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  subscription_tier: string;
  created_at: string;
  updated_at: string;
}

export default function ProfileSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Email form
  const [email, setEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const profileResult = await getProfile();
      if (profileResult.profile) {
        setProfile(profileResult.profile);
        setFirstName(profileResult.profile.first_name ?? "");
        setLastName(profileResult.profile.last_name ?? "");
        setDateOfBirth(profileResult.profile.date_of_birth ?? "");
        setEmail(profileResult.profile.email);
      }
      setLoading(false);
    }
    load();
  }, []);

  function handleSaveProfile() {
    setError(null);
    setSaved(false);
    const formData = new FormData();
    formData.set("first_name", firstName);
    formData.set("last_name", lastName);
    formData.set("date_of_birth", dateOfBirth);

    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  function handleSaveEmail() {
    setEmailError(null);
    setEmailMessage(null);
    const formData = new FormData();
    formData.set("email", email);

    startTransition(async () => {
      const result = await updateEmail(formData);
      if (result.error) {
        setEmailError(result.error);
      } else {
        setEmailMessage(result.message ?? "Email update initiated.");
        setEditingEmail(false);
      }
    });
  }

  function handleChangePassword() {
    setPasswordError(null);
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    const formData = new FormData();
    formData.set("currentPassword", currentPassword);
    formData.set("newPassword", newPassword);
    formData.set("confirmPassword", confirmPassword);

    startTransition(async () => {
      const result = await changePassword(formData);
      if (result.error) {
        setPasswordError(result.error);
      } else {
        setPasswordMessage(result.message ?? "Password changed.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordForm(false);
      }
    });
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-6">
        <p className="text-sm text-text-secondary">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg bg-neon-green/10 border border-neon-green/20 px-4 py-3 text-sm text-neon-green">
          Profile updated.
        </div>
      )}

      {/* Account Details */}
      <div className="rounded-xl border border-border bg-bg-secondary p-5">
        <h2 className="font-medium text-text-primary mb-4">Account Details</h2>
        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-text-secondary">
              Email
            </label>
            {editingEmail ? (
              <div className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Enter new email"
                />
                {emailError && (
                  <p className="text-xs text-red-400">{emailError}</p>
                )}
                {emailMessage && (
                  <p className="text-xs text-neon-green">{emailMessage}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEmail}
                    disabled={isPending}
                    className="rounded-lg bg-text-primary px-4 py-2 text-xs font-medium text-bg-primary hover:bg-text-mono disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "Saving..." : "Update email"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingEmail(false);
                      setEmail(profile?.email ?? "");
                      setEmailError(null);
                      setEmailMessage(null);
                    }}
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors px-3"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type="email"
                  value={profile?.email ?? ""}
                  disabled
                  className={`${INPUT_CLASS} opacity-60 cursor-not-allowed flex-1`}
                />
                <button
                  onClick={() => setEditingEmail(true)}
                  className="shrink-0 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Change
                </button>
              </div>
            )}
            {!editingEmail && emailMessage && (
              <p className="text-xs text-neon-green mt-1.5">{emailMessage}</p>
            )}
          </div>

          {/* First Name + Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-text-secondary">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={INPUT_CLASS}
                placeholder="First name"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-text-secondary">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Last name"
                required
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-text-secondary">
              Date of Birth
              <span className="ml-1 text-text-secondary font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          {/* Member Since */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-text-secondary">
              Member Since
            </label>
            <p className="text-sm text-text-primary">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "\u2014"}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveProfile}
              disabled={isPending}
              className="rounded-lg bg-text-primary px-5 py-2.5 text-sm font-medium text-bg-primary hover:bg-text-mono disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-border bg-bg-secondary p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-text-primary">Change Password</h2>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Update
            </button>
          )}
        </div>

        {passwordMessage && !showPasswordForm && (
          <p className="text-xs text-neon-green mt-2">{passwordMessage}</p>
        )}

        {showPasswordForm && (
          <div className="mt-4 space-y-3">
            {passwordError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {passwordError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-text-secondary">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-text-secondary">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Min. 8 characters"
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-text-secondary">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Re-enter new password"
                minLength={8}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleChangePassword}
                disabled={isPending}
                className="rounded-lg bg-text-primary px-4 py-2 text-xs font-medium text-bg-primary hover:bg-text-mono disabled:opacity-50 transition-colors"
              >
                {isPending ? "Updating..." : "Update password"}
              </button>
              <button
                onClick={() => {
                  setShowPasswordForm(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordError(null);
                }}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors px-3"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

