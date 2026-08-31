import { createFileRoute } from "@tanstack/react-router";
import { CATEGORIES, type IssueCategory } from "@/lib/categories";
import { ollamaJson } from "@/lib/ollama.server";

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
  title: "",
  description: "",
  category: "other",
  duplicate: {
    isDuplicate: false,
    issueId: null,
    reason: "",
    confidenceScore: 0,
  },
};

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    category: { type: "string", enum: CATEGORIES.map((c) => c.key) },
    duplicate: {
      type: "object",
      properties: {
        isDuplicate: { type: "boolean" },
        issueId: { type: ["string", "null"] },
        reason: { type: "string" },
        confidenceScore: { type: "number" },
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

        const categories = CATEGORIES.map((c) => `${c.key}: ${c.hint}`).join("\n");
        const nearby = (body.nearbyIssues ?? [])
          .slice(0, 12)
          .map((issue) => `- id=${issue.id}; distance=${Math.round(issue.distance ?? 0)}m; category=${issue.category}; title=${issue.title}; description=${issue.description || ""}`)
          .join("\n") || "None";

        const result = await ollamaJson<AnalyzeResult>({
          system: "You help neighbors report local civic issues from photos. Return concise JSON only. Do not invent hazards that are not visible.",
          prompt: `Analyze this report photo. Suggest a short title, category, and plain description. Also decide whether it is probably the same issue as one nearby.\n\nAllowed categories:\n${categories}\n\nNearby open reports:\n${nearby}`,
          images: [body.imageBase64],
          format: schema,
          fallback,
        });

        return Response.json(normalize(result));
      },
    },
  },
});
