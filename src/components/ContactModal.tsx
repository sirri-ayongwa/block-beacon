import { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = { open: boolean; onClose: () => void; topic?: string };

export function ContactModal({ open, onClose, topic = "Contact us" }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/public/contact-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          message: message.trim(),
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Couldn't send your message");
      toast.success("Message sent. We'll reply by email.");
      setName("");
      setEmail("");
      setMessage("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your message");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-xl font-bold">{topic}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Your name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Message</label>
            <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none" />
          </div>
          <button type="submit" disabled={busy} className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send message
          </button>
        </form>
      </div>
    </div>
  );
}
