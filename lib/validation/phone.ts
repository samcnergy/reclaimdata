/**
 * Twilio Lookup v2. Given an E.164 phone, returns validity + line type.
 * Never throws on per-number failures — we want the pipeline to mark the
 * row as unvalidated + move on rather than blow up a batch.
 *
 * https://www.twilio.com/docs/lookup/v2-api
 */

export type PhoneValidationStatus =
  | "unvalidated"
  | "valid"
  | "invalid"
  | "disconnected";

export type PhoneLineType = "mobile" | "landline" | "voip" | "unknown";

export type PhoneValidationResult = {
  status: PhoneValidationStatus;
  lineType: PhoneLineType | null;
  carrier: string | null;
};

const TWILIO_BASE = "https://lookups.twilio.com/v2/PhoneNumbers";

export async function validatePhone(
  e164: string,
): Promise<PhoneValidationResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return { status: "unvalidated", lineType: null, carrier: null };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  try {
    const res = await fetch(
      `${TWILIO_BASE}/${encodeURIComponent(e164)}?Fields=line_type_intelligence`,
      { headers: { authorization: `Basic ${auth}` } },
    );

    if (res.status === 404) {
      return { status: "invalid", lineType: null, carrier: null };
    }
    if (!res.ok) {
      console.error(
        `[validation.phone] twilio ${res.status}: ${await res.text().catch(() => "")}`,
      );
      return { status: "unvalidated", lineType: null, carrier: null };
    }

    const data = (await res.json()) as {
      valid?: boolean;
      line_type_intelligence?: {
        type?: string;
        carrier_name?: string;
      };
    };

    if (data.valid === false) {
      return { status: "invalid", lineType: null, carrier: null };
    }

    const type = data.line_type_intelligence?.type?.toLowerCase();
    const lineType: PhoneLineType = type === "mobile"
      ? "mobile"
      : type === "landline" || type === "fixed"
        ? "landline"
        : type?.includes("voip")
          ? "voip"
          : "unknown";

    return {
      status: "valid",
      lineType,
      carrier: data.line_type_intelligence?.carrier_name ?? null,
    };
  } catch (err) {
    console.error(
      `[validation.phone] ${err instanceof Error ? err.message : err}`,
    );
    return { status: "unvalidated", lineType: null, carrier: null };
  }
}
