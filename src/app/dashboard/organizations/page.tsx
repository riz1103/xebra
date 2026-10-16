"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Loader2, Plus, Users } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";

export default function OrganizationsPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => api.getOrganizations(),
  });
  const orgs = data?.data ?? [];

  const create = useMutation({
    mutationFn: () => api.createOrganization({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      toast.success("Organization created");
      setCreateOpen(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not create organization")),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Building2 className="h-6 w-6" /> {t("orgs.title")}
          </h1>
          <p className="text-muted-foreground">{t("orgs.subtitle")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t("orgs.create")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">{t("orgs.empty")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t("orgs.subtitle")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {orgs.map((org) => (
            <Card key={org.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    <Link href={`/dashboard/organizations/${org.id}`} className="hover:underline">
                      {org.name}
                    </Link>
                  </CardTitle>
                  {org.description && <CardDescription className="mt-1">{org.description}</CardDescription>}
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {org.myRole}
                </Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {org.memberCount} member{org.memberCount === 1 ? "" : "s"}
                  {org.myDepartment && org.myDepartment !== "general" ? ` · ${org.myDepartment}` : ""}
                </span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/organizations/${org.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New organization</DialogTitle>
            <DialogDescription>You will be the owner and can invite other proctors.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Name</Label>
              <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Riverside High School" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-desc">Description (optional)</Label>
              <Textarea id="org-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
