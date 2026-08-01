import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "@/integrations/firebase/client";
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
      { title: "Sign in - BlockBeacon" },
      { name: "description", content: "Sign in or create a free BlockBeacon account to start reporting neighborhood issues." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const { role: roleParam } = useSearch({ from: "/auth" }) as { role: "moderator" | "neighbor" };
  const [role] = useState<"moderator" | "neighbor">(() => {
    if (roleParam === "moderator") return "moderator";
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("bb.signup_role");
      if (stored === "moderator") return "moderator";
    }
    return "neighbor";
  });

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
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) return;
      if (!user.emailVerified) {
        navigate({ to: "/verify-email" });
        return;
      }
      routeAfterAuth(role, navigate);
    });
    return unsubscribe;
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
            toast.error("Moderators must sign up with an official work / city-hall email. Free providers are not accepted.");
            setBusy(false);
            return;
          }
        }
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user, {
          url: `${window.location.origin}/verify-email`,
        });
        toast.success("Account created. Check your inbox for the verification link.");
        navigate({ to: "/verify-email" });
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!credential.user.emailVerified) {
        navigate({ to: "/verify-email" });
        return;
      }
      routeAfterAuth(role, navigate);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function routeAfterAuth(roleChoice: "moderator" | "neighbor", nav: typeof navigate) {
    nav({ to: roleChoice === "moderator" ? "/moderator/apply" : "/map" });
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      routeAfterAuth(role, navigate);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
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

          {role !== "moderator" && (
            <>
              <button
                onClick={handleGoogle}
                disabled={busy}
                data-testid="google-signin-btn"
                className="mt-5 w-full rounded-full border border-border bg-background py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.2[...]"
                {t("continueWithGoogle")}
              </button>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                {t("orUseEmail")}
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleEmail} className={`space-y-3${role === "moderator" ? " mt-5" : ""}`}>
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
              {busy ? "..." : mode === "signin" ? t("signIn") : t("createAccount")}
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
