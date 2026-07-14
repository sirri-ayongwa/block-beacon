import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { MapPin, ShieldCheck, Users, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (search: Record<string, unknown>) => ({
    role: (search.role === "moderator" ? "moderator" : "neighbor") as "moderator" | "neighbor",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — BlockBeacon" },
      { name: "description", content: "Sign in or create a free BlockBeacon account to start reporting neighborhood issues." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { role: roleParam } = useSearch({ from: "/auth" }) as { role: "moderator" | "neighbor" };
  // Prefer URL param, then persisted intent, then default neighbor.
  const [role] = useState<"moderator" | "neighbor">(() => {
    if (roleParam === "moderator") return "moderator";
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("bb.signup_role");
      if (stored === "moderator") return "moderator";
    }
    return "neighbor";
  });

  // Persist for the _authenticated resume-onboarding logic.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (role === "moderator") window.localStorage.setItem("bb.signup_role", "moderator");
  }, [role]);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      // If they picked moderator, always resume onboarding until profile exists.
      if (role === "moderator") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("moderator_profiles" as any) as any)
          .select("id").eq("id", data.user.id).maybeSingle()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then(({ data: prof }: any) => {
            navigate({ to: prof ? "/moderator" : "/moderator/apply" });
          });
      } else {
        navigate({ to: "/map" });
      }
    });
  }, [navigate, role]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (role === "moderator") {
          const domain = email.split("@")[1]?.toLowerCase() ?? "";
          const blocked = ["gmail.com", "yahoo.com", "yahoo.co.uk", "outlook.com", "hotmail.com", "live.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"];
          if (!domain || blocked.includes(domain)) {
            toast.error("Moderators must sign up with an official work / city-hall email — free providers (Gmail, Yahoo, Outlook, etc.) aren't accepted.");
            setBusy(false);
            return;
          }
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/verify-email`,
          },
        });
        if (error) throw error;
        toast.success("Account created — check your inbox for the verification link.");
        navigate({ to: "/verify-email" });
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user && !userData.user.email_confirmed_at) {
          navigate({ to: "/verify-email" });
          return;
        }
      }
      navigate({ to: role === "moderator" ? "/moderator/apply" : "/map" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: role === "moderator" ? "/moderator/apply" : "/map" });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6 font-display text-xl font-bold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MapPin size={18} strokeWidth={2.5} />
          </span>
          BlockBeacon
        </Link>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-primary/5">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-medium">
            {role === "moderator" ? <><ShieldCheck size={12} /> Moderator sign-in</> : <><Users size={12} /> Neighbor sign-in</>}
            <Link to="/join" className="underline ml-1">change</Link>
          </div>
          <h1 className="text-2xl font-bold">
            {mode === "signin" ? "Welcome back" : role === "moderator" ? "Verify your role" : "Join your block"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Pick up where you left off on the neighborhood map."
              : role === "moderator"
                ? "Create your account, then complete a short verification so your city badge appears on updates."
                : "One free account. Start reporting in under a minute."}
          </p>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="mt-5 w-full rounded-full border border-border bg-background py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or use email
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@block.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="Password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90"
            >
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to help keep your neighborhood a little better.
        </p>
      </div>
    </div>
  );
}