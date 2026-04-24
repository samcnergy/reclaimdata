/**
 * Weighted average of per-field extraction confidences. Weights reflect
 * what we care most about being right: name > primary phone > email >
 * address > contract fields.
 */

type ConfidenceInputs = {
  customerConfidence: number; // 0-100
  primaryPhoneConfidence: number | null;
  primaryEmailConfidence: number | null;
  primaryAddressConfidence: number | null;
  contractConfidence: number | null;
};

const WEIGHTS = {
  customer: 0.35,
  phone: 0.2,
  email: 0.2,
  address: 0.15,
  contract: 0.1,
};

export function computeConfidenceScore(i: ConfidenceInputs): number {
  let sum = 0;
  let denom = 0;

  const push = (val: number | null, w: number) => {
    if (val === null) return;
    sum += val * w;
    denom += w;
  };

  push(i.customerConfidence, WEIGHTS.customer);
  push(i.primaryPhoneConfidence, WEIGHTS.phone);
  push(i.primaryEmailConfidence, WEIGHTS.email);
  push(i.primaryAddressConfidence, WEIGHTS.address);
  push(i.contractConfidence, WEIGHTS.contract);

  if (denom === 0) return 0;
  return Math.round(sum / denom);
}
