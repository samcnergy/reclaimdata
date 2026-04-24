/**
 * Minimal Brevo (transactional) HTTP client.
 *
 * We avoid @getbrevo/brevo SDK — it ships CommonJS-only bundles that
 * confuse Next's edge/server split. fetch + an API key header is enough.
 */

const BREVO_API_URL = "https://api.brevo.com/v3";

type BrevoContact = { email: string; name?: string };

export type SendTransactionalEmailInput = {
  to: BrevoContact[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: BrevoContact;
  tags?: string[];
  params?: Record<string, string | number | boolean>;
};

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<{ messageId: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");

  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "hello@reclaimdata.ai";
  const senderName = process.env.BREVO_SENDER_NAME ?? "Reclaim Data";

  const res = await fetch(`${BREVO_API_URL}/smtp/email`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: input.to,
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
      replyTo: input.replyTo,
      tags: input.tags,
      params: input.params,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { messageId: string };
  return { messageId: data.messageId };
}
