"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { examineeGroupSchema, addGroupMembersSchema, type ExamineeGroupFormValues } from "@/lib/validations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTableSkeleton, LoadingSpinner } from "@/components/ui/loading";
import { Plus, Trash2, Loader2, Users, UserPlus, Eye, X, Search, Mail } from "lucide-react";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import type { ExamineeGroup, User } from "@/types";

export default function GroupsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [viewMembersDialogOpen, setViewMembersDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ExamineeGroup | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<ExamineeGroup | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ExamineeGroup | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getExamineeGroups(),
  });

  // Fetch group detail with members when viewing
  const { data: groupDetailData, isLoading: groupDetailLoading } = useQuery({
    queryKey: ["group-detail", selectedGroup?.id],
    queryFn: () => selectedGroup ? api.getExamineeGroup(selectedGroup.id, { includeMembers: true }) : null,
    enabled: !!selectedGroup && viewMembersDialogOpen,
  });

  const form = useForm<ExamineeGroupFormValues>({
    resolver: zodResolver(examineeGroupSchema),
    defaultValues: { name: "", description: "", memberEmails: "" },
  });

  const membersForm = useForm({
    resolver: zodResolver(addGroupMembersSchema),
    defaultValues: { memberEmails: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: ExamineeGroupFormValues) =>
      api.createExamineeGroup({ name: values.name, description: values.description || "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group created");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ExamineeGroupFormValues }) =>
      api.updateExamineeGroup(id, { name: values.name, description: values.description || "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group updated");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addMembersMutation = useMutation({
    mutationFn: ({ id, emails }: { id: string; emails: string[] }) =>
      api.addGroupMembers(id, { memberEmails: emails }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-detail", selectedGroup?.id] });
      toast.success("Members added");
      setMembersDialogOpen(false);
      membersForm.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, memberId }: { groupId: string; memberId: string }) =>
      api.removeGroupMembers(groupId, [memberId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-detail", selectedGroup?.id] });
      toast.success("Member removed");
      setRemovingMemberId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setRemovingMemberId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteExamineeGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted");
      setDeleteGroup(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingGroup(null);
    form.reset({ name: "", description: "", memberEmails: "" });
    setDialogOpen(true);
  };

  const openEdit = (group: ExamineeGroup) => {
    setEditingGroup(group);
    form.reset({ name: group.name, description: group.description });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingGroup(null);
    form.reset();
  };

  const openAddMembers = (group: ExamineeGroup) => {
    setSelectedGroup(group);
    membersForm.reset();
    setMembersDialogOpen(true);
  };

  const openViewMembers = (group: ExamineeGroup) => {
    setSelectedGroup(group);
    setMemberSearch("");
    setViewMembersDialogOpen(true);
  };

  const onSubmit = (values: ExamineeGroupFormValues) => {
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const groups = data?.data || [];

  // Get members from the group detail response — handle nested response
  const groupDetail = groupDetailData?.data;
  const members: User[] = groupDetail?.members || [];
  const filteredMembers = members.filter((m) => {
    const search = memberSearch.toLowerCase();
    return (
      !search ||
      (m.name || "").toLowerCase().includes(search) ||
      (m.email || "").toLowerCase().includes(search) ||
      (m.displayName || "").toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Examinee Groups</h1>
          <p className="text-muted-foreground">Organize examinees into groups for bulk invitations.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create Group
        </Button>
      </div>

      {isLoading ? (
        <DataTableSkeleton rows={4} />
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No groups yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create groups to organize your examinees.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Create Group</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {group.name}
                  </CardTitle>
                  <div className="flex items-center gap-1 -mt-1 -mr-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(group)}>
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteGroup(group)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {group.description && (
                  <CardDescription className="line-clamp-2">{group.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <Badge variant="secondary">
                  {group.memberIds?.length || group.memberCount || 0} members
                </Badge>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => openViewMembers(group)}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> View Members
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openAddMembers(group)}>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add Members
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ===== View Members Dialog ===== */}
      <Dialog open={viewMembersDialogOpen} onOpenChange={setViewMembersDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedGroup?.name} - Members
            </DialogTitle>
            <DialogDescription>
              {members.length} member{members.length !== 1 ? "s" : ""} in this group.
              {selectedGroup?.memberIds && members.length === 0 && !groupDetailLoading && (
                <span> ({selectedGroup.memberIds.length} member IDs registered)</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Members List */}
          {groupDetailLoading ? (
            <div className="py-8">
              <LoadingSpinner />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {memberSearch ? "No members match your search." : "No members in this group yet."}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-1">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id || member.uid}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={member.picture || member.photoURL} />
                      <AvatarFallback className="text-xs">
                        {getInitials(member.name || member.displayName || member.email || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.name || member.displayName || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        {member.email}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                      {member.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={removeMemberMutation.isPending && removingMemberId === (member.id || member.uid)}
                      onClick={() => {
                        const memberId = member.id || member.uid;
                        setRemovingMemberId(memberId);
                        if (selectedGroup) {
                          removeMemberMutation.mutate({ groupId: selectedGroup.id, memberId });
                        }
                      }}
                    >
                      {removeMemberMutation.isPending && removingMemberId === (member.id || member.uid) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <Separator />

          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setViewMembersDialogOpen(false);
                if (selectedGroup) openAddMembers(selectedGroup);
              }}
            >
              <UserPlus className="mr-1 h-3 w-3" /> Add Members
            </Button>
            <Button variant="outline" size="sm" onClick={() => setViewMembersDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Create/Edit Dialog ===== */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Group" : "Create Group"}</DialogTitle>
            <DialogDescription>{editingGroup ? "Update the group details." : "Create a new examinee group."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input placeholder="e.g., Class A - 2024" {...form.register("name")} />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe this group..." {...form.register("description")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingGroup ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Add Members Dialog ===== */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Members to {selectedGroup?.name}</DialogTitle>
            <DialogDescription>Enter email addresses separated by commas.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={membersForm.handleSubmit((values) => {
              const emails = values.memberEmails.split(",").map((e: string) => e.trim()).filter(Boolean);
              if (selectedGroup && emails.length > 0) {
                addMembersMutation.mutate({ id: selectedGroup.id, emails });
              }
            })}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Email Addresses *</Label>
              <Textarea placeholder="user1@example.com, user2@example.com" {...membersForm.register("memberEmails")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMembersDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addMembersMutation.isPending}>
                {addMembersMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Members
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation ===== */}
      <AlertDialog open={!!deleteGroup} onOpenChange={() => setDeleteGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteGroup?.name}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteGroup && deleteMutation.mutate(deleteGroup.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
