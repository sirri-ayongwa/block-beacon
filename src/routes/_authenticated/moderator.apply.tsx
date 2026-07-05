import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Building2, ShieldCheck, MailCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/moderator/apply")({
  component: ModeratorApply,
  head: () => ({
    meta: [
      { title: "Become a moderator — BlockBeacon" },
      { name: "description", content: "City-hall officials and community moderators: verify your role to update statuses and hand off issues." },
    ],
  }),
});

function ModeratorApply() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [organization, setOrganization] = useState("");
  const [govEmail, setGovEmail] = useState("");
  const [community, setCommunity] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<{ verified: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prof } = await (supabase.from("moderator_profiles" as any) as any)
          .select("verified, organization, gov_email, community, proof_url")
          .eq("id", uid)
          .maybeSingle();
        if (prof) {
          setExisting({ verified: !!prof.verified });
          setOrganization(prof.organization ?? "");
          setGovEmail(prof.gov_email ?? "");
          setCommunity(prof.community ?? "");
          setProofUrl(prof.proof_url ?? "");
        }
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!organization.trim() || !govEmail.trim() || !community.trim()) {
      toast.error("Fill in your organization, official email, and community.");
      return;
    }
    setBusy(true);
    try {
      // Upsert moderator profile — trigger auto-sets verified from gov email domain.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: mErr } = await (supabase.from("moderator_profiles" as any) as any).upsert({
        id: userId,
        organization: organization.trim(),
        gov_email: govEmail.trim(),
        community: community.trim(),
        proof_url: proofUrl.trim() || null,
      });
      if (mErr) throw mErr;

      // Grant moderator role (idempotent thanks to UNIQUE(user_id, role)).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rErr } = await (supabase.from("user_roles" as any) as any).insert({
        user_id: userId,
        role: "moderator",
      });
      if (rErr && !/duplicate|unique/i.test(rErr.message)) throw rErr;

      toast.success("You're a moderator now — welcome aboard.");
      navigate({ to: "/moderator" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your application");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-border">
        <Link to="/map" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft size={18} /></Link>
        <h1 className="font-display text-lg font-bold">Become a moderator</h1>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <BadgeCheck size={18} className="text-primary" />
            <h2 className="font-semibold">For city-hall officials & neighborhood liaisons</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Moderators can update the status of any issue in the app, escalate the most-upvoted problems to city departments,
            and reply on threads with a verified badge. To keep this trustworthy, we auto-verify accounts whose official email
            ends in a government-style domain (<code>.gov</code>, <code>.gov.*</code>, <code>.gouv.*</code>, <code>.mil</code>).
            Other applicants can still act as moderators but won&apos;t display the verified badge until reviewed.
          </p>
          {existing && (
            <div className={`rounded-xl px-3 py-2 text-xs ${existing.verified ? "bg-success/10 text-success border border-success/30" : "bg-warning/10 text-warning border border-warning/30"}`}>
              {existing.verified ? "Your account is verified as a city moderator." : "Your moderator account is active but not yet verified — updates will show as 'Moderator' until we can verify."}
            </div>
          )}
        </section>

        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Building2 size={12} /> Organization or department
            </label>
            <input
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="City of Springfield — Public Works"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MailCheck size={12} /> Official email (used for automatic verification)
            </label>
            <input
              type="email"
              value={govEmail}
              onChange={(e) => setGovEmail(e.target.value)}
              placeholder="you@springfield.gov"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Emails ending in a government domain are auto-verified. Others need manual review.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Community you serve</label>
            <input
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              placeholder="Springfield · District 4"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck size={12} /> Proof URL (LinkedIn, official staff page)
            </label>
            <input
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://city.example.gov/staff/jane-doe"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-primary py-3 font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90"
          >
            {busy ? "Submitting…" : existing ? "Update my moderator profile" : "Apply to moderate"}
          </button>
        </form>
      </main>
    </div>
  );
}