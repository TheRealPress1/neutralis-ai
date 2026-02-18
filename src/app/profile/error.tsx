"use client";

export default function ProfileError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-medium text-red-400 mb-2">
          Profile failed to load
        </h2>
        <p className="text-sm text-[#9ca3af] max-w-md">
          {error.message}
        </p>
        {error.digest && (
          <p className="text-xs text-[#6b7280] mt-2">Digest: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
