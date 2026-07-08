import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MailCheck, MapPin, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmailPage,
  head: () => ({
    meta: [
      { title: "Verify your email — BlockBeacon" },
      { name: "description", content: "Confirm your email address to unlock BlockBeacon." },
    ],
  }),
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) { navigate({ to: "/auth" }); return; }
      if (user.email_confirmed_at) {
        const intent = typeof window !== "undefined" ? window.localStorage.getItem("bb.signup_role") : null;
        navigate({ to: intent === "moderator" ? "/moderator/apply" : "/map" });
        return;
      }
      setEmail(user.email ?? "");
    })();
  }, [navigate]);

  async function resend() {
    if (!email) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/verify-email` },
      });
      if (error) throw error;
      toast.success("Verification email sent — check your inbox and spam folder.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't resend the email");
    } finally { setBusy(false); }
  }

  async function iVerified() {
    setChecking(true);
    const { data, error } = await supabase.auth.refreshSession();
    setChecking(false);
    if (error || !data.user?.email_confirmed_at) {
      toast.error("Not verified yet — try the link in your inbox again.");
      return;
    }
    const intent = typeof window !== "undefined" ? window.localStorage.getItem("bb.signup_role") : null;
    navigate({ to: intent === "moderator" ? "/moderator/apply" : "/map" });
  }

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4">
      <div className="max-w-md w-full text-center">
        <Link to="/" className="inline-flex items-center gap-2 justify-center mb-6 font-display text-xl font-bold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MapPin size={18} strokeWidth={2.5} />
          </span>
          BlockBeacon
        </Link>
        <div className="rounded-3xl border border-border bg-card p-8 shadow-xl shadow-primary/5">
          <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-primary/10 text-primary">
            <MailCheck size={28} />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Verify your email to get access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{email || "your inbox"}</span>. Click the link to unlock BlockBeacon.
          </p>
          <button onClick={iVerified} disabled={checking}
            className="mt-6 w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90">
            {checking ? "Checking…" : "I clicked the link — take me in"}
          </button>
          <button onClick={resend} disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50">
            <RefreshCw size={12} className={busy ? "animate-spin" : undefined} />
            {busy ? "Sending…" : "Resend verification email"}
          </button>
          <p className="mt-6 text-xs text-muted-foreground">
            Wrong address? <Link to="/auth" className="underline">Sign in with a different account</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}