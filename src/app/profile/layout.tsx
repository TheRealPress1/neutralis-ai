import Providers from "@/app/dashboard/providers";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
