import type { Metadata } from "next";
import ResetPasswordForm from "./components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set New Password | Neutralis.ai",
  description: "Set a new password for your Neutralis.ai account",
};

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold mb-2">Set new password</h1>
          <p className="text-text-secondary">Enter your new password below.</p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
