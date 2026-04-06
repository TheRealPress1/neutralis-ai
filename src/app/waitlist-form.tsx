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
      <div className="hud-panel rounded-xl px-6 py-5">
        <p className="text-lg text-text-mono">
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
        className="flex-1 rounded-lg border border-border bg-bg-primary px-4 py-3 text-text-primary placeholder:text-text-secondary transition-[border-color,box-shadow] duration-300 focus:border-text-mono focus:outline-none focus:ring-2 focus:ring-text-mono/40"
      />
      <button
        type="submit"
        disabled={isPending}
        className="btn-sheen rounded-lg bg-text-primary px-6 py-3 font-medium text-bg-primary transition-colors hover:bg-text-mono disabled:opacity-50"
      >
        {isPending ? "Joining…" : "Join waitlist"}
      </button>
      {state.error && (
        <p className="text-sm text-red-400 sm:absolute sm:mt-14">{state.error}</p>
      )}
    </form>
  );
}
