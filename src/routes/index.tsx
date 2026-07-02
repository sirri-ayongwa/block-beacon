import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { MapPin, Camera, ThumbsUp, Wifi } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MapPin size={18} strokeWidth={2.5} />
          </span>
          BlockBeacon
        </div>
        <Link
          to="/auth"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Sign in
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-8 pb-24">
        <section className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              Made for your street, not city hall spreadsheets
            </p>
            <h1 className="mt-5 text-5xl md:text-6xl leading-[1.02] font-bold">
              See it. Pin it.<br />
              <span className="text-primary">Fix your block.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-lg">
              Broken streetlight? Overflowing bin? Snap a photo, drop a pin on the neighborhood map, and rally neighbors with a tap. The louder the block, the faster it gets fixed.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"
              >
                Start reporting →
              </Link>
              <Link
                to="/map"
                className="rounded-full border border-border bg-card px-6 py-3 font-medium hover:bg-secondary"
              >
                Look around the map
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[
                { icon: Camera, label: "Snap it fast" },
                { icon: ThumbsUp, label: "Neighbors upvote" },
                { icon: Wifi, label: "Works on weak data" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-2xl bg-card border border-border p-3 text-center">
                  <Icon size={18} className="mx-auto text-primary" />
                  <div className="mt-1 text-xs font-medium">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="aspect-square rounded-[2rem] bg-gradient-to-br from-primary/15 via-accent/10 to-background border border-border p-6 shadow-xl shadow-primary/10">
              <div className="h-full w-full rounded-2xl bg-[radial-gradient(circle_at_30%_20%,oklch(0.55_0.12_200/0.15),transparent_60%),radial-gradient(circle_at_70%_80%,oklch(0.68_0.18_35/0.15),transparent_60%)] bg-card relative overflow-hidden">
                {/* Faux map grid */}
                <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M40 0H0v40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#g)"/>
                </svg>
                {[
                  { top: "22%", left: "30%", label: "🕳️", count: 12 },
                  { top: "55%", left: "62%", label: "💡", count: 7 },
                  { top: "72%", left: "24%", label: "🗑️", count: 24 },
                  { top: "35%", left: "70%", label: "🚧", count: 3 },
                ].map((p) => (
                  <div key={p.label} style={{ top: p.top, left: p.left }} className="absolute -translate-x-1/2 -translate-y-full">
                    <div className="beacon-pin"><span>{p.label}</span></div>
                    <div className="mt-2 -translate-x-1/2 left-1/2 relative whitespace-nowrap rounded-full bg-card border border-border px-2 py-0.5 text-[10px] font-medium shadow">
                      {p.count} neighbors
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24">
          <h2 className="text-3xl font-bold">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["1", "Spot a problem", "Walking home and see a busted streetlight or a park piled with litter? Open BlockBeacon."],
              ["2", "Snap and drop", "Take a photo with your phone, tap the map, pick a category. Done in 15 seconds."],
              ["3", "Rally the block", "Neighbors upvote to signal priority. The more thumbs, the harder it is for the city to ignore."],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-2xl bg-card border border-border p-5">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-display font-bold">{n}</div>
                <div className="mt-3 font-display text-xl font-semibold">{t}</div>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
