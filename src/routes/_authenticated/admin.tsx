import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Moderator approval queue — BlockBeacon" },
      { name: "description", content: "Admin queue for reviewing non-government moderator applications." },
    ],
  }),
});

type Pending = {
  id: string;
  organization: string;
  gov_email: string;
  community: string;
  proof_url: string | null;
  verified: boolean;
  created_at: string;
};

function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setIsAdmin(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roles } = await (supabase.from("user_roles" as any) as any).select("role").eq("user_id", uid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = Boolean((roles as any[] | null)?.some((r) => r.role === "admin"));
    setIsAdmin(admin);
    if (!admin) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("moderator_profiles" as any) as any)
      .select("*")
      .eq("verified", false)
      .order("created_at", { ascending: false });
    setPending((data as Pending[] | null) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("moderator_profiles" as any) as any).update({ verified: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Approved"); load(); }
  }

  async function reject(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("user_roles" as any) as any).delete().eq("user_id", id).eq("role", "moderator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("moderator_profiles" as any) as any).delete().eq("id", id);
    toast.success("Rejected");
    load();
  }

  if (isAdmin === null) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-border">
          <Link to="/map" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft size={18} /></Link>
          <h1 className="font-display text-lg font-bold">Admin</h1>
        </header>
        <main className="max-w-xl mx-auto px-4 py-10 text-center">
          <div className="rounded-2xl border border-border bg-card p-6">
            <ShieldCheck size={28} className="mx-auto text-muted-foreground" />
            <h2 className="mt-3 font-semibold">You're not an admin.</h2>
            <p className="text-sm text-muted-foreground mt-1">Only project admins can review pending moderator applications.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-border">
        <Link to="/map" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft size={18} /></Link>
        <h1 className="font-display text-lg font-bold">Moderator approval queue</h1>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Queue empty — no pending applications.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((p) => (
              <li key={p.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{p.organization}</div>
                    <div className="text-xs text-muted-foreground">{p.community}</div>
                    <div className="text-xs text-muted-foreground mt-1">{p.gov_email}</div>
                    {p.proof_url && (
                      <a href={p.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                        Proof <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => approve(p.id)} className="flex-1 rounded-full bg-primary text-primary-foreground py-1.5 text-sm">Approve</button>
                  <button onClick={() => reject(p.id)} className="flex-1 rounded-full border border-border py-1.5 text-sm hover:bg-destructive/10 hover:text-destructive">Reject</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}