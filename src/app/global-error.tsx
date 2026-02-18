"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#050608] text-[#e8e9ea] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h2 className="text-lg font-medium text-red-400 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-[#9ca3af] mb-4">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-[#6b7280] mb-4">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="px-4 py-2 text-sm rounded-lg bg-[#1a1d21] border border-[#2a2d31] text-[#e8e9ea] hover:bg-[#22252a] transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
