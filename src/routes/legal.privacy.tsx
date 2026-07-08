import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/legal/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy policy — BlockBeacon" },
      { name: "description", content: "How BlockBeacon handles the data neighbors share when reporting street-level issues." },
    ],
  }),
});

function PrivacyPage() {
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
        <h1 className="font-display text-3xl font-bold text-foreground">Privacy policy</h1>
        <p>BlockBeacon is a neighborhood-scale civic reporting tool. This policy explains what we collect and why.</p>
        <h2 className="font-display text-xl font-semibold text-foreground pt-4">What we collect</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Account details: email, display name, community, notification preferences.</li>
          <li>Report content: title, description, category, photos, and pin coordinates.</li>
          <li>Moderator verification uploads, stored privately and only readable by you and our AI reviewer.</li>
          <li>Session tokens, basic browser info, and error diagnostics.</li>
        </ul>
        <h2 className="font-display text-xl font-semibold text-foreground pt-4">How we use it</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Show reports on the map (respecting your anonymous flag).</li>
          <li>Notify you when issues you care about change status.</li>
          <li>Send optional weekly digests if you subscribe.</li>
          <li>Automatically verify moderator credentials.</li>
        </ul>
        <h2 className="font-display text-xl font-semibold text-foreground pt-4">What we don't do</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Sell your personal data.</li>
          <li>Share your precise home address with third parties.</li>
          <li>Publish moderator proof documents.</li>
        </ul>
        <h2 className="font-display text-xl font-semibold text-foreground pt-4">Your controls</h2>
        <p>You can update notification preferences and delete your account at any time from Settings. Deletion is permanent.</p>
      </main>
    </div>
  );
}