import { createFileRoute } from "@tanstack/react-router";
import { geminiJson } from "@/lib/gemini.server";
import { fallbackResult, normalizeModerationResult, type ModerationResult } from "@/lib/moderator-verify.functions";

const schema = {
  type: "OBJECT",
  properties: {
    isApproved: { type: "BOOLEAN" },
    flaggedCategory: { type: "STRING", nullable: true },
    reason: { type: "STRING" },
    confidenceScore: { type: "NUMBER" },
  },
  required: ["isApproved", "flaggedCategory", "reason", "confidenceScore"],
};

export const Route = createFileRoute("/api/public/verify-moderator")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text, file } = (await request.json()) as {
          text?: string;
          file?: { mimeType?: string; data?: string };
        };
        const trimmed = String(text || "").trim();
        if (!trimmed && !file?.data) {
          return Response.json({
            isApproved: false,
            flaggedCategory: "empty",
            reason: "Submission is empty.",
            confidenceScore: 1,
          } satisfies ModerationResult);
        }

        const result = await geminiJson<ModerationResult>({
          system:
            "You verify city or public-agency moderator applications. Inspect text and any uploaded proof image, PDF, or DOCX. Return only one valid JSON object.",
          prompt: `Review this moderator application and uploaded proof. Approve only when the evidence reasonably shows the applicant is eligible to moderate civic reports for the named organization/community. Reject spam, unrelated documents, fake-looking claims, private resident data, or documents that do not support public agency or city role eligibility.

Return JSON with:
isApproved: boolean
flaggedCategory: string or null
reason: short explanation
confidenceScore: number from 0 to 1

Application:
${trimmed}`,
          files: file?.data && file.mimeType ? [{ mimeType: file.mimeType, data: file.data }] : undefined,
          schema,
          fallback: fallbackResult,
        });

        return Response.json(normalizeModerationResult(result));
      },
    },
  },
});
