"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BookOpen, FileSpreadsheet, Link2, Loader2, Plug } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function StatusBadge({ ok }: { ok: boolean }) {
  return <Badge variant={ok ? "success" : "secondary"}>{ok ? "Ready" : "Needs keys"}</Badge>;
}

/** Shows which external integrations the API has credentials for, and how to enable the rest. */
export function IntegrationsSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["integrations-status"],
    queryFn: () => api.getIntegrationStatus(),
    retry: false,
  });
  const status = data?.data;

  const enablePush = useMutation({
    mutationFn: async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("This browser does not support push notifications.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was denied.");
      const keyRes = await api.getPushVapidPublicKey();
      const publicKey = keyRes.data?.publicKey;
      if (!publicKey) throw new Error("Push is not configured on the server.");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await api.subscribePush({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
      });
    },
    onSuccess: () => toast.success("Push notifications enabled on this device"),
    onError: (err) => toast.error(apiErrorMessage(err, err instanceof Error ? err.message : "Could not enable push")),
  });

  const rows = [
    {
      id: "webhooks",
      icon: Link2,
      title: "Webhooks",
      detail: "Already available above. Send results to Zapier, Make, or a Sheets script.",
      ok: status?.webhooks ?? true,
      action: null as React.ReactNode,
    },
    {
      id: "push",
      icon: Bell,
      title: "Push notifications",
      detail: "Invitation and result alerts on this device. Needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the API.",
      ok: !!status?.push,
      action: status?.push ? (
        <Button size="sm" variant="outline" disabled={enablePush.isPending} onClick={() => enablePush.mutate()}>
          {enablePush.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Enable on this device
        </Button>
      ) : null,
    },
    {
      id: "paymongo",
      icon: Plug,
      title: "Paid plans (QR Ph)",
      detail: status?.paymongo
        ? status.paymongoWebhook
          ? "QR Ph is ready. Proctors pay from Plan & AI usage."
          : "Checkout works on this page. Add PAYMONGO_WEBHOOK_SECRET so a plan still applies if the buyer closes the tab."
        : "Needs PAYMONGO_SECRET_KEY plus PAYMONGO_PRICE_PRO_CENTAVOS and PAYMONGO_PRICE_SCHOOL_CENTAVOS (centavos, PHP 1.00 = 100).",
      ok: !!status?.paymongo,
      action: null,
    },
    {
      id: "classroom",
      icon: BookOpen,
      title: "Google Classroom",
      detail: "Needs GOOGLE_CLASSROOM_CLIENT_ID and GOOGLE_CLASSROOM_CLIENT_SECRET.",
      ok: !!status?.googleClassroom,
      action: null,
    },
    {
      id: "lti",
      icon: BookOpen,
      title: "LTI (Moodle / Canvas)",
      detail: "Needs LTI_ISSUER, LTI_CLIENT_ID, and LTI_KEYSET_URL.",
      ok: !!status?.lti,
      action: null,
    },
    {
      id: "sheets",
      icon: FileSpreadsheet,
      title: "Google Sheets sync",
      detail: "Needs a service account. Prefer webhooks into a Sheets Apps Script until then.",
      ok: !!status?.googleSheets,
      action: null,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-4 w-4" /> Integrations
        </CardTitle>
        <CardDescription>
          Connect Xebra to billing, LMS, and notification services. Items marked &quot;Needs keys&quot; wait for
          environment variables on the API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <p className="text-muted-foreground">Checking server…</p>
        ) : (
          rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{row.title}</span>
                    <StatusBadge ok={row.ok} />
                  </div>
                  <p className="text-xs text-muted-foreground">{row.detail}</p>
                </div>
                {row.action}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
