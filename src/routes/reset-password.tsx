import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { toast } from "sonner";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    role: typeof search.role === "string" && search.role === "moderator" ? "moderator" : "neighbor",
  }),
  head: () => ({
    meta: [{ title: "Reset password - BlockBeacon" }],
  }),
});

function ResetPasswordPage() {
  const { role: roleParam } = useSearch({ from: "/reset-password" }) as { role?: "moderator" | "neighbor" };
  const initialRole = roleParam ?? (typeof window !== "undefined" ? (window.localStorage.getItem("bb.reset_role") as "moderator" | "neighbor" | null) ?? "neighbor" : "neighbor");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      const actionUrl = `${window.location.origin}/reset-password/confirm?role=${initialRole}`;
      await sendPasswordResetEmail(auth, email, { url: actionUrl });
      // Persist role so confirm flow has a fallback
      if (typeof window !== "undefined") window.localStorage.setItem("bb.reset_role", initialRole);
      toast.success("Password reset email sent. Check your inbox (and spam).");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send password reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4">
      <div className="max-w-md w-full">
        <div className="rounded-3xl border border-border bg-card p-8">
          <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-primary/10 text-primary">
            <MapPin size={28} />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Reset your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the email associated with your account. We'll send a link to reset your password.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              placeholder="you@block.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90"
            >
              {busy ? "Sending..." : "Send reset link"}
            </button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            If you remember your password, <a href="/auth" className="underline">return to sign in</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
