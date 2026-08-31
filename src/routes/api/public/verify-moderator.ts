import { createFileRoute } from "@tanstack/react-router";
import { ollamaJson } from "@/lib/ollama.server";
import { fallbackResult, moderationSchema, normalizeModerationResult, type ModerationResult } from "@/lib/moderator-verify.functions";

export const Route = createFileRoute("/api/public/verify-moderator")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text } = (await request.json()) as { text?: string };
        const trimmed = String(text || "").trim();
        if (!trimmed) {
          return Response.json({
            isApproved: false,
            flaggedCategory: "empty",
            reason: "Submission text is empty.",
            confidenceScore: 1,
          } satisfies ModerationResult);
        }

        const result = await ollamaJson<ModerationResult>({
          system:
            "You are an expert automated content moderator. Analyze submissions for spam, hate speech, harassment, fraudulent claims, private data, or off-topic gibberish. Return JSON only.",
          prompt: `Review this moderator application submission:\n${trimmed}`,
          format: moderationSchema,
          fallback: fallbackResult,
        });

        return Response.json(normalizeModerationResult(result));
      },
    },
  },
});
