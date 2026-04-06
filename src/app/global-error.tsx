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
      <body className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h2 className="text-lg font-medium text-red-400 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-text-secondary mb-4">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-text-secondary mb-4">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="px-4 py-2 text-sm rounded-lg bg-bg-elevated border border-border text-text-primary hover:bg-border transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
