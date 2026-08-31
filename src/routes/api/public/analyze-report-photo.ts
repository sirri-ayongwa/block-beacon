import { createFileRoute } from "@tanstack/react-router";
import { CATEGORIES, type IssueCategory } from "@/lib/categories";
import { geminiJson } from "@/lib/gemini.server";

type NearbyIssue = {
  id: string;
  title: string;
  description?: string | null;
  category?: string;
  distance?: number;
};

type AnalyzeResult = {
  title: string;
  description: string;
  category: IssueCategory;
  duplicate: {
    isDuplicate: boolean;
    issueId: string | null;
    reason: string;
    confidenceScore: number;
  };
};

const fallback: AnalyzeResult = {
  title: "__analysis_failed__",
  description: "__analysis_failed__",
  category: "other",
  duplicate: {
    isDuplicate: false,
    issueId: null,
    reason: "",
    confidenceScore: 0,
  },
};

const schema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    description: { type: "STRING" },
    category: { type: "STRING", enum: CATEGORIES.map((c) => c.key) },
    duplicate: {
      type: "OBJECT",
      properties: {
        isDuplicate: { type: "BOOLEAN" },
        issueId: { type: "STRING", nullable: true },
        reason: { type: "STRING" },
        confidenceScore: { type: "NUMBER" },
      },
      required: ["isDuplicate", "issueId", "reason", "confidenceScore"],
    },
  },
  required: ["title", "description", "category", "duplicate"],
};

function normalize(value: AnalyzeResult): AnalyzeResult {
  const category = CATEGORIES.some((c) => c.key === value.category) ? value.category : "other";
  const confidence = Number(value.duplicate?.confidenceScore);
  return {
    title: String(value.title || "").trim().slice(0, 120),
    description: String(value.description || "").trim().slice(0, 500),
    category,
    duplicate: {
      isDuplicate: Boolean(value.duplicate?.isDuplicate),
      issueId: value.duplicate?.issueId ? String(value.duplicate.issueId) : null,
      reason: String(value.duplicate?.reason || "").trim().slice(0, 180),
      confidenceScore: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    },
  };
}

export const Route = createFileRoute("/api/public/analyze-report-photo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          imageBase64?: string;
          nearbyIssues?: NearbyIssue[];
        };

        if (!body.imageBase64) {
          return Response.json({ error: "Missing photo" }, { status: 400 });
        }

        const categories = CATEGORIES.map((c) => `${c.key}: ${c.label} - ${c.hint}`).join("\n");
        const nearby = (body.nearbyIssues ?? [])
          .slice(0, 12)
          .map((issue) => `- id=${issue.id}; distance=${Math.round(issue.distance ?? 0)}m; category=${issue.category}; title=${issue.title}; description=${issue.description || ""}`)
          .join("\n") || "None";

        const result = await geminiJson<AnalyzeResult>({
          system: "You are a vision model for a civic issue reporting app. Inspect the uploaded image. Return only one valid JSON object, with no markdown.",
          prompt: `Look at the uploaded image and identify the main visible public-space problem. Return JSON with title, description, category, and duplicate.

Rules:
- title must be 4 to 12 words and specific to the visible issue.
- description must be one concise sentence describing what is visible.
- category must be exactly one of the allowed category keys.
- Prefer a specific category over "other" whenever the photo shows a road hole, trash, broken light, unsafe crossing, graffiti, sidewalk damage, dumped item, or water leak.
- Use "pothole" for holes, cracks, or damaged road surface.
- Use "litter" for trash, dumped bags, overflowing bins, or loose rubbish.
- Use "damaged_sidewalk" for cracked, blocked, or uneven pedestrian pavement.
- Use "abandoned_item" for dumped furniture, appliances, mattresses, or large objects.
- Use "water_leak" for visible leaking water, burst pipes, or hydrant leaks.
- Use "broken_streetlight" for an unlit, damaged, leaning, or visibly broken streetlight.
- Use "graffiti" for tagging, vandalism paint, or wall markings.
- Use "unsafe_intersection" for blocked crossings, missing signs, or dangerous junction layout.
- Use "other" only when none of the specific categories fit.
- duplicate.isDuplicate must be true only if a nearby report appears to describe the same physical issue.

Allowed categories:
${categories}

Nearby open reports:
${nearby}`,
          files: [{ mimeType: "image/jpeg", data: body.imageBase64 }],
          schema,
          fallback,
        });

        if (result.title === fallback.title && result.description === fallback.description) {
          return Response.json({ error: "Photo analysis failed" }, { status: 502 });
        }

        return Response.json(normalize(result));
      },
    },
  },
});
