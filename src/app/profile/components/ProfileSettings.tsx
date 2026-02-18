"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getProfile,
  updateProfile,
  updateEmail,
  changePassword,
} from "@/app/actions/profile";
import ApiKeyManager from "@/app/dashboard/components/ApiKeyManager";

const INPUT_CLASS =
  "w-full rounded-lg bg-[#1a1d21] border border-[#2a2d31] px-4 py-3 text-[#e8e9ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#e8e9ea]/20 focus:border-[#e8e9ea]/40 transition-colors text-sm";

type Tab = "profile" | "connections";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export default function ProfileSettings() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [fullName, setFullName] = useState("");
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
        setFullName(profileResult.profile.full_name);
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
    formData.set("full_name", fullName);

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
      <div className="rounded-xl border border-[#22262d] bg-[#0e1117] p-6">
        <p className="text-sm text-[#a1a8b3]">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-[#22262d] pb-0">
        {(
          [
            { id: "profile", label: "Profile" },
            { id: "connections", label: "Connections" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-[#e8e9ea] text-[#e8e9ea]"
                : "border-transparent text-[#9ca3af] hover:text-[#e8e9ea]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
              Profile updated.
            </div>
          )}

          {/* Account Details */}
          <div className="rounded-xl border border-[#22262d] bg-[#0e1117] p-5">
            <h2 className="font-medium text-[#eceef0] mb-4">
              Account Details
            </h2>
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
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
                      <p className="text-xs text-emerald-400">
                        {emailMessage}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEmail}
                        disabled={isPending}
                        className="rounded-lg bg-[#e8e9ea] px-4 py-2 text-xs font-medium text-[#050608] hover:bg-[#c0c5cb] disabled:opacity-50 transition-colors"
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
                        className="text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors px-3"
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
                      className="shrink-0 text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors"
                    >
                      Change
                    </button>
                  </div>
                )}
                {!editingEmail && emailMessage && (
                  <p className="text-xs text-emerald-400 mt-1.5">
                    {emailMessage}
                  </p>
                )}
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Enter your full name"
                />
              </div>

              {/* Member Since */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
                  Member Since
                </label>
                <p className="text-sm text-[#eceef0]">
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
                  className="rounded-lg bg-[#e8e9ea] px-5 py-2.5 text-sm font-medium text-[#050608] hover:bg-[#c0c5cb] disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="rounded-xl border border-[#22262d] bg-[#0e1117] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-[#eceef0]">Change Password</h2>
              {!showPasswordForm && (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors"
                >
                  Update
                </button>
              )}
            </div>

            {passwordMessage && !showPasswordForm && (
              <p className="text-xs text-emerald-400 mt-2">
                {passwordMessage}
              </p>
            )}

            {showPasswordForm && (
              <div className="mt-4 space-y-3">
                {passwordError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {passwordError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
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
                  <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
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
                  <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
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
                    className="rounded-lg bg-[#e8e9ea] px-4 py-2 text-xs font-medium text-[#050608] hover:bg-[#c0c5cb] disabled:opacity-50 transition-colors"
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
                    className="text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors px-3"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connections tab */}
      {activeTab === "connections" && <ApiKeyManager />}
    </div>
  );
}
