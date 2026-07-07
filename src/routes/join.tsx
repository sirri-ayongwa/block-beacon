import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/join")({
  component: JoinPage,
  head: () => ({
    meta: [
      { title: "Join BlockBeacon — choose your role" },
      { name: "description", content: "Sign in as a neighbor to report issues, or as a verified city-hall moderator to manage and resolve them." },
    ],
  }),
});

function JoinPage() {
  const navigate = useNavigate();

  function go(role: "neighbor" | "moderator") {
    // Persist intent so we can resume onboarding after auth (e.g. if the user
    // logs out mid-verification and comes back later).
    try { window.localStorage.setItem("bb.signup_role", role); } catch { /* ignore */ }
    navigate({ to: "/auth", search: { role } as never });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6 font-display text-xl font-bold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MapPin size={18} strokeWidth={2.5} />
          </span>
          BlockBeacon
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">How will you join your block?</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pick the role that fits you. You can always change later.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => go("neighbor")}
            className="text-left rounded-3xl border border-border bg-card p-6 hover:border-primary hover:shadow-lg transition group"
          >
            <div className="h-11 w-11 rounded-full bg-primary/10 text-primary grid place-items-center mb-4 group-hover:bg-primary/20">
              <Users size={20} />
            </div>
            <h2 className="font-semibold text-lg">I'm a neighbor</h2>
            <p className="mt-1 text-sm text-muted-foreground">Report issues on your street, upvote what matters, and chat with people on your block.</p>
            <div className="mt-4 text-sm font-medium text-primary">Sign up as a neighbor →</div>
          </button>

          <button
            onClick={() => go("moderator")}
            className="text-left rounded-3xl border-2 border-primary/30 bg-primary/5 p-6 hover:border-primary hover:shadow-lg transition group"
          >
            <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground grid place-items-center mb-4">
              <ShieldCheck size={20} />
            </div>
            <h2 className="font-semibold text-lg">I'm a city-hall moderator</h2>
            <p className="mt-1 text-sm text-muted-foreground">Verified officials can update issue statuses, coordinate handoffs, and earn a city badge.</p>
            <div className="mt-4 text-sm font-medium text-primary">Apply as a moderator →</div>
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" className="underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}