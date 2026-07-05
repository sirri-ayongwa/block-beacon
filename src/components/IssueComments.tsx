import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Send, Trash2, User } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";

type Comment = {
  id: string;
  user_id: string;
  body: string;
  is_moderator: boolean;
  created_at: string;
  display_name?: string | null;
  verified?: boolean;
};

export function IssueComments({ issueId, currentUserId, isModerator, isVerifiedMod }: {
  issueId: string;
  currentUserId: string | null;
  isModerator: boolean;
  isVerifiedMod: boolean;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function load() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("issue_comments" as any) as any)
      .select("id, user_id, body, is_moderator, created_at")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true });
    const list = ((data as Comment[] | null) ?? []);
    const userIds = Array.from(new Set(list.map((c) => c.user_id)));
    if (userIds.length) {
      const [{ data: profs }, { data: mods }] = await Promise.all([
        supabase.from("profiles").select("id, display_name").in("id", userIds),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("moderator_profiles" as any) as any).select("id, verified").in("id", userIds),
      ]);
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      const verMap = new Map(((mods as Array<{ id: string; verified: boolean }> | null) ?? []).map((m) => [m.id, m.verified]));
      list.forEach((c) => {
        c.display_name = nameMap.get(c.user_id) ?? null;
        c.verified = verMap.get(c.user_id) ?? false;
      });
    }
    setComments(list);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`comments-${issueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "issue_comments", filter: `issue_id=eq.${issueId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId || !body.trim()) return;
    setPosting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("issue_comments" as any) as any).insert({
      issue_id: issueId,
      user_id: currentUserId,
      body: body.trim().slice(0, 2000),
      is_moderator: isModerator,
    });
    setPosting(false);
    if (error) toast.error(error.message);
    else { setBody(""); }
  }

  async function remove(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("issue_comments" as any) as any).delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <MessageSquare size={14} /> Updates & replies ({comments.length})
      </h2>
      <ul className="space-y-3 mb-3">
        {comments.length === 0 && (
          <li className="text-sm text-muted-foreground">
            Post a “still broken?” note, an update, or a thank-you.
          </li>
        )}
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <div className={`h-8 w-8 shrink-0 rounded-full grid place-items-center ${c.is_moderator ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"}`}>
              <User size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{c.display_name || "A neighbor"}</span>
                {c.is_moderator && (c.verified ? <VerifiedBadge /> : <span className="text-[10px] rounded-full bg-warning/15 text-warning px-1.5 py-0.5 font-semibold">Moderator</span>)}
                <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                {c.user_id === currentUserId && (
                  <button onClick={() => remove(c.id)} className="ml-auto text-[10px] text-muted-foreground hover:text-destructive" title="Delete">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      {currentUserId ? (
        <form onSubmit={post} className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            placeholder={isModerator ? (isVerifiedMod ? "Reply as a verified city moderator…" : "Reply as moderator…") : "Add an update…"}
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90 flex items-center gap-1.5"
          >
            <Send size={13} /> Post
          </button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Sign in to reply.</p>
      )}
    </section>
  );
}