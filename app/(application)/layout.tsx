import { getCurrentDbUser } from "@/app/lib/auth";
import { AuthHeader } from "@/app/components/auth-header";
import { InstallPromptProvider } from "@/app/components/install-prompt-provider";
import { ROUTES } from "@/app/lib/constants";
import { redirect } from "next/navigation";

export default async function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await getCurrentDbUser();
  } catch {
    redirect(ROUTES.SERVICE_UNAVAILABLE);
  }
  if (!user) redirect(ROUTES.SIGN_IN);

  return (
    <>
      <AuthHeader />
      <InstallPromptProvider />
      {children}
    </>
  );
}
