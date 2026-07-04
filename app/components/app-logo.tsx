import Link from "next/link";
import { Waypoints } from "lucide-react";

type AppLogoProps = {
  href?: string;
};

export function AppLogo({ href = "/" }: AppLogoProps) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 shrink-0 items-center gap-2 font-semibold leading-none sm:gap-5"
    >
      <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Waypoints className="h-4 w-4" />
      </div>
      <span className="hidden text-lg tracking-tight sm:inline">Mindverse</span>
    </Link>
  );
}
