import type { Metadata } from "next";
import SignupForm from "./components/SignupForm";

export const metadata: Metadata = {
  title: "Sign Up | Neutralis.ai",
  description: "Create your Neutralis.ai account",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea] flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold mb-2">Create an account</h1>
          <p className="text-[#9ca3af]">Get started with Neutralis.ai</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
