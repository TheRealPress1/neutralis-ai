"use client";

import { useState, useTransition } from "react";
import { forgotPassword } from "@/app/actions/auth";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await forgotPassword(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        setSuccess(true);
      }
    });
  }

  if (success) {
    return (
      <div className="card-panel card-accent rounded-xl p-8">
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400 mb-6">
          Check your email for a password reset link. It may take a minute to
          arrive.
        </div>
        <div className="text-center text-sm text-[#9ca3af]">
          <Link
            href="/login"
            className="text-[#e8e9ea] hover:text-white transition-colors font-medium"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card-panel card-accent rounded-xl p-8">
      <form action={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-2 text-[#e8e9ea]"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg bg-[#1a1d21] border border-[#2a2d31] px-4 py-3 text-[#e8e9ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#e8e9ea]/20 focus:border-[#e8e9ea]/40 transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full btn-sheen btn-pill bg-[#e8e9ea] px-6 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Sending..." : "Send reset link"}
        </button>

        <div className="text-center text-sm text-[#9ca3af]">
          Remember your password?{" "}
          <Link
            href="/login"
            className="text-[#e8e9ea] hover:text-white transition-colors font-medium"
          >
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
