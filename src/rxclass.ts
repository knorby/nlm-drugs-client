import { type FetchLike, Http, toArray } from "./http.ts";

export const RXCLASS_BASE_URL = "https://rxnav.nlm.nih.gov/REST/rxclass";

export interface RxClassClientOptions {
  /** Override the RxClass REST base URL. */
  baseUrl?: string;
  /** Custom fetch implementation. */
  fetch?: FetchLike;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

/** An RxNorm concept referenced by RxClass. */
export interface RxNormMinConcept {
  rxcui: string;
  name: string;
  tty?: string;
}

/** A drug class (e.g. an ATC class). */
export interface RxClassMinConceptItem {
  classId: string;
  className: string;
  classType?: string;
}

/** A class asserting a relationship to a drug (`class/byRxcui`). */
export interface RxClassDrugInfo {
  minConcept: RxNormMinConcept;
  rxclassMinConceptItem?: RxClassMinConceptItem;
  rela?: string;
  relaSource?: string;
}

/** A fact about a drug's membership in a class. */
export interface RxClassNodeAttr {
  attrName?: string;
  attrValue?: string;
}

/** A drug member of a class, with membership attributes (`classMembers`). */
export interface RxClassDrugMember {
  minConcept: RxNormMinConcept;
  nodeAttr?: RxClassNodeAttr[];
}

export interface FindClassByDrugParams {
  rxcui: string;
}

export interface GetClassMembersParams {
  /** Class identifier (e.g. `A12CA` for ATC, `N0000175656` for DailyMed EPC). */
  classId: string;
  /** Source asserting the drug-class relationship (e.g. `ATC`, `ATCPROD`, `DAILYMED`). */
  relaSource: string;
  /** Restrict to given term types (e.g. `["IN", "SBD"]`). */
  ttys?: string[];
  /** `0` (default) includes indirect members; `1` returns direct members only. */
  trans?: 0 | 1;
}

/**
 * Client for the [RxClass API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxClassAPIs.html).
 */
export class RxClassClient {
  readonly #http: Http;

  constructor(options: RxClassClientOptions = {}) {
    this.#http = new Http({
      baseUrl: options.baseUrl ?? RXCLASS_BASE_URL,
      fetch: options.fetch,
      timeout: options.timeout,
    });
  }

  /** Drug classes containing a given RxNorm concept (`class/byRxcui`). */
  async findClassByDrug(
    params: FindClassByDrugParams,
  ): Promise<RxClassDrugInfo[]> {
    const json = await this.#http.getJson<{
      rxclassDrugInfoList?: {
        rxclassDrugInfo?: RxClassDrugInfo[] | RxClassDrugInfo;
      };
    }>("class/byRxcui.json", { rxcui: params.rxcui });
    return toArray(json.rxclassDrugInfoList?.rxclassDrugInfo);
  }

  /** Drug members of a class (`classMembers`). */
  async getClassMembers(
    params: GetClassMembersParams,
  ): Promise<RxClassDrugMember[]> {
    const json = await this.#http.getJson<{
      drugMemberGroup?: {
        drugMember?: RxClassDrugMember[] | RxClassDrugMember;
      };
    }>("classMembers.json", {
      classId: params.classId,
      relaSource: params.relaSource,
      ttys: params.ttys,
      trans: params.trans,
    });
    return toArray(json.drugMemberGroup?.drugMember);
  }
}
