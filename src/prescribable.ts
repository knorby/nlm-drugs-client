import { type RxNavClientOptions, RxNormClient } from "./rxnorm.ts";

/**
 * Client for the [Prescribable RxNorm API](https://lhncbc.nlm.nih.gov/RxNav/APIs/PrescribableAPIs.html) —
 * the same functions as {@link RxNormClient}, scoped to the RxNorm Current
 * Prescribable Content.
 */
export class PrescribableRxNormClient extends RxNormClient {
  constructor(options: RxNavClientOptions = {}) {
    super(options, "/Prescribe");
  }
}
