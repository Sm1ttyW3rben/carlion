"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { api } from "@/shared/lib/trpc/client";

export function QuickNoteInput({ contactId }: { contactId: string }) {
  const [note, setNote] = useState("");
  const utils = api.useUtils();

  const mutation = api.crm.addActivity.useMutation({
    onSuccess: () => {
      setNote("");
      utils.crm.getActivities.invalidate({ contactId });
      utils.crm.getById.invalidate({ id: contactId });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    mutation.mutate({
      contactId,
      activityType: "note",
      title: note.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Notiz hinzufügen..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={mutation.isPending}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!note.trim() || mutation.isPending}
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
