import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { toast } from "sonner";
import { Eye, EyeOff, MapPin } from "lucide-react";

export const Route = createFileRoute("/reset-password/confirm")({
  component: ResetPasswordConfirmPage,
  validateSearch: (search: Record<string, unknown>) => ({
    oobCode: typeof search.oobCode === "string" ? search.oobCode : undefined,
    role: typeof search.role === "string" && search.role === "moderator" ? "moderator" : "neighbor",
  }),
  head: () => ({
    meta: [{ title: "Set new password - BlockBeacon" }],
  }),
});

function ResetPasswordConfirmPage() {
  const { oobCode: oobCodeParam, role: roleParam } = useSearch({ from: "/reset-password/confirm" }) as { oobCode?: string; role?: "moderator" | "neighbor" };
  const [oobCode, setOobCode] = useState<string | undefined>(oobCodeParam);
  const [role] = useState<"moderator" | "neighbor">(() => {
    if (roleParam === "moderator") return "moderator";
    if (typeof window !== "undefined") return (window.localStorage.getItem("bb.reset_role") as "moderator" | "neighbor") ?? "neighbor";
    return "neighbor";
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    // If no oobCode in router search, fallback to querystring parse
    if (!oobCode && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("oobCode");
      if (code) setOobCode(code);
    }
  }, [oobCode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!oobCode) {
      toast.error("Missing reset code. Use the link from your email.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      toast.success("Password updated. Redirecting to sign in...");
      // clear stored flow role
      if (typeof window !== "undefined") window.localStorage.removeItem("bb.reset_role");
      // Redirect to auth with role so they land on the right sign-in screen
      window.location.href = `/auth?role=${role}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
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
          <h1 className="mt-4 text-2xl font-bold">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new password for your account{role === "moderator" ? " (Moderator)" : ""}.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={6}
                placeholder="New password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                minLength={6}
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90"
            >
              {busy ? "Saving..." : "Save new password"}
            </button>
          </form>

          <p className="mt-4 text-xs text-muted-foreground">
            If you didn't request this, <a href="/auth" className="underline">return to sign in</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
