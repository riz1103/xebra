"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  LayoutDashboard,
  FileText,
  HelpCircle,
  Package,
  Mail,
  Users,
  BarChart3,
  UserCheck,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useEffect, useState } from "react";

const proctorSectionItems = [
  { href: "/dashboard/exams", label: "Exams", icon: FileText },
  { href: "/dashboard/bundles", label: "Exam Bundles", icon: Package },
  { href: "/dashboard/invitations", label: "Invitations", icon: Mail },
  { href: "/dashboard/groups", label: "Examinee Groups", icon: Users },
  { href: "/dashboard/results", label: "Results", icon: BarChart3 },
];

const myExamsSectionItems = [
  { href: "/dashboard/my-exams", label: "My Exams", icon: GraduationCap },
  { href: "/dashboard/my-results", label: "My Results", icon: BarChart3 },
];

const adminNavItems = [
  { href: "/dashboard/questions", label: "Question Types", icon: HelpCircle },
  { href: "/dashboard/proctor-requests", label: "Proctor Requests", icon: UserCheck },
];

const examineeNavItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/my-exams", label: "My Exams", icon: GraduationCap },
  { href: "/dashboard/my-results", label: "My Results", icon: BarChart3 },
  { href: "/dashboard/proctor-request", label: "Become a Proctor", icon: UserCheck },
];

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const isActive =
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/xevra-logo.png"
        alt="Xevra"
        width={32}
        height={32}
        className="rounded-lg shrink-0"
        priority
      />
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight">XEVRA</span>
          <span className="text-[10px] text-muted-foreground leading-none">Examination System</span>
        </div>
      )}
    </div>
  );
}

function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const isProctorOrAdmin = user?.role === "proctor" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  // API returns "user" for examinees

  const link = (item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) => (
    <NavLink key={item.href} {...item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
  );

  const sectionLabel = (label: string) => (
    <p className={cn("px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2", collapsed && "hidden")}>
      {label}
    </p>
  );

  return (
    <nav className="space-y-1">
      {isProctorOrAdmin ? (
        <>
          {link({ href: "/dashboard", label: "Overview", icon: LayoutDashboard })}
          <Separator className="my-3" />
          {sectionLabel("Proctoring")}
          {proctorSectionItems.map(link)}
          <Separator className="my-3" />
          {sectionLabel("My exams")}
          {myExamsSectionItems.map(link)}
        </>
      ) : (
        examineeNavItems.map(link)
      )}

      {isProctorOrAdmin && isAdmin && (
        <>
          <Separator className="my-3" />
          {sectionLabel("Admin")}
          {adminNavItems.map(link)}
        </>
      )}

      {isProctorOrAdmin && (
        <>
          <Separator className="my-3" />
          {sectionLabel("Account")}
          {link({ href: "/dashboard/settings", label: "Settings", icon: Settings })}
        </>
      )}
    </nav>
  );
}

/** Fixed sidebar for large screens; phones and tablets use MobileNav from the header instead. */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 lg:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-16 items-center border-b px-4">
        <Brand collapsed={collapsed} />
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <SidebarNav collapsed={collapsed} />
      </ScrollArea>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}

export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();

  useEffect(() => {
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="bg-sidebar text-sidebar-foreground p-0 lg:hidden">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
        <div className="flex h-14 shrink-0 items-center border-b px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <SidebarNav onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
