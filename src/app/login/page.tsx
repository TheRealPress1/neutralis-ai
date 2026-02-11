import type { Metadata } from "next";
import LoginForm from "./components/LoginForm";

export const metadata: Metadata = {
  title: "Login | Neutralis.ai",
  description: "Sign in to your Neutralis.ai account",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea] flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold mb-2">Welcome back</h1>
          <p className="text-[#9ca3af]">Sign in to your account</p>
        </div>
        <LoginForm redirect={params.redirect} />
      </div>
    </div>
  );
}
