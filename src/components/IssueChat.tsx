import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { MessageCircle, Send, Timer, X, Plus } from "lucide-react";

type Room = { id: string; title: string; created_by: string; expires_at: string; created_at: string };
type Msg = { id: string; room_id: string; user_id: string; body: string; created_at: string; display_name?: string | null };

const EXPIRY_PRESETS: { key: string; label: string; days: number }[] = [
  { key: "2w", label: "2 weeks", days: 14 },
  { key: "1m", label: "1 month", days: 30 },
  { key: "3m", label: "3 months", days: 90 },
];

export function IssueChat({ issueId, currentUserId }: { issueId: string; currentUserId: string | null }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(14);
  const endRef = useRef<HTMLDivElement>(null);

  async function loadRooms() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("chat_rooms" as any) as any)
      .select("*")
      .eq("issue_id", issueId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setRooms((data as Room[] | null) ?? []);
  }

  useEffect(() => {
    loadRooms();
    const ch = supabase
      .channel(`rooms-${issueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms", filter: `issue_id=eq.${issueId}` }, () => loadRooms())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  async function loadMessages(roomId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("chat_messages" as any) as any)
      .select("id, room_id, user_id, body, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    const list = ((data as Msg[] | null) ?? []);
    const userIds = Array.from(new Set(list.map((m) => m.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      const map = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      list.forEach((m) => { m.display_name = map.get(m.user_id) ?? null; });
    }
    setMessages(list);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  useEffect(() => {
    if (!activeRoom) return;
    loadMessages(activeRoom);
    const ch = supabase
      .channel(`msgs-${activeRoom}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${activeRoom}` }, () => loadMessages(activeRoom))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeRoom]);

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId || !title.trim()) return;
    const expires = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("chat_rooms" as any) as any).insert({
      issue_id: issueId,
      created_by: currentUserId,
      title: title.trim().slice(0, 120),
      expires_at: expires,
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setTitle(""); setCreating(false);
    setActiveRoom((data as Room).id);
    toast.success(`Chat opened — expires in ${days} days.`);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId || !activeRoom || !body.trim()) return;
    const text = body.trim().slice(0, 2000);
    setBody("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("chat_messages" as any) as any).insert({
      room_id: activeRoom, user_id: currentUserId, body: text,
    });
    if (error) { toast.error(error.message); setBody(text); }
  }

  async function closeRoom(roomId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("chat_rooms" as any) as any).delete().eq("id", roomId);
    if (error) toast.error(error.message);
    else if (activeRoom === roomId) setActiveRoom(null);
  }

  const room = rooms.find((r) => r.id === activeRoom) ?? null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <MessageCircle size={14} /> Neighbor chats
        </h2>
        {currentUserId && !creating && (
          <button onClick={() => setCreating(true)} className="text-xs rounded-full bg-primary/10 text-primary px-3 py-1 flex items-center gap-1 hover:bg-primary/20">
            <Plus size={12} /> New chat
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={createRoom} className="mt-3 rounded-xl border border-border bg-background p-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chat title, e.g. 'Coordinating a cleanup'"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <div>
            <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><Timer size={11} /> Auto-delete after…</div>
            <div className="flex gap-1.5">
              {EXPIRY_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => setDays(p.days)}
                  className={`text-xs rounded-full px-3 py-1 border ${days === p.days ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-full bg-primary text-primary-foreground py-1.5 text-sm">Open chat</button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-full border border-border px-3 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {!creating && (
        <>
          {rooms.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No open chats yet — start one to coordinate with neighbors.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {rooms.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setActiveRoom(r.id === activeRoom ? null : r.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2 flex items-center justify-between ${activeRoom === r.id ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-secondary"}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.title}</div>
                      <div className="text-[11px] text-muted-foreground">Closes {formatDistanceToNow(new Date(r.expires_at), { addSuffix: true })}</div>
                    </div>
                    {r.created_by === currentUserId && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); closeRoom(r.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); closeRoom(r.id); }}}
                        className="rounded-full p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Close chat now"
                      >
                        <X size={13} />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {room && (
            <div className="mt-3 rounded-xl border border-border bg-background overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <div className="text-xs font-semibold">{room.title}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Timer size={10} /> auto-delete {format(new Date(room.expires_at), "MMM d")}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto px-3 py-3 space-y-2">
                {messages.length === 0 && <p className="text-xs text-muted-foreground">No messages yet — say hi 👋</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.user_id === currentUserId ? "justify-end" : "justify-start"}`}>
                    <div className={`rounded-2xl px-3 py-2 max-w-[75%] text-sm ${m.user_id === currentUserId ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      <div className="text-[10px] opacity-70 mb-0.5">
                        {m.user_id === currentUserId ? "You" : (m.display_name || "A neighbor")} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form onSubmit={sendMessage} className="flex gap-2 border-t border-border p-2">
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                  placeholder="Type a message…"
                  className="flex-1 rounded-full border border-input bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button type="submit" disabled={!body.trim()} className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-sm disabled:opacity-50">
                  <Send size={13} />
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </section>
  );
}