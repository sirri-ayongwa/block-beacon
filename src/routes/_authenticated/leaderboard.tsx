import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trophy, ThumbsUp, Wrench, User } from "lucide-react";

type Row = {
  id: string;
  display_name: string | null;
  country: string | null;
  report_count: number;
  total_upvotes: number;
  fixed_count: number;
};

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: Leaderboard,
  head: () => ({
    meta: [
      { title: "Neighborhood leaderboard — BlockBeacon" },
      { name: "description", content: "Top reporters and fastest-fixed blocks in your community." },
    ],
  }),
});

function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [country, setCountry] = useState<string | null>(null);
  const [tab, setTab] = useState<"reporters" | "upvoted" | "fixers">("reporters");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: prof } = await supabase.from("profiles").select("country").eq("id", userData.user.id).maybeSingle();
        setCountry(prof?.country ?? null);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("reporter_leaderboard" as any) as any).select("*").limit(200);
      setRows((data as Row[] | null) ?? []);
    })();
  }, []);

  const scoped = country ? rows.filter((r) => !r.country || r.country === country) : rows;
  const sorted = [...scoped].sort((a, b) => {
    if (tab === "reporters") return b.report_count - a.report_count;
    if (tab === "upvoted") return b.total_upvotes - a.total_upvotes;
    return b.fixed_count - a.fixed_count;
  }).slice(0, 25);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-border">
        <Link to="/map" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="font-display text-lg font-bold flex items-center gap-2">
            <Trophy size={18} className="text-accent" /> Leaderboard
          </h1>
          <p className="text-[11px] text-muted-foreground">{country ? `Scoped to ${country}` : "All communities"}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {([
            ["reporters", "Top reporters", User],
            ["upvoted", "Most upvoted", ThumbsUp],
            ["fixers", "Most fixed", Wrench],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full py-2 text-xs font-medium border flex items-center justify-center gap-1.5 ${
                tab === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary"
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        {sorted.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No neighbors on the board yet.</p>
        ) : (
          <ol className="space-y-2">
            {sorted.map((r, i) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
                <span className={`h-8 w-8 rounded-full grid place-items-center font-display font-bold text-sm ${
                  i === 0 ? "bg-accent text-accent-foreground"
                  : i < 3 ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.display_name || "A neighbor"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.report_count} report{r.report_count === 1 ? "" : "s"} · {r.total_upvotes} upvotes · {r.fixed_count} fixed
                  </div>
                </div>
                <div className="text-lg font-display font-bold">
                  {tab === "reporters" ? r.report_count : tab === "upvoted" ? r.total_upvotes : r.fixed_count}
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}