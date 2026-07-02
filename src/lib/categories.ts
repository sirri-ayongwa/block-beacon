export type IssueCategory =
  | "broken_streetlight"
  | "litter"
  | "pothole"
  | "unsafe_intersection"
  | "graffiti"
  | "damaged_sidewalk"
  | "abandoned_item"
  | "water_leak"
  | "other";

export const CATEGORIES: {
  key: IssueCategory;
  label: string;
  emoji: string;
  hint: string;
}[] = [
  { key: "pothole", label: "Pothole", emoji: "🕳️", hint: "Hole or crack in the road" },
  { key: "broken_streetlight", label: "Broken streetlight", emoji: "💡", hint: "Light is out or flickering" },
  { key: "litter", label: "Litter / trash", emoji: "🗑️", hint: "Overflowing bin or dumping" },
  { key: "unsafe_intersection", label: "Unsafe crossing", emoji: "🚸", hint: "Bad signage, blocked view" },
  { key: "graffiti", label: "Graffiti", emoji: "🎨", hint: "Vandalism or tagging" },
  { key: "damaged_sidewalk", label: "Damaged sidewalk", emoji: "🚧", hint: "Cracked or blocked walkway" },
  { key: "abandoned_item", label: "Abandoned item", emoji: "🛋️", hint: "Dumped furniture, appliance" },
  { key: "water_leak", label: "Water leak", emoji: "💧", hint: "Leaking pipe or hydrant" },
  { key: "other", label: "Something else", emoji: "📍", hint: "Anything else worth flagging" },
];

export const CATEGORY_MAP: Record<IssueCategory, (typeof CATEGORIES)[number]> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<IssueCategory, (typeof CATEGORIES)[number]>;

export const STATUS_LABEL: Record<string, string> = {
  open: "Needs attention",
  acknowledged: "City is looking",
  fixed: "Fixed!",
};