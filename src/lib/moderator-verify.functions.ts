import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from "firebase/ai";
import { firebaseApp } from "@/integrations/firebase/client";

export type ModerationResult = {
  isApproved: boolean;
  flaggedCategory: string | null;
  reason: string;
  confidenceScore: number;
};

const fallbackResult: ModerationResult = {
  isApproved: false,
  flaggedCategory: "review_required",
  reason: "The submission could not be automatically reviewed. Please try again or wait for manual review.",
  confidenceScore: 0,
};

const moderationSchema = Schema.object({
  properties: {
    isApproved: Schema.boolean(),
    flaggedCategory: Schema.string({ nullable: true }),
    reason: Schema.string(),
    confidenceScore: Schema.number(),
  },
});

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

const model = getGenerativeModel(ai, {
  model: "gemini-2.5-flash",
  systemInstruction:
    "You are an expert automated content moderator. Analyze the user's submitted content for violations of community guidelines, including spam, hate speech, harassment, fraudulent claims, or off-topic gibberish.",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: moderationSchema,
  },
});

function normalizeModerationResult(value: unknown): ModerationResult {
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

export async function verifyUserSubmission(userContentText: string): Promise<ModerationResult> {
  try {
    const trimmed = userContentText.trim();
    if (!trimmed) {
      return {
        isApproved: false,
        flaggedCategory: "empty",
        reason: "Submission text is empty.",
        confidenceScore: 1,
      };
    }

    const result = await model.generateContent(
      `Return only JSON matching this shape: {"isApproved": boolean, "flaggedCategory": string | null, "reason": string, "confidenceScore": number between 0 and 1}.\n\nUser submission:\n${trimmed}`,
    );
    const text = result.response.text();
    return normalizeModerationResult(JSON.parse(text));
  } catch (error) {
    console.error("Firebase AI moderation failed", error);
    return fallbackResult;
  }
}
