"use client";

import { useState, type FormEvent } from "react";

export default function WaitlistForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const email = new FormData(form).get("email") as string;

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        throw new Error("Failed to join waitlist");
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="card-panel rounded-xl px-6 py-5">
        <p className="text-lg text-[#c0c5cb]">
          Thanks for joining. We&apos;ll be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
    >
      <label htmlFor="waitlist-email" className="sr-only">
        Email address
      </label>
      <input
        id="waitlist-email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="flex-1 rounded-lg border border-[#1a1d21] bg-[#0a0d10] px-4 py-3 text-[#e8e9ea] placeholder:text-[#9ca3af] transition-[border-color,box-shadow] duration-300 focus:border-[#c0c5cb] focus:outline-none focus:ring-2 focus:ring-[#c0c5cb]/40"
      />
      <button
        type="submit"
        disabled={loading}
        className="btn-sheen rounded-lg bg-[#e8e9ea] px-6 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb] disabled:opacity-50"
      >
        {loading ? "Joining…" : "Join waitlist"}
      </button>
      {error && (
        <p className="text-sm text-red-400 sm:absolute sm:mt-14">{error}</p>
      )}
    </form>
  );
}
