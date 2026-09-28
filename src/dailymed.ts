import { NlmApiError } from "./error.ts";
import { type FetchLike, Http } from "./http.ts";

export const DAILYMED_V2_BASE_URL =
  "https://dailymed.nlm.nih.gov/dailymed/services/v2";

export interface DailyMedClientOptions {
  /** Override the DailyMed v2 base URL. */
  baseUrl?: string;
  /** Custom fetch implementation. */
  fetch?: FetchLike;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

/** Pagination metadata returned by every DailyMed v2 list resource. */
export interface DailyMedMetadata {
  total_elements?: number;
  total_pages?: number;
  current_page?: number;
  elements_per_page?: number;
  [key: string]: unknown;
}

/** A Structured Product Label listing entry. */
export interface DailyMedSpl {
  setid: string;
  title?: string;
  published_date?: string;
  spl_version?: number;
}

/** One version of a label. */
export interface DailyMedSplVersion {
  spl_version?: number;
  published_date?: string;
}

/** Version history for a label SET ID. */
export interface DailyMedSplHistory {
  spl: { setid: string; title?: string };
  history: DailyMedSplVersion[];
}

/** An entry from the drug-name index. */
export interface DailyMedDrugName {
  drug_name: string;
  name_type?: string;
}

/** An entry from the UNII index. */
export interface DailyMedUnii {
  unii_code: string;
  active_moiety?: string;
}

export interface GetSplsParams {
  /** Filter by drug name (wildcards allowed). */
  drugName?: string;
  /** Page number (100 elements per page). */
  page?: number;
}

export interface PageParams {
  page?: number;
}

/**
 * Client for the [DailyMed API v2](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm).
 */
export class DailyMedClient {
  readonly #http: Http;

  constructor(options: DailyMedClientOptions = {}) {
    this.#http = new Http({
      baseUrl: options.baseUrl ?? DAILYMED_V2_BASE_URL,
      fetch: options.fetch,
      timeout: options.timeout,
    });
  }

  /** Search current SPL listings (`spls`). */
  async getSpls(
    params: GetSplsParams = {},
  ): Promise<{ metadata: DailyMedMetadata; data: DailyMedSpl[] }> {
    return this.#http.getJson("spls.json", {
      drug_name: params.drugName,
      page: params.page,
    });
  }

  /** Download the label document for a SET ID as raw SPL XML (`spls/{setId}`). */
  async getSpl(params: { setId: string }): Promise<string> {
    return this.#http.getText(`spls/${params.setId}.xml`);
  }

  /** Version history for a label SET ID (`spls/{setId}/history`). */
  async getSplHistory(params: { setId: string }): Promise<DailyMedSplHistory> {
    const path = `spls/${params.setId}/history.json`;
    const json = await this.#http.getJson<{
      data?: DailyMedSplHistory;
    }>(path);
    const history = json.data;
    if (!history) {
      throw new NlmApiError(
        404,
        this.#http.buildUrl(path),
        json,
        `No SPL history for SET ID ${params.setId}`,
      );
    }
    return history;
  }

  /** The drug-name index (`drugnames`). */
  async getDrugnames(
    params: PageParams = {},
  ): Promise<{ metadata: DailyMedMetadata; data: DailyMedDrugName[] }> {
    return this.#http.getJson("drugnames.json", { page: params.page });
  }

  /** The UNII index (`uniis`). */
  async getUniis(
    params: PageParams = {},
  ): Promise<{ metadata: DailyMedMetadata; data: DailyMedUnii[] }> {
    return this.#http.getJson("uniis.json", { page: params.page });
  }
}
