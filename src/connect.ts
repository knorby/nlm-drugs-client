import { type FetchLike, Http, toArray } from "./http.ts";

export const MEDLINEPLUS_CONNECT_BASE_URL =
  "https://connect.medlineplus.gov/service";

export interface MedlinePlusConnectClientOptions {
  /** Override the MedlinePlus Connect service URL. */
  baseUrl?: string;
  /** Custom fetch implementation. */
  fetch?: FetchLike;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

/** Code systems MedlinePlus Connect can match against. */
export type ConnectCodeSystem = "rxnorm" | "ndc" | "icd10cm" | "snomedct";

const CODE_SYSTEM_OIDS: Record<ConnectCodeSystem, string> = {
  rxnorm: "2.16.840.1.113883.6.88",
  ndc: "2.16.840.1.113883.6.69",
  icd10cm: "2.16.840.1.113883.6.90",
  snomedct: "2.16.840.1.113883.6.96",
};

export interface ConnectParams {
  codeSystem: ConnectCodeSystem;
  code: string;
}

/** A consumer-health topic matched to a code. */
export interface ConnectResult {
  title?: string;
  url: string;
  summary?: string;
  updated?: string;
}

interface ConnectEntry {
  title?: { _value?: string };
  link?: { href?: string; rel?: string }[];
  summary?: { _value?: string };
  updated?: { _value?: string };
}

/**
 * Client for the [MedlinePlus Connect web service](https://medlineplus.gov/medlineplus-connect/web-service/).
 */
export class MedlinePlusConnectClient {
  readonly #http: Http;

  constructor(options: MedlinePlusConnectClientOptions = {}) {
    this.#http = new Http({
      baseUrl: options.baseUrl ?? MEDLINEPLUS_CONNECT_BASE_URL,
      fetch: options.fetch,
      timeout: options.timeout,
    });
  }

  /**
   * Match a medication or diagnosis code to MedlinePlus consumer-health
   * topics.
   */
  async connect(params: ConnectParams): Promise<ConnectResult[]> {
    const json = await this.#http.getJson<{
      feed?: { entry?: ConnectEntry[] | ConnectEntry };
    }>("", {
      "mainSearchCriteria.v.cs": CODE_SYSTEM_OIDS[params.codeSystem],
      "mainSearchCriteria.v.c": params.code,
      knowledgeResponseType: "application/json",
    });
    return toArray(json.feed?.entry).map((entry) => ({
      title: entry.title?._value,
      url: entry.link?.find((link) => link.href)?.href ?? "",
      summary: entry.summary?._value,
      updated: entry.updated?._value,
    }));
  }
}
