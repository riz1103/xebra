"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/loading";
import type { GroupJoinResult } from "@/types";

const CODE_LENGTH = 8;
const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);

function JoinGroupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState(() => normalizeCode(searchParams.get("code") || ""));
  const [joined, setJoined] = useState<GroupJoinResult | null>(null);

  useEffect(() => {
    const fromUrl = normalizeCode(searchParams.get("code") || "");
    if (fromUrl) setCode(fromUrl);
  }, [searchParams]);

  const complete = code.length === CODE_LENGTH;
  const preview = useQuery({
    queryKey: ["group-join-preview", code],
    queryFn: () => api.previewGroupJoinCode(code),
    enabled: complete,
    retry: false,
  });
  const group = preview.data?.data;

  const joinMutation = useMutation({
    mutationFn: () => api.joinGroupByCode(code),
    onSuccess: (res) => {
      const result = res.data;
      if (!result) return;
      setJoined(result);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["exams-for-examinee"] });
      queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
      toast.success(res.message || `Joined "${result.name}"`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not join the group")),
  });

  if (joined) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500" />
          <div>
            <p className="text-lg font-semibold">
              {joined.alreadyMember ? `You're already in ${joined.name}` : `You joined ${joined.name}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {joined.invitationsCreated > 0
                ? `${joined.invitationsCreated} exam invitation(s) from this group were added to your account.`
                : "Exams assigned to this group will appear in My Exams."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/dashboard/my-exams")}>Go to My Exams</Button>
            <Button
              variant="outline"
              onClick={() => {
                setJoined(null);
                setCode("");
              }}
            >
              Join another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Enter your join code</CardTitle>
        <CardDescription>Your proctor shares an 8-character code or a join link.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="join-code">Join code</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="e.g. K7MPQ2XR"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono text-lg tracking-[0.3em] uppercase"
            aria-describedby="join-code-status"
          />
        </div>

        <div id="join-code-status" aria-live="polite">
          {complete && preview.isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Looking up code…
            </p>
          )}
          {complete && preview.isError && (
            <p className="text-sm text-destructive">
              {apiErrorMessage(preview.error, "This join code is invalid or no longer active.")}
            </p>
          )}
          {group && (
            <div className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold break-words">{group.name}</p>
                  {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                    {group.createdByEmail && <> · managed by {group.createdByEmail}</>}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={!group || joinMutation.isPending} onClick={() => joinMutation.mutate()}>
            {joinMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {group?.alreadyMember ? "Check for new exams" : "Join group"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/my-exams">Cancel</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function JoinGroupPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Join a group</h1>
        <p className="text-muted-foreground">Joining gives you access to the exams your proctor assigns to the group.</p>
      </div>
      <Suspense fallback={<PageLoader />}>
        <JoinGroupContent />
      </Suspense>
    </div>
  );
}
