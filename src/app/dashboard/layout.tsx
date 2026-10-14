"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageLoader } from "@/components/ui/loading";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationLoadingProvider } from "@/providers/navigation-loading-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <PageLoader />;
  }

  return (
    <TooltipProvider>
      <NavigationLoadingProvider>
        <div className="flex min-h-dvh">
          <Sidebar />
          <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
            <Header />
            <main className="min-w-0 flex-1 p-4 pb-8 sm:p-6">{children}</main>
          </div>
        </div>
      </NavigationLoadingProvider>
    </TooltipProvider>
  );
}
