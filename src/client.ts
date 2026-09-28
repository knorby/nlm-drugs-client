import { MedlinePlusConnectClient } from "./connect.ts";
import { DailyMedClient } from "./dailymed.ts";
import type { FetchLike } from "./http.ts";
import { PrescribableRxNormClient } from "./prescribable.ts";
import { RxClassClient } from "./rxclass.ts";
import { RxNormClient } from "./rxnorm.ts";
import { RxTermsClient } from "./rxterms.ts";

export interface NlmClientOptions {
  /** Base URL for the RxNav-hosted APIs (RxNorm, Prescribable, RxTerms, RxClass). */
  rxnavBaseUrl?: string;
  /** Base URL for the DailyMed v2 API. */
  dailymedBaseUrl?: string;
  /** URL for the MedlinePlus Connect service. */
  connectBaseUrl?: string;
  /** Custom fetch implementation (polyfill, instrumentation, or test stub). */
  fetch?: FetchLike;
  /** Request timeout in milliseconds for every sub-client. */
  timeout?: number;
}

/** Entry point bundling every NLM drug API sub-client. */
export interface NlmClient {
  readonly rxnorm: RxNormClient;
  readonly prescribable: PrescribableRxNormClient;
  readonly rxterms: RxTermsClient;
  readonly rxclass: RxClassClient;
  readonly dailymed: DailyMedClient;
  readonly connect: MedlinePlusConnectClient;
}

/** Create a client for all supported NLM drug APIs. */
export function createNlmClient(options: NlmClientOptions = {}): NlmClient {
  const rxnav = {
    baseUrl: options.rxnavBaseUrl,
    fetch: options.fetch,
    timeout: options.timeout,
  };
  return {
    rxnorm: new RxNormClient(rxnav),
    prescribable: new PrescribableRxNormClient(rxnav),
    rxterms: new RxTermsClient(rxnav),
    rxclass: new RxClassClient(rxnav),
    dailymed: new DailyMedClient({
      baseUrl: options.dailymedBaseUrl,
      fetch: options.fetch,
      timeout: options.timeout,
    }),
    connect: new MedlinePlusConnectClient({
      baseUrl: options.connectBaseUrl,
      fetch: options.fetch,
      timeout: options.timeout,
    }),
  };
}
