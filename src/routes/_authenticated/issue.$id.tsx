import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_MAP, STATUS_LABEL } from "@/lib/categories";
import { ArrowLeft, ThumbsUp, MapPin, User, EyeOff, ChevronLeft, ChevronRight, CheckCircle2, Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { IssueComments } from "@/components/IssueComments";
import { IssueChatFab } from "@/components/IssueChatFab";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useModeratorStatus } from "@/lib/roles";
import { HANDOFF_NOTE, build311EmailBody, buildHandoffPdf } from "@/lib/handoff";
import { Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/issue/$id")({
  component: IssueDetail,
});

type IssueRow = {
  id: string;
  reporter_id: string;
  title: string;
  description: string | null;
  category: keyof typeof CATEGORY_MAP;
  status: "open" | "acknowledged" | "fixed";
  lat: number;
  lng: number;
  is_anonymous: boolean;
  upvote_count: number;
  created_at: string;
  acknowledged_at: string | null;
  fixed_at: string | null;
  handed_off_at?: string | null;
  handoff_note?: string | null;
};

type Photo = { id: string; path: string; url?: string };
type StatusEvent = { id: string; status: "open" | "acknowledged" | "fixed"; note: string | null; created_at: string; created_by: string | null; author_name?: string | null };
type Voter = { user_id: string; created_at: string; display_name: string | null; is_anonymous: boolean };

const STATUS_STEPS: Array<"open" | "acknowledged" | "fixed"> = ["open", "acknowledged", "fixed"];
const STATUS_ICON = {
  open: AlertCircle,
  acknowledged: Search,
  fixed: CheckCircle2,
};

function IssueDetail() {
  const { id } = Route.useParams();
  const [me, setMe] = useState<string | null>(null);
  const [issue, setIssue] = useState<IssueRow | null>(null);
  const [reporterName, setReporterName] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [myVoted, setMyVoted] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const { isModerator, profile: modProfile, isVerified: isVerifiedMod } = useModeratorStatus();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  async function loadAll() {
    const [{ data: issueData }, { data: photoData }, { data: eventData }] = await Promise.all([
      supabase.from("issues").select("*").eq("id", id).maybeSingle(),
      supabase.from("issue_photos").select("id, path").eq("issue_id", id).order("created_at"),
      supabase.from("issue_status_events").select("id, status, note, created_at, created_by").eq("issue_id", id).order("created_at"),
    ]);
    if (!issueData) {
      setLoading(false);
      return;
    }
    setIssue(issueData as IssueRow);
    const evts = (eventData ?? []) as StatusEvent[];
    const authorIds = Array.from(new Set(evts.map((e) => e.created_by).filter((x): x is string => !!x)));
    if (authorIds.length) {
      const { data: authorProfs } = await supabase.from("profiles").select("id, display_name").in("id", authorIds);
      const nameMap = new Map((authorProfs ?? []).map((p) => [p.id, p.display_name]));
      evts.forEach((e) => { e.author_name = e.created_by ? nameMap.get(e.created_by) ?? null : null; });
    }
    setEvents(evts);

    // Reporter display name (respect anonymity)
    if (!issueData.is_anonymous) {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", issueData.reporter_id).maybeSingle();
      setReporterName(prof?.display_name ?? "A neighbor");
    } else {
      setReporterName(null);
    }

    // Sign photo URLs
    const withUrls = await Promise.all(
      (photoData ?? []).map(async (p) => {
        const { data } = await supabase.storage.from("issue-photos").createSignedUrl(p.path, 3600);
        return { ...p, url: data?.signedUrl } as Photo;
      })
    );
    setPhotos(withUrls);

    // Voters + display names
    const { data: votes } = await supabase.from("issue_votes").select("user_id, created_at").eq("issue_id", id).order("created_at", { ascending: false });
    const voterIds = (votes ?? []).map((v) => v.user_id);
    if (voterIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", voterIds);
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      setVoters(
        (votes ?? []).map((v) => ({
          user_id: v.user_id,
          created_at: v.created_at,
          display_name: nameMap.get(v.user_id) ?? null,
          // We don't expose per-vote anonymity yet — but we hide names for voters
          // whose profile has no display_name so they appear as "A neighbor".
          is_anonymous: !nameMap.get(v.user_id),
        }))
      );
    } else {
      setVoters([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!me) return;
    supabase
      .from("issue_votes")
      .select("user_id")
      .eq("issue_id", id)
      .eq("user_id", me)
      .maybeSingle()
      .then(({ data }) => setMyVoted(!!data));
  }, [me, id]);

  useEffect(() => {
    const channel = supabase
      .channel(`issue-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "issues", filter: `id=eq.${id}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "issue_status_events", filter: `issue_id=eq.${id}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "issue_votes", filter: `issue_id=eq.${id}` }, () => loadAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleVote() {
    if (!me || !issue) return;
    if (myVoted) {
      setMyVoted(false);
      const { error } = await supabase.from("issue_votes").delete().eq("issue_id", id).eq("user_id", me);
      if (error) { setMyVoted(true); toast.error("Couldn't remove your vote"); }
    } else {
      setMyVoted(true);
      const { error } = await supabase.from("issue_votes").insert({ issue_id: id, user_id: me });
      if (error) { setMyVoted(false); toast.error("Couldn't add your vote"); }
    }
  }

  const isReporter = me && issue && me === issue.reporter_id;

  async function setStatus(next: "open" | "acknowledged" | "fixed") {
    if (!issue) return;
    const { error } = await supabase.from("issues").update({ status: next }).eq("id", issue.id);
    if (error) toast.error(error.message);
    else toast.success(`Marked "${STATUS_LABEL[next]}"`);
  }

  async function handOff() {
    if (!issue || !modProfile) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("issues") as any).update({
      handed_off_at: new Date().toISOString(),
      handoff_note: HANDOFF_NOTE,
    }).eq("id", issue.id);
    if (error) { toast.error(error.message); return; }
    const subject = `[BlockBeacon] ${CATEGORY_MAP[issue.category]?.label ?? "Community issue"} — ${issue.title}`;
    const body = build311EmailBody(issue, modProfile.community, modProfile.organization);
    const { url, filename } = buildHandoffPdf(issue, modProfile.community, modProfile.organization);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success("Handoff recorded — PDF downloaded, email drafted.");
  }

  const timeline = useMemo(() => {
    // Latest event per status so the 3-step timeline stays clean.
    const map = new Map<string, StatusEvent>();
    events.forEach((e) => { if (!map.has(e.status)) map.set(e.status, e); });
    return STATUS_STEPS.map((s) => ({ status: s, event: map.get(s) ?? null }));
  }, [events]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!issue) {
    return (
      <div className="min-h-screen grid place-items-center text-center px-6">
        <div>
          <div className="text-lg font-semibold">This report isn't here.</div>
          <Link to="/map" className="text-sm text-primary underline">Back to the map</Link>
        </div>
      </div>
    );
  }

  const cat = CATEGORY_MAP[issue.category];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-border">
        <Link to="/map" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft size={18} /></Link>
        <div className="min-w-0">
          <h1 className="font-display font-bold truncate">{issue.title}</h1>
          <p className="text-xs text-muted-foreground truncate">
            {cat?.label} · {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto pb-24">
        {/* Photo gallery */}
        {photos.length > 0 && (
          <div className="relative bg-neutral-950 aspect-[4/3]">
            {photos[photoIdx]?.url && (
              <img
                src={photos[photoIdx].url}
                alt={`${issue.title} photo ${photoIdx + 1}`}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            )}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white p-2"
                  aria-label="Previous photo"
                ><ChevronLeft size={18} /></button>
                <button
                  onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white p-2"
                  aria-label="Next photo"
                ><ChevronRight size={18} /></button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIdx(i)}
                      className={`h-1.5 rounded-full transition-all ${i === photoIdx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              issue.status === "fixed" ? "bg-success/15 text-success"
              : issue.status === "acknowledged" ? "bg-warning/20 text-warning"
              : "bg-secondary text-secondary-foreground"
            }`}>{STATUS_LABEL[issue.status]}</span>
            {(issue.status === "fixed" || issue.status === "acknowledged") && (
              // Show the verified city badge next to moderator-updated statuses.
              // We can't cheaply prove per-event who set it here, so we only surface
              // the badge if the current status change carries a moderator-authored
              // status_event in the loaded list.
              <ModeratorStatusBadge events={events} currentStatus={issue.status} />
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {cat?.emoji} {cat?.label}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin size={12} /> {issue.lat.toFixed(4)}, {issue.lng.toFixed(4)}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {issue.is_anonymous ? <><EyeOff size={12} /> A neighbor (anonymous)</> : <><User size={12} /> {reporterName ?? "A neighbor"}</>}
            </span>
          </div>

          {issue.handed_off_at && (
            <p className="text-sm italic text-primary/90 bg-primary/5 border-l-2 border-primary pl-3 py-2 rounded-r-xl">
              {issue.handoff_note ?? HANDOFF_NOTE}
              <span className="not-italic block mt-1 text-[11px] text-muted-foreground">
                Handed off {format(new Date(issue.handed_off_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </p>
          )}

          {issue.description && (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{issue.description}</p>
          )}

          <button
            onClick={toggleVote}
            className={`w-full rounded-full py-3 font-medium flex items-center justify-center gap-2 ${
              myVoted ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-secondary"
            }`}
          >
            <ThumbsUp size={16} />
            {myVoted ? "You upvoted this" : "Upvote — signal priority"} · {issue.upvote_count}
          </button>

          {isModerator && !issue.handed_off_at && (
            <button
              onClick={handOff}
              className="w-full rounded-full border-2 border-primary bg-primary/5 text-primary py-2.5 font-medium flex items-center justify-center gap-2 hover:bg-primary/10"
            >
              <Send size={14} /> Hand off to city hall
            </button>
          )}

          {/* Status timeline */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-semibold text-sm mb-3">What's happening</h2>
            <ol className="space-y-3">
              {timeline.map(({ status, event }, idx) => {
                const Icon = STATUS_ICON[status];
                const done = !!event;
                const isCurrent = issue.status === status;
                return (
                  <li key={status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-8 w-8 rounded-full grid place-items-center ${
                        done ? (status === "fixed" ? "bg-success text-white" : status === "acknowledged" ? "bg-warning text-white" : "bg-primary text-primary-foreground")
                             : "bg-muted text-muted-foreground"
                      }`}>
                        <Icon size={14} />
                      </div>
                      {idx < STATUS_STEPS.length - 1 && (
                        <div className={`w-0.5 flex-1 min-h-4 ${done ? "bg-border" : "bg-border/50"}`} />
                      )}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{STATUS_LABEL[status]}</span>
                        {isCurrent && <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">Now</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event ? format(new Date(event.created_at), "MMM d, yyyy · h:mm a") : "Not yet"}
                      </div>
                      {event && event.author_name && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Updated by <span className="font-medium text-foreground/80">{event.author_name}</span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {isModerator && (
              <div className="mt-4 border-t border-border pt-3 space-y-2">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  Update status as moderator:
                  {isVerifiedMod ? <VerifiedBadge /> : <span className="text-[10px] rounded-full bg-warning/15 text-warning px-1.5 py-0.5 font-semibold">Moderator</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_STEPS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      disabled={issue.status === s}
                      className={`text-xs px-3 py-1.5 rounded-full border ${
                        issue.status === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!isModerator && isReporter && (
              <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">
                Only verified city moderators can change the status. Rally more upvotes to get one's attention.
              </p>
            )}
          </section>

          <IssueComments
            issueId={issue.id}
            currentUserId={me}
            isModerator={isModerator}
            isVerifiedMod={isVerifiedMod}
          />

          {/* Ephemeral chat rendered as a floating FAB, scoped to this issueId. */}
          <IssueChatFab issueId={issue.id} currentUserId={me} />

          {/* Upvoters */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-semibold text-sm mb-3">Who upvoted ({voters.length})</h2>
            {voters.length === 0 ? (
              <p className="text-sm text-muted-foreground">Be the first to signal this matters.</p>
            ) : (
              <ul className="space-y-2">
                {voters.slice(0, 30).map((v) => (
                  <li key={v.user_id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center">
                        {v.is_anonymous ? <EyeOff size={12} /> : <User size={12} />}
                      </span>
                      {v.is_anonymous ? "A neighbor" : v.display_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                    </span>
                  </li>
                ))}
                {voters.length > 30 && (
                  <li className="text-xs text-muted-foreground">+{voters.length - 30} more</li>
                )}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ModeratorStatusBadge({ events, currentStatus }: { events: StatusEvent[]; currentStatus: "open" | "acknowledged" | "fixed" }) {
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    // Find the latest status_event with the current status; look up whether its author is a verified moderator.
    const evt = [...events].reverse().find((e) => e.status === currentStatus);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created_by = (evt as any)?.created_by as string | undefined;
    if (!created_by) { setVerified(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("moderator_profiles" as any) as any)
      .select("verified").eq("id", created_by).maybeSingle()
      .then(({ data }: { data: { verified: boolean } | null }) => setVerified(!!data?.verified));
  }, [events, currentStatus]);
  if (!verified) return null;
  return <VerifiedBadge />;
}