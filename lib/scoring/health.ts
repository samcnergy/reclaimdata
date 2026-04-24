/**
 * Data completeness score per the build spec:
 *
 *   name                       20
 *   primary phone              20
 *   primary email              20
 *   primary address            20
 *   last contract date         10
 *   scope of work              5
 *   at least one line item     5
 *                             ---
 *                             100
 *
 * Returns an integer 0–100.
 */

export type HealthInputs = {
  hasName: boolean;
  hasPrimaryPhone: boolean;
  hasPrimaryEmail: boolean;
  hasPrimaryAddress: boolean;
  hasLastContractDate: boolean;
  hasScope: boolean;
  hasLineItem: boolean;
};

export function computeHealthScore(i: HealthInputs): number {
  let score = 0;
  if (i.hasName) score += 20;
  if (i.hasPrimaryPhone) score += 20;
  if (i.hasPrimaryEmail) score += 20;
  if (i.hasPrimaryAddress) score += 20;
  if (i.hasLastContractDate) score += 10;
  if (i.hasScope) score += 5;
  if (i.hasLineItem) score += 5;
  return Math.min(100, score);
}
