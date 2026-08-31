export type ModerationResult = {
  isApproved: boolean;
  flaggedCategory: string | null;
  reason: string;
  confidenceScore: number;
};

export const fallbackResult: ModerationResult = {
  isApproved: false,
  flaggedCategory: "review_required",
  reason: "The submission could not be automatically reviewed. Please try again or wait for manual review.",
  confidenceScore: 0,
};

export const moderationSchema = {
  type: "object",
  properties: {
    isApproved: { type: "boolean" },
    flaggedCategory: { type: ["string", "null"] },
    reason: { type: "string" },
    confidenceScore: { type: "number" },
  },
  required: ["isApproved", "flaggedCategory", "reason", "confidenceScore"],
};

export function normalizeModerationResult(value: unknown): ModerationResult {
  const data = value as Partial<ModerationResult>;
  const confidence = Number(data.confidenceScore);

  return {
    isApproved: Boolean(data.isApproved),
    flaggedCategory:
      typeof data.flaggedCategory === "string" && data.flaggedCategory.trim()
        ? data.flaggedCategory
        : data.isApproved
          ? "none"
          : null,
    reason:
      typeof data.reason === "string" && data.reason.trim()
        ? data.reason.trim()
        : "No moderation reason was returned.",
    confidenceScore: Number.isFinite(confidence)
      ? Math.min(1, Math.max(0, confidence))
      : 0,
  };
}

export async function verifyUserSubmission(
  userContentText: string,
  file?: { mimeType: string; data: string },
): Promise<ModerationResult> {
  try {
    const trimmed = userContentText.trim();
    if (!trimmed && !file?.data) {
      return {
        isApproved: false,
        flaggedCategory: "empty",
        reason: "Submission is empty.",
        confidenceScore: 1,
      };
    }

    const response = await fetch("/api/public/verify-moderator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, file }),
    });
    if (!response.ok) return fallbackResult;
    return normalizeModerationResult(await response.json());
  } catch (error) {
    console.error("Gemini moderation failed", error);
    return fallbackResult;
  }
}
