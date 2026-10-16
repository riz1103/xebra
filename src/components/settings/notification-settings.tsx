"use client";

import { useMutation } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { NotificationPrefs } from "@/types";

const DEFAULT_PREFS: NotificationPrefs = { resultEmails: true, reminderEmails: true, dailySummary: false };

interface PrefOption {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  staffOnly?: boolean;
}

const OPTIONS: PrefOption[] = [
  {
    key: "resultEmails",
    label: "Result emails",
    description: "Email me when an exam result is final, including after a proctor grades my written answers.",
  },
  {
    key: "reminderEmails",
    label: "Exam reminders",
    description: "Email me a day before a scheduled exam opens, and a day before an invitation I haven't used expires.",
  },
  {
    key: "dailySummary",
    label: "Daily proctor summary",
    description: "A daily email (00:00 UTC) with new results on my exams and essays waiting for my grade. Skipped on quiet days.",
    staffOnly: true,
  },
];

export function NotificationSettings() {
  const { user, setUser } = useAuthStore();
  const isStaff = user?.role === "proctor" || user?.role === "admin";
  const prefs = { ...DEFAULT_PREFS, ...user?.notificationPrefs };

  const mutation = useMutation({
    mutationFn: (update: Partial<NotificationPrefs>) => api.updatePreferences(update),
    onSuccess: (res) => {
      if (user && res.data) setUser({ ...user, notificationPrefs: res.data.notificationPrefs });
      toast.success("Notification preferences saved");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save preferences"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4" /> Notifications
        </CardTitle>
        <CardDescription>Choose which emails we send to {user?.email || "you"}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {OPTIONS.filter((o) => !o.staffOnly || isStaff).map((option) => (
          <div key={option.key} className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor={`pref-${option.key}`}>{option.label}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
            </div>
            <Switch
              id={`pref-${option.key}`}
              checked={prefs[option.key]}
              disabled={mutation.isPending}
              onCheckedChange={(checked) => mutation.mutate({ [option.key]: checked })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
