"use client";

import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "./actions/waitlist";

const initialState: WaitlistState = { success: false, error: null };

export default function WaitlistForm() {
  const [state, formAction, isPending] = useActionState(
    joinWaitlist,
    initialState,
  );

  if (state.success) {
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
      action={formAction}
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
        disabled={isPending}
        className="btn-sheen rounded-lg bg-[#e8e9ea] px-6 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb] disabled:opacity-50"
      >
        {isPending ? "Joining…" : "Join waitlist"}
      </button>
      {state.error && (
        <p className="text-sm text-red-400 sm:absolute sm:mt-14">{state.error}</p>
      )}
    </form>
  );
}
