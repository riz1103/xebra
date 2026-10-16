"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, Plus, Send, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { Webhook, WebhookEvent } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

const EVENT_LABELS: Record<WebhookEvent, string> = {
  "result.submitted": "Result submitted",
  "result.graded": "Essay grading finished",
};
const ALL_EVENTS = Object.keys(EVENT_LABELS) as WebhookEvent[];

function WebhookRow({ hook }: { hook: Webhook }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["webhooks"] });

  const toggle = useMutation({
    mutationFn: (active: boolean) => api.updateWebhook(hook.id, { active }),
    onSuccess: refresh,
    onError: (err) => toast.error(apiErrorMessage(err, "Could not update webhook")),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteWebhook(hook.id),
    onSuccess: () => {
      toast.success("Webhook deleted");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not delete webhook")),
  });
  const test = useMutation({
    mutationFn: () => api.testWebhook(hook.id),
    onSuccess: (res) => {
      if (res.data?.ok) toast.success(res.message ?? "Delivered");
      else toast.error(res.message ?? "Delivery failed");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not send test")),
  });

  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs">{hook.url}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {hook.events.map((e) => (
              <Badge key={e} variant="secondary" className="text-[10px]">{EVENT_LABELS[e] ?? e}</Badge>
            ))}
          </div>
        </div>
        <Switch
          checked={hook.active}
          disabled={toggle.isPending}
          onCheckedChange={(v) => toggle.mutate(v)}
          aria-label={hook.active ? "Pause webhook" : "Resume webhook"}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Secret {hook.secretPreview ?? "—"}
        {hook.lastDeliveryAt && (
          <>
            {" · "}Last delivery {formatDate(hook.lastDeliveryAt)}:{" "}
            <span className={hook.lastError ? "text-red-600" : "text-emerald-600"}>
              {hook.lastError ?? `HTTP ${hook.lastStatus}`}
            </span>
          </>
        )}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={test.isPending} onClick={() => test.mutate()}>
          {test.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
          Send test
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          <Trash2 className="mr-1 h-3 w-3" /> Delete
        </Button>
      </div>
    </li>
  );
}

/** Proctors' webhooks that POST signed result data to another system (gradebook, LMS, spreadsheet automation). */
export function WebhookSettings() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(ALL_EVENTS);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => api.getWebhooks(),
    retry: false,
  });
  const hooks = data?.data ?? [];

  const create = useMutation({
    mutationFn: () => api.createWebhook({ url: url.trim(), events }),
    onSuccess: (res) => {
      setUrl("");
      setNewSecret(res.data?.secret ?? null);
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not create webhook")),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WebhookIcon className="h-4 w-4" /> Webhooks
        </CardTitle>
        <CardDescription>
          Send each result of your exams to another system as it happens, for example a gradebook, Zapier, Make, or a
          Google Sheets script. Each request is signed with an <code>X-Xebra-Signature</code> header.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {newSecret && (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="font-medium">Copy your signing secret now. It won&apos;t be shown again.</p>
            <div className="flex gap-2">
              <Input readOnly value={newSecret} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy secret"
                onClick={() => {
                  navigator.clipboard.writeText(newSecret).then(() => toast.success("Secret copied"));
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setNewSecret(null)}>Done</Button>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : hooks.length > 0 ? (
          <ul className="space-y-2">
            {hooks.map((hook) => <WebhookRow key={hook.id} hook={hook} />)}
          </ul>
        ) : (
          <p className="text-muted-foreground">No webhooks yet.</p>
        )}

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim() && events.length > 0) create.mutate();
          }}
        >
          <Label htmlFor="webhook-url">Add a webhook</Label>
          <div className="flex gap-2">
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://example.com/xebra-results"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button type="submit" disabled={!url.trim() || events.length === 0 || create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Add</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-4">
            {ALL_EVENTS.map((e) => (
              <label key={e} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={events.includes(e)}
                  onCheckedChange={(checked) =>
                    setEvents((prev) => (checked ? [...new Set([...prev, e])] : prev.filter((x) => x !== e)))
                  }
                />
                {EVENT_LABELS[e]}
              </label>
            ))}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
