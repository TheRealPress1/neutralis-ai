"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import {
  getProfile,
  updateProfile,
  updateEmail,
  changePassword,
} from "@/app/actions/profile";
import {
  selectPlan,
  type SubscriptionTier,
} from "@/app/actions/subscription";
import Link from "next/link";

const INPUT_CLASS =
  "w-full rounded-lg bg-[#1a1d21] border border-[#2a2d31] px-4 py-3 text-[#e8e9ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#e8e9ea]/20 focus:border-[#e8e9ea]/40 transition-colors text-sm";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  subscription_tier: string;
  created_at: string;
  updated_at: string;
}

export default function ProfileSettings() {
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
        <h2 className="font-medium text-[#eceef0] mb-4">Account Details</h2>
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
                  <p className="text-xs text-emerald-400">{emailMessage}</p>
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
              <p className="text-xs text-emerald-400 mt-1.5">{emailMessage}</p>
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

      {/* Subscription */}
      <SubscriptionCard
        currentTier={(profile?.subscription_tier as SubscriptionTier) ?? "free"}
        onTierChange={(newTier) => {
          setProfile((prev) =>
            prev ? { ...prev, subscription_tier: newTier } : prev,
          );
        }}
      />

      {/* Change password */}
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
          <p className="text-xs text-emerald-400 mt-2">{passwordMessage}</p>
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
  );
}

/* ── Subscription management card ─────────────────────────────────── */

const PLANS: {
  id: SubscriptionTier;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    features: [
      "View live signals & matched pairs",
      "Market explorer",
      "Basic analytics",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$9.99",
    period: "/mo",
    highlight: true,
    features: [
      "Automated trade execution",
      "Basic risk configuration",
      "Taker orders (FOK)",
      "20% performance fee on profits",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19.99",
    period: "/mo",
    features: [
      "Maker orders (GTC) — 4x cheaper fees",
      "Full risk profile customization",
      "Priority execution",
      "10% performance fee on profits",
    ],
  },
];

function SubscriptionCard({
  currentTier,
  onTierChange,
}: {
  currentTier: SubscriptionTier;
  onTierChange: (tier: SubscriptionTier) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = PLANS.find((p) => p.id === currentTier) ?? PLANS[0];

  const handleSwitch = useCallback(
    (tier: SubscriptionTier) => {
      if (tier === currentTier) return;
      setError(null);
      setMessage(null);

      startTransition(async () => {
        const result = await selectPlan(tier);
        if (result.error) {
          setError(result.error);
        } else {
          onTierChange(tier);
          const label = PLANS.find((p) => p.id === tier)?.name ?? tier;
          setMessage(
            tier === "free"
              ? "Downgraded to Free."
              : `Upgraded to ${label}! Stripe billing will be connected soon.`,
          );
          setTimeout(() => setMessage(null), 5000);
        }
      });
    },
    [currentTier, onTierChange],
  );

  return (
    <div className="rounded-xl border border-[#22262d] bg-[#0e1117] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-[#eceef0]">Subscription</h2>
        <Link
          href="/pricing"
          className="text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors"
        >
          View full pricing
        </Link>
      </div>

      {/* Current plan summary */}
      <div className="flex items-center gap-3 mb-5">
        <span className="rounded-full bg-[#1a1d21] border border-[#22262d] px-3 py-1 text-sm font-medium text-[#eceef0]">
          {currentPlan.name}
        </span>
        <span className="text-sm text-[#9ca3af]">
          {currentPlan.price}
          {currentPlan.period}
        </span>
        {currentTier !== "free" && (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
            Active
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400 mb-4">
          {message}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentTier;
          return (
            <div
              key={plan.id}
              className={`rounded-lg border p-4 transition-colors ${
                isCurrent
                  ? "border-[#e8e9ea]/30 bg-[#1a1d21]"
                  : "border-[#22262d] bg-[#0e1117] hover:border-[#22262d]/80"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-[#eceef0]">
                  {plan.name}
                </h3>
                {isCurrent && (
                  <span className="text-[10px] font-medium text-[#9ca3af] bg-[#22262d] rounded px-1.5 py-0.5">
                    Current
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-0.5 mb-3">
                <span className="text-lg font-semibold text-[#eceef0]">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-xs text-[#9ca3af]">{plan.period}</span>
                )}
              </div>
              <ul className="space-y-1.5 mb-4">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-1.5 text-xs text-[#9ca3af]"
                  >
                    <svg
                      className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="rounded-md border border-[#22262d] bg-[#0e1117] px-3 py-1.5 text-center text-xs text-[#9ca3af]">
                  Current plan
                </div>
              ) : (
                <button
                  onClick={() => handleSwitch(plan.id)}
                  disabled={isPending}
                  className={`w-full rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    plan.highlight
                      ? "bg-[#e8e9ea] text-[#050608] hover:bg-[#c0c5cb]"
                      : "border border-[#22262d] text-[#e8e9ea] hover:border-[#e8e9ea]/30 hover:bg-[#1a1d21]"
                  }`}
                >
                  {isPending
                    ? "Updating..."
                    : PLANS.indexOf(plan) < PLANS.findIndex((p) => p.id === currentTier)
                      ? "Downgrade"
                      : "Upgrade"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-[#6b7280]">
        Stripe billing coming soon. Plan changes take effect immediately.
      </p>
    </div>
  );
}
