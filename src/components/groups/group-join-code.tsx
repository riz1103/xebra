"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Link2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { ExamineeGroup } from "@/types";

const formatCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn't copy. ${label}: ${text}`);
  }
}

/** Shows a group's join code with copy, rotate and disable actions. */
export function GroupJoinCode({ group }: { group: ExamineeGroup }) {
  const queryClient = useQueryClient();
  const code = group.joinEnabled !== false ? group.joinCode : null;

  const rotate = useMutation({
    mutationFn: () => api.regenerateGroupJoinCode(group.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success(code ? "New join code created. The old code no longer works." : "Join code created");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't create a join code")),
  });

  const disable = useMutation({
    mutationFn: () => api.disableGroupJoinCode(group.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Joining by code is off");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't disable the join code")),
  });

  const busy = rotate.isPending || disable.isPending;

  if (!code) {
    return (
      <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" disabled={busy} onClick={() => rotate.mutate()}>
        {rotate.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <KeyRound className="mr-1.5 h-3.5 w-3.5" />}
        Let examinees join with a code
      </Button>
    );
  }

  return (
    <div className="rounded-md border bg-muted/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Join code</p>
          <p className="font-mono text-base font-semibold tracking-widest">{formatCode(code)}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Copy join code" title="Copy code" onClick={() => copyText(code, "Join code")}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Copy join link" title="Copy link" onClick={() => copyText(`${window.location.origin}/dashboard/join?code=${code}`, "Join link")}>
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Create a new join code" title="New code" disabled={busy} onClick={() => rotate.mutate()}>
            {rotate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Turn off join code"
            title="Turn off"
            disabled={busy}
            onClick={() => disable.mutate()}
          >
            {disable.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
