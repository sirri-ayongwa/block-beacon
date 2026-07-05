import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, ThumbsUp, Send, FileDown, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useModeratorStatus } from "@/lib/roles";
import { CATEGORY_MAP, STATUS_LABEL, type IssueCategory } from "@/lib/categories";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { build311EmailBody, buildHandoffPdf, HANDOFF_NOTE, type HandoffIssue } from "@/lib/handoff";

type IssueRow = HandoffIssue & {
  reporter_id: string;
  is_anonymous: boolean;
  handed_off_at: string | null;
  handoff_note: string | null;
};

export const Route = createFileRoute("/_authenticated/moderator")({
  component: ModeratorDashboard,
  head: () => ({
    meta: [
      { title: "Moderator dashboard — BlockBeacon" },
      { name: "description", content: "Review upvoted community reports, update status, and hand off issues to city departments." },
    ],
  }),
});

function ModeratorDashboard() {
  const navigate = useNavigate();
  const { loading, isModerator, profile } = useModeratorStatus();
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"top" | "open" | "handedoff">("top");

  useEffect(() => {
    if (loading) return;
    if (!isModerator) {
      navigate({ to: "/moderator/apply" });
    }
  }, [loading, isModerator, navigate]);

  useEffect(() => {
    if (!isModerator) return;
    (async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .order("upvote_count", { ascending: false })
        .limit(100);
      if (error) toast.error(error.message);
      else setIssues((data as unknown as IssueRow[]) ?? []);
    })();
    const channel = supabase
      .channel("mod-issues")
      .on("postgres_changes", { event: "*", schema: "public", table: "issues" }, async () => {
        const { data } = await supabase.from("issues").select("*").order("upvote_count", { ascending: false }).limit(100);
        setIssues((data as unknown as IssueRow[]) ?? []);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isModerator]);

  const filtered = useMemo(() => {
    if (tab === "top") return issues.slice(0, 25);
    if (tab === "handedoff") return issues.filter((i) => !!i.handed_off_at);
    return issues.filter((i) => i.status !== "fixed" && !i.handed_off_at);
  }, [issues, tab]);

  async function setStatus(issue: IssueRow, next: "open" | "acknowledged" | "fixed") {
    setBusy(issue.id);
    const { error } = await supabase.from("issues").update({ status: next }).eq("id", issue.id);
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(`Status set to "${STATUS_LABEL[next]}"`);
  }

  async function handOff(issue: IssueRow) {
    if (!profile) return toast.error("Complete your moderator profile first.");
    setBusy(issue.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("issues") as any).update({
      handed_off_at: new Date().toISOString(),
      handoff_note: HANDOFF_NOTE,
    }).eq("id", issue.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }

    // Build the 311-style deliverables and open both for the moderator.
    const body = build311EmailBody(issue, profile.community, profile.organization);
    const subject = `[BlockBeacon] ${CATEGORY_MAP[issue.category]?.label ?? "Community issue"} — ${issue.title}`;
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const { url, filename } = buildHandoffPdf(issue, profile.community, profile.organization);

    // Trigger the download and prefilled email compose.
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    window.location.href = mailto;

    toast.success("Handoff recorded — PDF downloaded, email drafted.");
  }

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!isModerator) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-border">
        <Link to="/map" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg font-bold truncate">Moderator</h1>
            {profile?.verified && <VerifiedBadge />}
          </div>
          {profile && (
            <p className="text-[11px] text-muted-foreground truncate">
              {profile.organization} · {profile.community}
            </p>
          )}
        </div>
        <Link to="/moderator/apply" className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-secondary">
          Edit profile
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {([
            ["top", "Most upvoted"],
            ["open", "Needs attention"],
            ["handedoff", "Handed off"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full py-2 text-xs font-medium border ${
                tab === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">Nothing here yet.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((issue) => (
              <ModIssueRow
                key={issue.id}
                issue={issue}
                busy={busy === issue.id}
                onStatus={(s) => setStatus(issue, s)}
                onHandoff={() => handOff(issue)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ModIssueRow({
  issue,
  busy,
  onStatus,
  onHandoff,
}: {
  issue: IssueRow;
  busy: boolean;
  onStatus: (s: "open" | "acknowledged" | "fixed") => void;
  onHandoff: () => void;
}) {
  const cat = CATEGORY_MAP[issue.category as IssueCategory];
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{cat?.emoji}</div>
        <div className="flex-1 min-w-0">
          <Link to="/issue/$id" params={{ id: issue.id }} className="font-semibold hover:underline">
            {issue.title}
          </Link>
          <div className="text-xs text-muted-foreground">
            {cat?.label} · {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
          </div>
          {issue.handed_off_at && (
            <p className="mt-1.5 text-[11px] italic text-primary/90 bg-primary/5 border-l-2 border-primary pl-2 py-1">
              Handed off {format(new Date(issue.handed_off_at), "MMM d")} — {issue.handoff_note ?? HANDOFF_NOTE}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-1 text-xs font-semibold">
          <ThumbsUp size={12} /> {issue.upvote_count}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onStatus("acknowledged")}
          disabled={busy || issue.status === "acknowledged"}
          className="text-xs rounded-full border border-warning/40 bg-warning/10 text-warning px-3 py-1.5 flex items-center gap-1 disabled:opacity-50 hover:bg-warning/20"
        >
          <Search size={12} /> Mark reviewing
        </button>
        <button
          onClick={() => onStatus("fixed")}
          disabled={busy || issue.status === "fixed"}
          className="text-xs rounded-full border border-success/40 bg-success/10 text-success px-3 py-1.5 flex items-center gap-1 disabled:opacity-50 hover:bg-success/20"
        >
          <CheckCircle2 size={12} /> Mark fixed
        </button>
        <button
          onClick={() => onStatus("open")}
          disabled={busy || issue.status === "open"}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 flex items-center gap-1 disabled:opacity-50 hover:bg-secondary"
        >
          <AlertCircle size={12} /> Reopen
        </button>
        {!issue.handed_off_at && (
          <button
            onClick={onHandoff}
            disabled={busy}
            className="ml-auto text-xs rounded-full bg-primary text-primary-foreground px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90"
          >
            <Send size={12} /> Hand off to city
            <FileDown size={12} />
          </button>
        )}
      </div>
    </li>
  );
}