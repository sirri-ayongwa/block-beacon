import { createFileRoute } from "@tanstack/react-router";

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export const Route = createFileRoute("/api/public/weekly-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("apikey") ?? request.headers.get("Authorization")?.replace(/^Bearer\s+/, "");
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!publishable || provided !== publishable) {
          return new Response("Unauthorized", { status: 401 });
        }

        const brevoKey = process.env.BREVO_API_KEY;
        const senderEmail = process.env.BREVO_SENDER_EMAIL;
        if (!brevoKey || !senderEmail) {
          return Response.json({ error: "Brevo not configured" }, { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profiles, error: pErr } = await (supabaseAdmin.from("profiles" as any) as any)
          .select("id, display_name, digest_subscribed")
          .eq("digest_subscribed", true);
        if (pErr) return Response.json({ error: pErr.message }, { status: 500 });
        if (!profiles?.length) return Response.json({ sent: 0, note: "No subscribers" });

        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: issues } = await supabaseAdmin
          .from("issues")
          .select("id, title, category, status, upvote_count, created_at")
          .gte("created_at", since)
          .order("upvote_count", { ascending: false })
          .limit(10);

        let sent = 0;
        const failures: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const profile of profiles as any[]) {
          try {
            const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(profile.id);
            const email = userRes?.user?.email;
            if (!email) continue;
            const name = profile.display_name ?? "neighbor";
            const rows = (issues ?? []).map((i) =>
              `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;"><strong>${escapeHtml(i.title)}</strong><br/><span style="color:#666;font-size:12px;">${escapeHtml(i.category)} · ${i.upvote_count} upvotes · ${i.status}</span></td></tr>`
            ).join("");
            const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;"><h2 style="color:#1f5a66;">Hi ${escapeHtml(name)}, here's your BlockBeacon week</h2><p style="color:#333;">Top neighborhood issues over the past 7 days:</p><table style="width:100%;border-collapse:collapse;">${rows || '<tr><td style="color:#666;">No new reports this week — quiet block!</td></tr>'}</table><p style="margin-top:24px;"><a href="https://block-beacon-app.lovable.app/map" style="background:#1f5a66;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;">Open the map</a></p><p style="color:#999;font-size:11px;margin-top:32px;">You're receiving this because you opted in. Turn it off in Settings.</p></div>`;

            const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
              method: "POST",
              headers: { "Content-Type": "application/json", "api-key": brevoKey },
              body: JSON.stringify({
                sender: { name: "BlockBeacon", email: senderEmail },
                to: [{ email, name }],
                subject: "Your BlockBeacon weekly digest",
                htmlContent: html,
              }),
            });
            if (!brevoRes.ok) {
              const text = await brevoRes.text();
              failures.push(`${email}: ${brevoRes.status} ${text.slice(0, 80)}`);
              continue;
            }
            sent++;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin.from("profiles" as any) as any)
              .update({ digest_last_sent_at: new Date().toISOString() })
              .eq("id", profile.id);
          } catch (err) {
            failures.push(profile.id + ": " + (err instanceof Error ? err.message : String(err)));
          }
        }

        return Response.json({ sent, failures });
      },
    },
  },
});