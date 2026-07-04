"use client";

import { SignOutButton, useClerk, useUser } from "@clerk/nextjs";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/app/lib/constants";
import { AppLogo } from "@/app/components/app-logo";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HeaderNavItem = {
  label: string;
  href: string;
  match?: "exact" | "prefix";
};

const navItems: HeaderNavItem[] = [
  { label: "Graph", href: ROUTES.DASHBOARD, match: "exact" },
  { label: "Settings", href: ROUTES.SETTINGS, match: "prefix" },
];

export function AuthHeader() {
  const { openUserProfile } = useClerk();
  const { user, isLoaded } = useUser();
  const pathname = usePathname();

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

  function isNavItemActive(item: HeaderNavItem) {
    const { href, match = "exact" } = item;
    if (match === "prefix") {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    return pathname === href;
  }

  return (
    <header className="border-b border-border/50 bg-background/40 shadow-sm backdrop-blur-xl backdrop-saturate-150 supports-backdrop-filter:bg-background/30">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:gap-3 sm:px-6 lg:max-w-none lg:px-10 xl:px-14 2xl:px-20">
        <div className="flex items-center gap-2 sm:gap-8">
          <AppLogo href={ROUTES.DASHBOARD} />
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="justify-start">
              {navItems.map((item) => (
                <NavigationMenuItem key={item.label}>
                  <NavigationMenuLink
                    asChild
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "px-2 sm:px-4",
                      isNavItemActive(item) && "bg-accent/50 text-accent-foreground"
                    )}
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

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
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
