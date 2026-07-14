import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { MapPin, ShieldCheck, Users, Eye, EyeOff } from "lucide-react";
import { useT } from "@/lib/useT";

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
  const { t } = useT();
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
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      await routeAfterAuth(data.user.id, role, navigate);
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
        if (userData.user) {
          await routeAfterAuth(userData.user.id, role, navigate);
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

  // Route the user based on their moderator status:
  // - Verified moderators (has role in user_roles) -> /map
  // - Moderators with in-progress profile -> /moderator/apply (resume)
  // - New moderator signups -> /moderator/apply
  // - Neighbors -> /map
  async function routeAfterAuth(userId: string, roleChoice: "moderator" | "neighbor", nav: typeof navigate) {
    if (roleChoice !== "moderator") {
      nav({ to: "/map" });
      return;
    }
    // Check if user has verified moderator role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roles } = await (supabase.from("user_roles" as any) as any)
      .select("role").eq("user_id", userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isVerified = (roles as any[] | null)?.some((r) => r.role === "moderator");
    if (isVerified) {
      // Verified moderators go straight to the map
      try { window.localStorage.removeItem("bb.signup_role"); } catch { /* noop */ }
      nav({ to: "/map" });
      return;
    }
    // Not verified yet - go to apply (resume onboarding)
    nav({ to: "/moderator/apply" });
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
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await routeAfterAuth(userData.user.id, role, navigate);
      return;
    }
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
            {role === "moderator" ? <><ShieldCheck size={12} /> {t("moderatorSignIn")}</> : <><Users size={12} /> {t("neighborSignIn")}</>}
            <Link to="/join" className="underline ml-1">{t("change")}</Link>
          </div>
          <h1 className="text-2xl font-bold">
            {mode === "signin" ? t("welcomeBack") : role === "moderator" ? t("verifyYourRole") : t("joinYourBlock")}
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
            data-testid="google-signin-btn"
            className="mt-5 w-full rounded-full border border-border bg-background py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            {t("continueWithGoogle")}
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t("orUseEmail")}
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@block.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="auth-email-input"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder={`${t("password")} (min 6 chars)`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="auth-password-input"
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                data-testid="toggle-password-visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={busy}
              data-testid="auth-submit-btn"
              className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90"
            >
              {busy ? "…" : mode === "signin" ? t("signIn") : t("createAccount")}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            data-testid="toggle-signin-signup"
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? t("newHereCreate") : t("alreadyHaveAccount")}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to help keep your neighborhood a little better.
        </p>
      </div>
    </div>
  );
}