import { createFileRoute } from "@tanstack/react-router";
import { escapeHtml, sendMailchimpTransactional } from "@/lib/email.server";

export const Route = createFileRoute("/api/public/contact-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { name, email, message, topic } = await request.json();
        if (!name || !email || !message) {
          return Response.json({ error: "Missing name, email, or message" }, { status: 400 });
        }

        await sendMailchimpTransactional({
          to: process.env["MAILCHIMP_SENDER_EMAIL"] || "ayongwasirri@gmail.com",
          replyTo: email,
          subject: `[BlockBeacon] ${topic || "Community message"} from ${name}`,
          html: `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5">
            <h2>BlockBeacon community message</h2>
            <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
            <p><strong>Topic:</strong> ${escapeHtml(topic || "Contact")}</p>
            <hr>
            <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
          </div>`,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
