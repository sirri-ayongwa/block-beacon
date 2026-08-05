function getServerEnv(name: string) {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

export function escapeHtml(value: string | null | undefined) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char] as string));
}

export async function sendMailchimpTransactional(input: {
  to: string;
  name?: string;
  subject: string;
  html: string;
}) {
  const apiKey = getServerEnv("MAILCHIMP_API_KEY");
  if (!apiKey) throw new Error("MAILCHIMP_API_KEY is not configured");
  const sender = getServerEnv("MAILCHIMP_SENDER_EMAIL");
  if (!sender) throw new Error("MAILCHIMP_SENDER_EMAIL is not configured");

  const response = await fetch("https://mandrillapp.com/api/1.0/messages/send.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: apiKey,
      message: {
        from_email: sender,
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

/** Sends BlockBeacon digest messages exclusively through Mailchimp Transactional. */
export async function sendTransactionalEmail(input: {
  to: string;
  name?: string;
  subject: string;
  html: string;
}) {
  return sendMailchimpTransactional(input);
}

export type DigestIssue = {
  title?: string;
  category?: string;
  status?: string;
  upvote_count?: number;
};

const STATUS_TEXT: Record<string, string> = {
  open: "Needs attention",
  acknowledged: "City is looking",
  fixed: "Fixed",
};

export function buildDigestHtml(name: string | undefined, issues: DigestIssue[]) {
  const rows = issues.slice(0, 10).map((issue) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #ece5db;">
        <div style="font-size:15px;font-weight:600;color:#14343b;">${escapeHtml(issue.title || "Untitled report")}</div>
        <div style="margin-top:4px;font-size:12px;color:#6b6259;">
          ${escapeHtml(issue.category || "other")}
          &nbsp;·&nbsp; <span style="color:#1f5a66;font-weight:600;">${escapeHtml(STATUS_TEXT[String(issue.status)] || String(issue.status || "Needs attention"))}</span>
          &nbsp;·&nbsp; ${Number(issue.upvote_count || 0)} neighbors backing it
        </div>
      </td>
    </tr>`).join("");

  return `<!doctype html>
<html><body style="margin:0;background:#faf6f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
    <div style="background:#1f5a66;border-radius:20px 20px 0 0;padding:26px 24px;">
      <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.2px;">BlockBeacon</div>
      <div style="color:#bfe0e4;font-size:13px;margin-top:4px;">Your weekly neighborhood roundup</div>
    </div>
    <div style="background:#ffffff;border:1px solid #ece5db;border-top:none;border-radius:0 0 20px 20px;padding:24px;">
      <p style="margin:0 0 6px;font-size:16px;color:#14343b;">Hi ${escapeHtml(name || "neighbor")},</p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#57504a;">
        Here's what your neighbors reported and what moved forward in the last seven days.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        ${rows || '<tr><td style="padding:14px 0;color:#6b6259;font-size:14px;">A quiet week — no new reports on your block.</td></tr>'}
      </table>
      <div style="text-align:center;margin-top:26px;">
        <a href="https://block-beacon-app.lovable.app/map" style="display:inline-block;background:#e8734a;color:#ffffff;padding:12px 26px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;">Open the map</a>
      </div>
      <p style="margin:24px 0 0;font-size:11px;color:#8d857d;text-align:center;line-height:1.6;">
        You're getting this because you subscribed to the BlockBeacon weekly digest.<br/>
        Turn it off any time in Settings.
      </p>
    </div>
  </div>
</body></html>`;
}

export async function sendResendEmail(input: {
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}) {
  return sendMailchimpTransactional({
    to: getServerEnv("ADMIN_EMAIL") || "admin@blockbeacon.app",
    name: "BlockBeacon Admin",
    subject: input.subject,
    html: input.html,
  });
}
