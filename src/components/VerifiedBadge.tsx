import { BadgeCheck } from "lucide-react";

// A small, high-signal badge shown on updates or comments that came from
// a verified city moderator account. Kept compact so it never overwhelms
// the neighbor content it's paired with.
export function VerifiedBadge({ label = "Verified city", className = "" }: { label?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 ${className}`}
      title="Verified city-hall moderator"
    >
      <BadgeCheck size={12} strokeWidth={2.5} />
      {label}
    </span>
  );
}