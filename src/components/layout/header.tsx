"use client";

import { useAuthStore } from "@/stores/auth-store";
import { signOut } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LogOut, Menu, Moon, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getInitials } from "@/lib/utils";
import { MobileNav } from "@/components/layout/sidebar";

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      // Clear all React Query cache to prevent showing previous user's data
      queryClient.clear();
      logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const roleColors: Record<string, "default" | "secondary" | "outline"> = {
    admin: "default",
    proctor: "secondary",
    examinee: "outline",
    user: "outline",
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4 lg:h-16 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 lg:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 lg:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="!size-5" />
        </Button>
        <Link href="/dashboard" className="shrink-0 lg:hidden" aria-label="Dashboard">
          <Image src="/xevra-logo.png" alt="Xevra" width={28} height={28} className="rounded-md" />
        </Link>
        <h2 className="hidden truncate text-base font-semibold sm:block lg:text-lg">
          Welcome back, {user?.name || user?.displayName || "User"}
        </h2>
      </div>
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-9 sm:w-9"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 sm:h-9 sm:w-9" aria-label="Account menu">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.picture || user?.photoURL} alt={user?.name} />
                <AvatarFallback>
                  {getInitials(user?.name || user?.displayName || "U")}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="truncate text-sm font-medium leading-none">{user?.name || user?.displayName}</p>
                <p className="truncate text-xs leading-none text-muted-foreground">{user?.email}</p>
                <Badge variant={roleColors[user?.role || "examinee"]} className="mt-1 w-fit text-[10px]">
                  {user?.role?.toUpperCase()}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
