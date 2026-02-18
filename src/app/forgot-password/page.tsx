import type { Metadata } from "next";
import ForgotPasswordForm from "./components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password | Neutralis.ai",
  description: "Reset your Neutralis.ai account password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea] flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold mb-2">Reset your password</h1>
          <p className="text-[#9ca3af]">
            Enter your email and we&apos;ll send you a link to reset your
            password.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
