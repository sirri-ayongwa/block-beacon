import { createFileRoute } from "@tanstack/react-router";
import { buildDigestHtml, sendTransactionalEmail, type DigestIssue } from "@/lib/email.server";

function getServerEnv(name: string) {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

export const Route = createFileRoute("/api/public/weekly-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("apikey") ?? request.headers.get("Authorization")?.replace(/^Bearer\s+/, "");
        const digestKey = getServerEnv("WEEKLY_DIGEST_API_KEY");
        if (digestKey && provided !== digestKey) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { to, name, issues = [] } = await request.json();
        if (!to) return Response.json({ error: "Missing recipient email" }, { status: 400 });

        await sendTransactionalEmail({
          to,
          name,
          subject: "Your BlockBeacon weekly digest",
          html: buildDigestHtml(name, issues as DigestIssue[]),
        });

        return Response.json({ ok: true });
      },
    },
  },
});
