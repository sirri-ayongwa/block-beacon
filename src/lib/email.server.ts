const adminEmail = process.env.ADMIN_EMAIL || "ayongwasirri@gmail.com";

export function escapeHtml(value: string | null | undefined) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char] as string));
}

export async function sendResendEmail(input: {
  to?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "BlockBeacon <onboarding@resend.dev>",
      to: input.to ?? [adminEmail],
      reply_to: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }

  return response.json();
}

export async function sendMailchimpTransactional(input: {
  to: string;
  name?: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) throw new Error("MAILCHIMP_API_KEY is not configured");

  const response = await fetch("https://mandrillapp.com/api/1.0/messages/send.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: apiKey,
      message: {
        from_email: adminEmail,
        from_name: "BlockBeacon",
        subject: input.subject,
        html: input.html,
        to: [{ email: input.to, name: input.name || "neighbor", type: "to" }],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Mailchimp failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }

  return response.json();
}
