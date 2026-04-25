/**
 * USPS Web Tools (v3). Replaces the original build prompt's Smarty
 * integration — see SETUP_LOG "Service 7: USPS API (replaces Smarty)".
 *
 * Three-step fallback chain so partial address data still resolves:
 *   1. Full address lookup (street + state OR ZIP) → /addresses/v3/address
 *   2. ZIP-only lookup (ZIP, no street) → /addresses/v3/city-state
 *   3. Otherwise leave the row unvalidated.
 *
 * The access token is cached in-memory for ~8 hours.
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
const USPS_CITY_STATE_URL = "https://apis.usps.com/addresses/v3/city-state";

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
  const hasStreet = !!addr.line1?.trim();
  const hasState = !!addr.state?.trim();
  const hasZip = !!addr.postalCode?.trim();

  // Need either a street OR a zip to resolve anything.
  if (!hasStreet && !hasZip) {
    return { status: "unvalidated", standardized: null };
  }

  const token = await getAccessToken();
  if (!token) return { status: "unvalidated", standardized: null };

  // Branch 1: full address lookup. USPS accepts state OR ZIP — either is
  // enough to disambiguate the rest. We don't require both.
  if (hasStreet && (hasState || hasZip)) {
    return await fullAddressLookup(addr, token);
  }

  // Branch 2: only ZIP available. Resolve city + state from ZIP. We don't
  // mark the address as "valid" because we can't verify deliverability
  // without the street — but we DO standardize city/state and return a
  // partial standardized payload that callers can merge in.
  if (!hasStreet && hasZip) {
    return await cityStateFromZip(addr.postalCode!.trim(), token);
  }

  return { status: "unvalidated", standardized: null };
}

async function fullAddressLookup(
  addr: { line1: string | null; line2: string | null; city: string | null; state: string | null; postalCode: string | null },
  token: string,
): Promise<AddressValidationResult> {
  const params = new URLSearchParams({ streetAddress: addr.line1!.trim() });
  if (addr.line2?.trim()) params.set("secondaryAddress", addr.line2.trim());
  if (addr.city?.trim()) params.set("city", addr.city.trim());
  if (addr.state?.trim()) params.set("state", addr.state.trim().toUpperCase());
  if (addr.postalCode?.trim()) {
    const [zip5, zip4] = addr.postalCode.trim().split("-");
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
        `[validation.address] USPS /address ${res.status}: ${await res.text().catch(() => "")}`,
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

    // The /address endpoint echoes the input city/state verbatim instead
    // of canonicalizing them — so "RSM" stays "RSM". Cross-reference the
    // ZIP via /city-state to get the USPS-canonical locality and
    // overwrite. Only worth doing when we got a usable ZIP back.
    const responseZip = data.address?.ZIPCode ?? null;
    let canonicalCity: string | null = null;
    let canonicalState: string | null = null;
    if (responseZip) {
      const cs = await cityStateFromZip(responseZip, token);
      if (cs.standardized?.city) canonicalCity = cs.standardized.city;
      if (cs.standardized?.state) canonicalState = cs.standardized.state;
    }

    const standardized = data.address
      ? {
          line1: data.address.streetAddress ?? null,
          line2: data.address.secondaryAddress ?? null,
          // Prefer the canonical city/state from the ZIP lookup. The
          // /address endpoint just echoes whatever we sent (e.g. "RSM")
          // even though the ZIP unambiguously resolves it.
          city: canonicalCity ?? data.address.city ?? null,
          state: canonicalState ?? data.address.state ?? null,
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

async function cityStateFromZip(
  postalCode: string,
  token: string,
): Promise<AddressValidationResult> {
  const zip5 = postalCode.split("-")[0];
  if (!/^\d{5}$/.test(zip5)) {
    return { status: "unvalidated", standardized: null };
  }

  try {
    const res = await fetch(`${USPS_CITY_STATE_URL}?ZIPCode=${zip5}`, {
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.status === 400 || res.status === 404) {
      return { status: "invalid", standardized: null };
    }
    if (!res.ok) {
      console.error(
        `[validation.address] USPS /city-state ${res.status}: ${await res.text().catch(() => "")}`,
      );
      return { status: "unvalidated", standardized: null };
    }

    const data = (await res.json()) as {
      city?: string;
      state?: string;
      ZIPCode?: string;
    };

    if (!data.city || !data.state) {
      return { status: "unvalidated", standardized: null };
    }

    return {
      // We only resolved the locality, not the street. Don't mark "valid"
      // — that implies USPS confirmed deliverability of a specific
      // address. Use 'unvalidated' so the next pass with a street will
      // properly verify.
      status: "unvalidated",
      standardized: {
        line1: null,
        line2: null,
        city: data.city,
        state: data.state,
        postalCode: data.ZIPCode ?? zip5,
      },
    };
  } catch (err) {
    console.error(
      `[validation.address] city-state ${err instanceof Error ? err.message : err}`,
    );
    return { status: "unvalidated", standardized: null };
  }
}
