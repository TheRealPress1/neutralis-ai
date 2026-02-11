"use client";

import { useEffect, useState, useTransition } from "react";
import { getProfile, updateProfile } from "@/app/actions/profile";
import { getApiKeys } from "@/app/actions/api-keys";
import Link from "next/link";

const INPUT_CLASS =
  "w-full rounded-lg bg-[#1a1d21] border border-[#2a2d31] px-4 py-3 text-[#e8e9ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#e8e9ea]/20 focus:border-[#e8e9ea]/40 transition-colors text-sm";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

interface ApiKey {
  platform: string;
  api_key_id: string;
  is_valid: boolean;
  updated_at: string;
}

function mask(value: string, visibleChars = 6) {
  if (!value || value.length <= visibleChars) return value;
  return value.slice(0, visibleChars) + "..." + value.slice(-4);
}

export default function ProfileSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const [profileResult, keysResult] = await Promise.all([
        getProfile(),
        getApiKeys(),
      ]);
      if (profileResult.profile) {
        setProfile(profileResult.profile);
        setFullName(profileResult.profile.full_name);
      }
      setKeys((keysResult.keys as ApiKey[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  function handleSave() {
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

  const kalshiKey = keys.find((k) => k.platform === "kalshi");
  const polymarketKey = keys.find((k) => k.platform === "polymarket");

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
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
              Email
            </label>
            <input
              type="email"
              value={profile?.email ?? ""}
              disabled
              className={`${INPUT_CLASS} opacity-60 cursor-not-allowed`}
            />
          </div>
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
                : "—"}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-lg bg-[#e8e9ea] px-5 py-2.5 text-sm font-medium text-[#050608] hover:bg-[#c0c5cb] disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Connected Exchanges */}
      <div className="rounded-xl border border-[#22262d] bg-[#0e1117] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-[#eceef0]">Connected Exchanges</h2>
          <Link
            href="/dashboard?tab=settings"
            className="text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors"
          >
            Manage in Settings
          </Link>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-[#22262d] bg-[#1a1d21]/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#eceef0]">Kalshi</p>
              {kalshiKey ? (
                <p className="text-xs text-[#a1a8b3] mt-0.5">
                  Key: <span className="font-mono">{mask(kalshiKey.api_key_id)}</span>
                </p>
              ) : (
                <p className="text-xs text-[#a1a8b3] mt-0.5">
                  Not connected
                </p>
              )}
            </div>
            {kalshiKey ? (
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                Connected
              </span>
            ) : (
              <span className="text-xs font-medium text-[#a1a8b3] bg-[#1a1d21] border border-[#22262d] rounded-full px-2.5 py-0.5">
                Not configured
              </span>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#22262d] bg-[#1a1d21]/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#eceef0]">Polymarket</p>
              {polymarketKey ? (
                <p className="text-xs text-[#a1a8b3] mt-0.5">
                  Key: <span className="font-mono">{mask(polymarketKey.api_key_id)}</span>
                </p>
              ) : (
                <p className="text-xs text-[#a1a8b3] mt-0.5">
                  Not connected
                </p>
              )}
            </div>
            {polymarketKey ? (
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                Connected
              </span>
            ) : (
              <span className="text-xs font-medium text-[#a1a8b3] bg-[#1a1d21] border border-[#22262d] rounded-full px-2.5 py-0.5">
                Not configured
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
