import { createFileRoute } from "@tanstack/react-router";
import { escapeHtml, sendMailchimpTransactional } from "@/lib/email.server";

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

        const rows = (issues as Array<{ title?: string; category?: string; status?: string; upvote_count?: number }>)
          .slice(0, 10)
          .map((issue) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;"><strong>${escapeHtml(issue.title)}</strong><br><span style="color:#666;font-size:12px;">${escapeHtml(issue.category)} - ${escapeHtml(issue.status)} - ${Number(issue.upvote_count || 0)} upvotes</span></td></tr>`)
          .join("");

        await sendMailchimpTransactional({
          to,
          name,
          subject: "Your BlockBeacon weekly digest",
          html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
            <h2 style="color:#1f5a66;">Hi ${escapeHtml(name || "neighbor")}, here's your BlockBeacon week</h2>
            <p style="color:#333;">Top neighborhood issues from the past 7 days:</p>
            <table style="width:100%;border-collapse:collapse;">${rows || '<tr><td style="color:#666;">No new reports this week.</td></tr>'}</table>
            <p style="margin-top:24px;"><a href="https://block-beacon-app.lovable.app/map" style="background:#1f5a66;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;">Open the map</a></p>
          </div>`,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
