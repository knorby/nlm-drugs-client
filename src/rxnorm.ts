import { NlmApiError } from "./error.ts";
import { type FetchLike, Http, joinBaseUrl, toArray } from "./http.ts";

export const RXNAV_REST_BASE_URL = "https://rxnav.nlm.nih.gov/REST";

export interface RxNavClientOptions {
  /** Override the RxNav REST base URL (e.g. a local RxNav-in-a-Box). */
  baseUrl?: string;
  /** Custom fetch implementation. */
  fetch?: FetchLike;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

export interface FindRxcuiByStringParams {
  /** Drug name to search for. */
  name: string;
  /** Search all RxNorm sources instead of the default set. */
  allSources?: 0 | 1 | "approximate";
  /** Restrict the search to specific vocabulary sources. */
  sourceList?: string[];
}

export interface ApproximateTermParams {
  /** Free text to match approximately. */
  term: string;
  /** Maximum number of candidates to return (default 20). */
  maxEntries?: number;
}

export interface RxcuiParams {
  rxcui: string;
}

/** Candidate match from `approximateTerm`. */
export interface ApproximateTermCandidate {
  rxcui: string;
  rxaui?: string;
  name?: string;
  score?: string;
  rank?: string;
  source?: string;
}

/** Core properties of an RxNorm concept. */
export interface RxNormConceptProperty {
  rxcui: string;
  name: string;
  tty?: string;
  synonym?: string;
  [key: string]: unknown;
}

/** A group of related concepts sharing a term type (TTY). */
export interface RxNormConceptGroup {
  tty?: string;
  conceptProperties?: RxNormConceptProperty[] | null;
  [key: string]: unknown;
}

/** Life-cycle status of an RxNorm concept. */
export interface RxcuiStatusHistory {
  metaData: Record<string, string>;
  attributes?: Record<string, unknown>;
  definitionalFeatures?: Record<string, unknown>;
  pack?: Record<string, unknown>;
  derivedConcepts?: Record<string, unknown>;
}

/**
 * Client for the [RxNorm API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html).
 */
export class RxNormClient {
  protected readonly http: Http;

  constructor(options: RxNavClientOptions = {}, basePath = "") {
    this.http = new Http({
      baseUrl: joinBaseUrl(options.baseUrl ?? RXNAV_REST_BASE_URL, basePath),
      fetch: options.fetch,
      timeout: options.timeout,
    });
  }

  /** Concepts whose names match `name` (`findRxcuiByString`). */
  async findRxcuiByString(params: FindRxcuiByStringParams): Promise<string[]> {
    const json = await this.http.getJson<{
      idGroup?: { rxnormId?: string[] | string };
    }>("rxcui.json", {
      name: params.name,
      allsrc: params.allSources,
      srclist: params.sourceList?.join(","),
    });
    return toArray(json.idGroup?.rxnormId);
  }

  /** Concepts approximately matching free text (`approximateTerm`). */
  async approximateTerm(
    params: ApproximateTermParams,
  ): Promise<ApproximateTermCandidate[]> {
    const json = await this.http.getJson<{
      approximateGroup?: {
        candidate?: ApproximateTermCandidate[] | ApproximateTermCandidate;
      };
    }>("approximateTerm.json", {
      term: params.term,
      maxEntries: params.maxEntries,
    });
    return toArray(json.approximateGroup?.candidate);
  }

  /** National Drug Codes associated with a concept (`getNDCs`). */
  async getNDCs(params: RxcuiParams): Promise<string[]> {
    const json = await this.http.getJson<{
      ndcGroup?: { ndcList?: { ndc?: string[] | string } };
    }>(`rxcui/${params.rxcui}/ndcs.json`);
    return toArray(json.ndcGroup?.ndcList?.ndc);
  }

  /** Concepts related to a concept, grouped by term type (`getAllRelatedInfo`). */
  async getAllRelatedInfo(params: RxcuiParams): Promise<RxNormConceptGroup[]> {
    const json = await this.http.getJson<{
      allRelatedGroup?: { conceptGroup?: RxNormConceptGroup[] };
    }>(`rxcui/${params.rxcui}/allrelated.json`);
    return toArray(json.allRelatedGroup?.conceptGroup);
  }

  /** Active/quantified/obsolete status of a concept (`getRxcuiHistoryStatus`). */
  async getRxcuiHistoryStatus(
    params: RxcuiParams,
  ): Promise<RxcuiStatusHistory> {
    const path = `rxcui/${params.rxcui}/historystatus.json`;
    const json = await this.http.getJson<{
      rxcuiStatusHistory?: RxcuiStatusHistory;
    }>(path);
    const history = json.rxcuiStatusHistory;
    if (!history) {
      throw new NlmApiError(
        404,
        this.http.buildUrl(path),
        json,
        `No status history for RxCUI ${params.rxcui}`,
      );
    }
    return history;
  }
}
