import { type FetchLike, Http } from "./http.ts";

export const RXTERMS_BASE_URL = "https://rxnav.nlm.nih.gov/REST/RxTerms";

export interface RxTermsClientOptions {
  /** Override the RxTerms REST base URL. */
  baseUrl?: string;
  /** Custom fetch implementation. */
  fetch?: FetchLike;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

export interface RxcuiParams {
  rxcui: string;
}

/** Prescriber-oriented term for an RxNorm concept (`getAllRxTermInfo`). */
export interface RxTermsProperties {
  brandName?: string;
  displayName?: string;
  synonym?: string;
  fullName?: string;
  fullGenericName?: string;
  strength?: string;
  rxtermsDoseForm?: string;
  route?: string;
  termType?: string;
  rxcui?: string;
  genericRxcui?: string;
  rxnormDoseForm?: string;
  suppress?: string;
}

/**
 * Client for the [RxTerms API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxTermsAPIs.html).
 */
export class RxTermsClient {
  readonly #http: Http;

  constructor(options: RxTermsClientOptions = {}) {
    this.#http = new Http({
      baseUrl: options.baseUrl ?? RXTERMS_BASE_URL,
      fetch: options.fetch,
      timeout: options.timeout,
    });
  }

  /**
   * RxTerms information for an RxNorm concept. Returns `undefined` when the
   * concept is not in the current RxTerms data set.
   */
  async getRxTermsInfo(
    params: RxcuiParams,
  ): Promise<RxTermsProperties | undefined> {
    const json = await this.#http.getJson<{
      rxtermsProperties?: RxTermsProperties;
    }>(`rxcui/${params.rxcui}/allinfo.json`);
    const properties = json.rxtermsProperties;
    if (!properties || Object.keys(properties).length === 0) return undefined;
    return properties;
  }
}
