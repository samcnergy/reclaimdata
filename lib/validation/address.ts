/**
 * USPS Web Tools (v3). Replaces the original build prompt's Smarty
 * integration — see SETUP_LOG "Service 7: USPS API (replaces Smarty)".
 *
 * OAuth2 client-credentials against https://apis.usps.com/oauth2/v3/token,
 * then GET https://apis.usps.com/addresses/v3/address with the address
 * parts as query params.
 *
 * The access token is cached in-memory for ~8 hours (USPS typical TTL).
 * For horizontal scaling, swap for a Redis-backed cache.
 */

export type AddressValidationStatus =
  | "unvalidated"
  | "valid"
  | "invalid"
  | "missing_unit"
  | "vacant";

export type AddressValidationResult = {
  status: AddressValidationStatus;
  standardized: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  } | null;
};

const USPS_TOKEN_URL = "https://apis.usps.com/oauth2/v3/token";
const USPS_ADDRESS_URL = "https://apis.usps.com/addresses/v3/address";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const id = process.env.USPS_CLIENT_ID;
  const secret = process.env.USPS_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
  });

  const res = await fetch(USPS_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    console.error(
      `[validation.address] USPS token ${res.status}: ${await res.text().catch(() => "")}`,
    );
    return null;
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 28800) * 1000,
  };
  return cachedToken.value;
}

export async function validateAddress(addr: {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}): Promise<AddressValidationResult> {
  if (!addr.line1 || !addr.state) {
    return { status: "unvalidated", standardized: null };
  }

  const token = await getAccessToken();
  if (!token) return { status: "unvalidated", standardized: null };

  const params = new URLSearchParams({
    streetAddress: addr.line1,
    state: addr.state,
  });
  if (addr.line2) params.set("secondaryAddress", addr.line2);
  if (addr.city) params.set("city", addr.city);
  if (addr.postalCode) {
    const [zip5, zip4] = addr.postalCode.split("-");
    if (zip5) params.set("ZIPCode", zip5);
    if (zip4) params.set("ZIPPlus4", zip4);
  }

  try {
    const res = await fetch(`${USPS_ADDRESS_URL}?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.status === 400 || res.status === 404) {
      return { status: "invalid", standardized: null };
    }
    if (!res.ok) {
      console.error(
        `[validation.address] USPS ${res.status}: ${await res.text().catch(() => "")}`,
      );
      return { status: "unvalidated", standardized: null };
    }

    const data = (await res.json()) as {
      address?: {
        streetAddress?: string;
        secondaryAddress?: string;
        city?: string;
        state?: string;
        ZIPCode?: string;
        ZIPPlus4?: string;
      };
      additionalInfo?: {
        DPVConfirmation?: string; // Y/S/D/N
        vacant?: string; // Y/N
      };
    };

    const dpv = data.additionalInfo?.DPVConfirmation;
    const vacant = data.additionalInfo?.vacant === "Y";

    const standardized = data.address
      ? {
          line1: data.address.streetAddress ?? null,
          line2: data.address.secondaryAddress ?? null,
          city: data.address.city ?? null,
          state: data.address.state ?? null,
          postalCode: data.address.ZIPPlus4
            ? `${data.address.ZIPCode}-${data.address.ZIPPlus4}`
            : (data.address.ZIPCode ?? null),
        }
      : null;

    if (vacant) return { status: "vacant", standardized };
    if (dpv === "Y") return { status: "valid", standardized };
    if (dpv === "S" || dpv === "D") {
      return { status: "missing_unit", standardized };
    }
    if (dpv === "N") return { status: "invalid", standardized };

    return { status: "unvalidated", standardized };
  } catch (err) {
    console.error(
      `[validation.address] ${err instanceof Error ? err.message : err}`,
    );
    return { status: "unvalidated", standardized: null };
  }
}
