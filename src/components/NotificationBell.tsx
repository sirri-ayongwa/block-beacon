import { useEffect, useState } from "react";
import { Bell, X, Check, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { playChime } from "@/lib/notify";

type Notif = {
  id: string;
  kind: string;
  issue_id: string | null;
  title: string;
  body: string | null;
  image_path: string | null;
  read_at: string | null;
  created_at: string;
};

// In-app notification bell. Loads recent notifications for the signed-in user
// and subscribes to realtime inserts so a "handoff" or "50 upvotes" alert
// appears without a page refresh. Also shows a toast banner on new arrival.
export function NotificationBell({ userId }: { userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});

  async function load() {
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("notifications" as any) as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    const list = (data as Notif[] | null) ?? [];
    setItems(list);

    // Best-effort thumbnail signing
    const paths = list.map((n) => n.image_path).filter((p): p is string => !!p);
    if (paths.length) {
      const map: Record<string, string> = {};
      await Promise.all(paths.map(async (p) => {
        const { data: s } = await supabase.storage.from("issue-photos").createSignedUrl(p, 3600);
        if (s?.signedUrl) map[p] = s.signedUrl;
      }));
      setSigned(map);
    }
  }

  useEffect(() => {
    load();
    if (!userId) return;
    const ch = supabase
      .channel(`notifs-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            const n = payload.new as Notif;
            const urgent = n.kind === "auto_handoff_ready";
            if (urgent) {
              try { playChime(); } catch { /* noop */ }
              toast.warning(n.title, { description: n.body ?? undefined, duration: 8000 });
            } else {
              toast(n.title, { description: n.body ?? undefined });
            }
            load();
          })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markAllRead() {
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("notifications" as any) as any).update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    load();
  }

  async function dismiss(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("notifications" as any) as any).delete().eq("id", id);
    setItems((s) => s.filter((x) => x.id !== id));
  }

  if (!userId) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full border border-border bg-card p-2 hover:bg-secondary"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-destructive text-[10px] text-white font-semibold grid place-items-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-card">
            <div className="text-sm font-semibold">Notifications</div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                  <Check size={11} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-secondary"><X size={12} /></button>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">You're all caught up.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className={`px-3 py-3 border-b border-border last:border-b-0 flex gap-3 ${n.read_at ? "" : "bg-primary/5"}`}>
                  {n.image_path && signed[n.image_path] ? (
                    <img src={signed[n.image_path]} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary grid place-items-center flex-shrink-0">
                      <Bell size={16} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                      {n.issue_id && (
                        <Link
                          to="/issue/$id"
                          params={{ id: n.issue_id }}
                          onClick={() => setOpen(false)}
                          className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                        >
                          Open <ExternalLink size={9} />
                        </Link>
                      )}
                      <button onClick={() => dismiss(n.id)} className="ml-auto text-[10px] text-muted-foreground hover:text-destructive">Dismiss</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}