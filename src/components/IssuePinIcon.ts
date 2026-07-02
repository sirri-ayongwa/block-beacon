import L from "leaflet";
import type { IssueCategory } from "@/lib/categories";
import { CATEGORY_MAP } from "@/lib/categories";

export function makePinIcon(category: IssueCategory, status: string) {
  const meta = CATEGORY_MAP[category] ?? CATEGORY_MAP.other;
  const statusClass =
    status === "fixed" ? "status-fixed" : status === "acknowledged" ? "status-acknowledged" : "";
  return L.divIcon({
    className: "",
    html: `<div class="beacon-pin ${statusClass}"><span>${meta.emoji}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30],
  });
}