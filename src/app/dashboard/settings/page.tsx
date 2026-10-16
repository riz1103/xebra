"use client";

import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { getInitials, formatDate } from "@/lib/utils";
import { User, Shield, Mail, Calendar } from "lucide-react";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { PlanSettings } from "@/components/settings/plan-settings";
import { WebhookSettings } from "@/components/settings/webhook-settings";

export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.picture || user?.photoURL} />
              <AvatarFallback className="text-lg">{getInitials(user?.name || "U")}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">{user?.name || user?.displayName}</h3>
              <Badge variant="outline" className="mt-1">{user?.role?.toUpperCase()}</Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium break-all">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="text-sm font-medium capitalize">{user?.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">User ID</p>
                <p className="text-sm font-mono text-muted-foreground break-all">{user?.uid || user?.id}</p>
              </div>
            </div>
            {user?.createdAt && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p className="text-sm font-medium">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <NotificationSettings />

      <PlanSettings />

      {(user?.role === "proctor" || user?.role === "admin") && <WebhookSettings />}

      <Card>
        <CardHeader>
          <CardTitle>Application Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Application</span>
            <span className="font-medium">Xevra</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium">1.0.0</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
