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
import { IntegrationsSettings } from "@/components/settings/integrations-settings";
import { APP_VERSION_LABEL, BUILD_TIME } from "@/lib/version";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const t = useT();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile")}</CardTitle>
          <CardDescription>{t("settings.profileDesc")}</CardDescription>
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
                <p className="text-xs text-muted-foreground">{t("settings.email")}</p>
                <p className="text-sm font-medium break-all">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t("settings.role")}</p>
                <p className="text-sm font-medium capitalize">{user?.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t("settings.userId")}</p>
                <p className="text-sm font-mono text-muted-foreground break-all">{user?.uid || user?.id}</p>
              </div>
            </div>
            {user?.createdAt && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("settings.memberSince")}</p>
                  <p className="text-sm font-medium">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <NotificationSettings />

      <PlanSettings />

      {(user?.role === "proctor" || user?.role === "admin") && (
        <>
          <WebhookSettings />
          <IntegrationsSettings />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("settings.application")}</span>
            <span className="font-medium">Xevra</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("settings.version")}</span>
            <span className="font-medium font-mono">{APP_VERSION_LABEL}</span>
          </div>
          {BUILD_TIME && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("settings.built")}</span>
              <span className="font-medium text-muted-foreground">{formatDate(BUILD_TIME)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
