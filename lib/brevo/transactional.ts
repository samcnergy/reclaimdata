import { sendTransactionalEmail } from "./client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://reclaimdata.ai";

/**
 * Waitlist confirmation. Plainspoken, no emoji, no hype — matches the
 * voice guidelines in CLAUDE.md / the build prompt.
 */
export async function sendWaitlistConfirmation(input: {
  to: { email: string; name?: string };
}) {
  const { email, name } = input.to;
  const greeting = name ? `Hi ${name},` : "Hi,";

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAFAF7;color:#0B1929;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #E5E1D8;border-radius:12px;padding:36px 32px;">
            <tr>
              <td>
                <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#736c5e;">A ReTHINK CNERGY product</p>
                <h1 style="margin:0 0 20px 0;font-family:Georgia,serif;font-size:28px;line-height:1.2;color:#0B1929;">You're on the waitlist.</h1>
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">${greeting}</p>
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">Thanks for signing up for Reclaim Data. We're onboarding businesses in small cohorts so every new workspace gets real attention. You'll hear from us when your slot opens up.</p>
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">In the meantime, if you have questions — reply to this email. Real humans read it.</p>
                <p style="margin:24px 0 0 0;font-size:16px;line-height:1.6;">— The Reclaim Data team</p>
                <hr style="border:none;border-top:1px solid #E5E1D8;margin:28px 0;" />
                <p style="margin:0;font-size:12px;color:#736c5e;">
                  Reclaim Data · <a href="${APP_URL}" style="color:#0B1929;text-decoration:underline;">${APP_URL.replace(/^https?:\/\//, "")}</a> · A <a href="https://rethinkcnergy.com" style="color:#0B1929;text-decoration:underline;">ReTHINK CNERGY</a> product
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${greeting}

Thanks for signing up for Reclaim Data. We're onboarding businesses in small cohorts so every new workspace gets real attention. You'll hear from us when your slot opens up.

If you have questions, reply to this email. Real humans read it.

— The Reclaim Data team

${APP_URL}`;

  return sendTransactionalEmail({
    to: [{ email, name }],
    subject: "You're on the Reclaim Data waitlist",
    htmlContent: html,
    textContent: text,
    tags: ["waitlist", "confirmation"],
  });
}
