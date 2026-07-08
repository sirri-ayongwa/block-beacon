import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/legal/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of service — BlockBeacon" },
      { name: "description", content: "The ground rules for reporting, moderating, and using BlockBeacon." },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <MapPin size={16} strokeWidth={2.5} />
            </span>
            BlockBeacon
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="font-display text-3xl font-bold text-foreground">Terms of service</h1>
        <p>By using BlockBeacon you agree to help keep your neighborhood a little better — and to the terms below.</p>
        <h2 className="font-display text-xl font-semibold text-foreground pt-4">Community expectations</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Report real, visible issues in good faith.</li>
          <li>No personal information about other residents, harassment, or private property surveillance.</li>
          <li>Moderators may update statuses, hand off issues, and remove content that breaks the rules.</li>
        </ul>
        <h2 className="font-display text-xl font-semibold text-foreground pt-4">Moderator responsibilities</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Only apply if you actually work with a city-hall department or verified civic organization.</li>
          <li>Falsifying verification uploads will get your account permanently banned.</li>
        </ul>
        <h2 className="font-display text-xl font-semibold text-foreground pt-4">Availability</h2>
        <p>BlockBeacon is offered as-is. Emergencies belong on 911.</p>
      </main>
    </div>
  );
}