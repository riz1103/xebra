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
import { useState } from "react";

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
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  collapsed: boolean;
}) {
  const isActive =
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const isProctorOrAdmin = user?.role === "proctor" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  // API returns "user" for examinees

  const sectionLabel = (label: string) => (
    <p className={cn("px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2", collapsed && "hidden")}>
      {label}
    </p>
  );

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
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

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-1">
          {isProctorOrAdmin ? (
            <>
              <NavLink href="/dashboard" label="Overview" icon={LayoutDashboard} pathname={pathname} collapsed={collapsed} />
              <Separator className="my-3" />
              {sectionLabel("Proctoring")}
              {proctorSectionItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} pathname={pathname} collapsed={collapsed} />
              ))}
              <Separator className="my-3" />
              {sectionLabel("My exams")}
              {myExamsSectionItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} pathname={pathname} collapsed={collapsed} />
              ))}
            </>
          ) : (
            examineeNavItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} pathname={pathname} collapsed={collapsed} />
            ))
          )}

          {isProctorOrAdmin && isAdmin && (
            <>
              <Separator className="my-3" />
              {sectionLabel("Admin")}
              {adminNavItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} pathname={pathname} collapsed={collapsed} />
              ))}
            </>
          )}

          {isProctorOrAdmin && (
            <>
              <Separator className="my-3" />
              {sectionLabel("Account")}
              <NavLink href="/dashboard/settings" label="Settings" icon={Settings} pathname={pathname} collapsed={collapsed} />
            </>
          )}
        </nav>
      </ScrollArea>

      {/* Collapse button */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
