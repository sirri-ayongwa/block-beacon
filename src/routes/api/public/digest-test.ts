import { createFileRoute } from "@tanstack/react-router";
import { buildDigestHtml, sendTransactionalEmail, type DigestIssue } from "@/lib/email.server";

// Only this account may fire a test digest.
const ALLOWED_TESTER = "ayongwaayongwasirri@gmail.com";

export const Route = createFileRoute("/api/public/digest-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { email?: string; name?: string; issues?: DigestIssue[] };
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const email = String(payload.email || "").trim().toLowerCase();
        if (email !== ALLOWED_TESTER) {
          return Response.json({ error: "Not allowed" }, { status: 403 });
        }

        const issues = Array.isArray(payload.issues) ? payload.issues.slice(0, 10) : [];
        try {
          await sendTransactionalEmail({
            to: email,
            name: payload.name || "neighbor",
            subject: "Test — your BlockBeacon weekly digest",
            html: buildDigestHtml(payload.name, issues),
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Send failed" },
            { status: 502 },
          );
        }

        return Response.json({ ok: true, sent_to: email, issue_count: issues.length });
      },
    },
  },
});
