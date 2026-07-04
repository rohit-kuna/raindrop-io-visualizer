"use client";

import { SignOutButton, useClerk, useUser } from "@clerk/nextjs";
import { useMemo } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { ROUTES } from "@/app/lib/constants";
import { AppLogo } from "@/app/components/app-logo";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AuthHeader() {
  const { openUserProfile } = useClerk();
  const { user, isLoaded } = useUser();

  const displayName = useMemo(() => {
    if (!isLoaded) return "Loading";
    if (!user) return "User";
    return (
      user.fullName ??
      user.firstName ??
      user.username ??
      user.primaryEmailAddress?.emailAddress?.split("@")[0] ??
      "User"
    );
  }, [isLoaded, user]);

  const initials = useMemo(() => {
    const cleaned = displayName.trim();
    if (!cleaned) return "U";
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [displayName]);

  return (
    <header className="border-b border-border/50 bg-background/40 shadow-sm backdrop-blur-xl backdrop-saturate-150 supports-backdrop-filter:bg-background/30">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:gap-3 sm:px-6 lg:max-w-none lg:px-10 xl:px-14 2xl:px-20">
        <AppLogo href={ROUTES.DASHBOARD} />

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="max-w-56 justify-start gap-2 px-2 sm:px-3">
                {isLoaded ? (
                  <Avatar size="sm">
                    <AvatarImage src={user?.imageUrl} alt={displayName} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                ) : (
                  <Spinner className="size-4" />
                )}
                <span className="hidden truncate text-sm sm:inline">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openUserProfile()}>
                Profile settings
              </DropdownMenuItem>
              <SignOutButton redirectUrl={ROUTES.HOME}>
                <DropdownMenuItem>Logout</DropdownMenuItem>
              </SignOutButton>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" asChild>
            <Link href={ROUTES.SETTINGS} aria-label="Settings">
              <Settings className="size-4" />
            </Link>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
