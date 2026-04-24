/**
 * ZeroBounce /v2/validate. Single-email validation. Returns a status the
 * DB enum can carry verbatim.
 *
 * https://www.zerobounce.net/docs/email-validation-api-quickstart
 */

export type EmailValidationStatus =
  | "unvalidated"
  | "valid"
  | "risky"
  | "invalid"
  | "disposable"
  | "catch_all";

export type EmailValidationResult = {
  status: EmailValidationStatus;
};

const ZB_BASE = "https://api.zerobounce.net/v2";

export async function validateEmail(
  email: string,
): Promise<EmailValidationResult> {
  const apiKey = process.env.ZEROBOUNCE_API_KEY;
  if (!apiKey) return { status: "unvalidated" };

  try {
    const url = `${ZB_BASE}/validate?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(
        `[validation.email] zerobounce ${res.status}: ${await res.text().catch(() => "")}`,
      );
      return { status: "unvalidated" };
    }

    const data = (await res.json()) as {
      status?: string;
      sub_status?: string;
    };

    const primary = (data.status ?? "").toLowerCase();

    switch (primary) {
      case "valid":
        return { status: "valid" };
      case "invalid":
        return { status: "invalid" };
      case "catch-all":
        return { status: "catch_all" };
      case "spamtrap":
      case "abuse":
      case "do_not_mail":
      case "risky":
        return { status: "risky" };
      case "unknown":
        return { status: "unvalidated" };
      default: {
        // ZeroBounce encodes disposable as sub_status sometimes.
        const sub = (data.sub_status ?? "").toLowerCase();
        if (sub === "disposable") return { status: "disposable" };
        return { status: "unvalidated" };
      }
    }
  } catch (err) {
    console.error(
      `[validation.email] ${err instanceof Error ? err.message : err}`,
    );
    return { status: "unvalidated" };
  }
}
