import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type VerifyResult = { approved: boolean; reason: string; category?: string };

/**
 * Lovable AI-powered verification of a moderator employment proof.
 * Reads the private-bucket object via the caller's session, base64-encodes it,
 * and asks Gemini to inspect for city-hall letterhead / official titles /
 * badge markers. On approve, flips ai_verified on the profile (which trips
 * a trigger that also flips `verified`).
 */
export const verifyModeratorProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string; kind: "letter" | "badge" }) => {
    if (!input || typeof input.path !== "string" || !input.path) throw new Error("Missing proof path");
    if (input.kind !== "letter" && input.kind !== "badge") throw new Error("Invalid proof kind");
    return input;
  })
  .handler(async ({ data, context }): Promise<VerifyResult> => {
    const { supabase, userId } = context;
    // Confirm the path belongs to the caller before reading it.
    if (!data.path.startsWith(`${userId}/`)) {
      return { approved: false, reason: "Proof file must be uploaded to your own folder." };
    }

    // Download the document as bytes using the user's session (RLS-scoped)
    const { data: blob, error: dlErr } = await supabase.storage.from("moderator-proofs").download(data.path);
    if (dlErr || !blob) return { approved: false, reason: "Couldn't read the uploaded document." };
    
    // Determine MIME type based on file extension or blob type
    const mimeType = blob.type || (data.path.endsWith('.pdf') ? 'application/pdf' : data.path.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'image/webp');
    
    const buffer = new Uint8Array(await blob.arrayBuffer());
    // Base64 encode (chunked to avoid stack overflows)
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buffer.length; i += chunk) {
      binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
    }
    const b64 = btoa(binary);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { approved: false, reason: "AI reviewer is temporarily unavailable — please try again shortly." };

    const system =
      data.kind === "letter"
        ? `You are verifying an official authorization letter for a city-hall moderator role. Approve if the document shows ANY of: an official city-hall / municipal / county / state letterhead, letterhead logos of a city/government body, mention of city-hall, city council, mayor, governor, senator, state senate, department head, public works, police chief, or another clear organizational or political title, or a signed authorization from such an office. Reject only if the document is blank, unreadable, clearly personal (family photo, receipt, screenshot of chat), or obviously fabricated. When approving, specify what you detected (e.g., "City Hall Letterhead detected", "Mayor Authorization detected", "Senate Authorization detected", "Department Head Credentials detected"). Respond with a strict JSON object: {"approved": boolean, "reason": string (specific detection or one short rejection sentence), "category": "letter"}.`
        : `You are verifying a city-hall employee ID badge photo. Approve if the image shows ANY of: an active-looking employee badge with city-hall, municipality, government, county, state agency, public-works, police/fire/EMS, or business/organizational markings (name, title, logo, badge number, expiry). Reject only if the image is blank, unreadable, obviously personal (selfie, unrelated object), or clearly fabricated. When approving, specify what you detected (e.g., "City Hall ID Badge detected", "Municipal Employee Badge detected", "Government Agency Credentials detected"). Respond with a strict JSON object: {"approved": boolean, "reason": string (specific detection or one short rejection sentence), "category": "badge"}.`;

    const body = {
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: `Review this ${data.kind === "letter" ? "authorization letter" : "employee ID badge"} and return the JSON verdict.` },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } },
          ],
        },
      ],
    };

    let approved = false;
    let reason = "Couldn't confidently verify this document.";
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        return { approved: false, reason: `AI review failed (${res.status}). ${text.slice(0, 120)}` };
      }
      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content);
      approved = !!parsed.approved;
      reason = typeof parsed.reason === "string" && parsed.reason ? parsed.reason : reason;
    } catch (err) {
      return { approved: false, reason: err instanceof Error ? err.message : "AI review error" };
    }

    // Persist result
    await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("moderator_profiles" as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ ai_verified: approved, ai_reason: reason, ai_reviewed_at: new Date().toISOString() } as any)
      .eq("id", userId);

    return { approved, reason, category: data.kind };
  });