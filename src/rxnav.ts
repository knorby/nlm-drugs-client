import type { RequestOptions, SourceOperationsClient } from "./operations.js";
import {
  entries,
  finiteNumber,
  integer,
  optionalRecord,
  optionalText,
  record,
  stringList,
  text,
} from "./parse.js";

export interface RxConcept {
  rxcui: string;
  name: string;
  tty: string;
  synonym?: string;
}
export interface RxClassConcept {
  classId: string;
  className: string;
  classType: string;
}
export interface RxTerm {
  rxcui: string;
  displayName: string;
  fullName?: string;
  brandName?: string;
  strength?: string;
  route?: string;
}
export interface RxApproximateMatch {
  rxcui: string;
  rxaui: string;
  score: number;
  rank: number;
  name?: string;
  source?: string;
}
export interface RxClassMember {
  rxcui: string;
  name: string;
  tty: string;
}

type RxCall = SourceOperationsClient["prescribable"];

function rxMethods(call: RxCall, source: string) {
  return {
    /** Searches the selected RxNorm dataset; an empty match is an empty list. */
    async findConcepts(
      name: string,
      options: { search?: 0 | 1 | 2; signal?: AbortSignal } = {},
    ): Promise<string[]> {
      const value = await call.call(
        "findRxcuiByString",
        { name, search: options.search },
        options,
      );
      const group = record(
        record(value, source, "response").idGroup,
        source,
        "idGroup",
      );
      return group.rxnormId === undefined
        ? []
        : stringList(group.rxnormId, source, "idGroup.rxnormId");
    },
    async findByNdc(ndc: string, options?: RequestOptions): Promise<string[]> {
      const value = await call.call(
        "findRxcuiById",
        { idtype: "NDC", id: ndc },
        options,
      );
      const group = record(
        record(value, source, "response").idGroup,
        source,
        "idGroup",
      );
      return group.rxnormId === undefined
        ? []
        : stringList(group.rxnormId, source, "idGroup.rxnormId");
    },
    async getConcept(
      rxcui: string,
      options?: RequestOptions,
    ): Promise<RxConcept | undefined> {
      const value = await call.call(
        "getRxConceptProperties",
        { rxcui },
        options,
      );
      const properties = optionalRecord(
        record(value, source, "response").properties,
        source,
        "properties",
      );
      if (!properties) return undefined;
      return {
        rxcui: text(properties.rxcui, source, "properties.rxcui"),
        name: text(properties.name, source, "properties.name"),
        tty: text(properties.tty, source, "properties.tty"),
        synonym: optionalText(properties.synonym, source, "properties.synonym"),
      };
    },
    async getNdcs(rxcui: string, options?: RequestOptions): Promise<string[]> {
      const value = await call.call("getNDCs", { rxcui }, options);
      const group = record(
        record(value, source, "response").ndcGroup,
        source,
        "ndcGroup",
      );
      const ndcList = optionalRecord(group.ndcList, source, "ndcGroup.ndcList");
      return ndcList?.ndc === undefined
        ? []
        : stringList(ndcList.ndc, source, "ndcGroup.ndcList.ndc");
    },
  };
}

export function createRxNormMethods(call: SourceOperationsClient["rxNorm"]) {
  return {
    ...rxMethods(call, "RxNorm"),
    /** Approximate lexical matches in descending score order; optional active-only scope. */
    async approximateMatches(
      term: string,
      options: RequestOptions & {
        maxEntries?: number;
        activeOnly?: boolean;
      } = {},
    ): Promise<RxApproximateMatch[]> {
      const response = record(
        await call.call(
          "getApproximateMatch",
          {
            term,
            maxEntries: options.maxEntries,
            option: options.activeOnly ? 1 : 0,
          },
          options,
        ),
        "RxNorm",
        "response",
      );
      const group = record(
        response.approximateGroup,
        "RxNorm",
        "approximateGroup",
      );
      return entries(group.candidate, "RxNorm", "candidate").map((item) => {
        const candidate = record(item, "RxNorm", "candidate");
        return {
          rxcui: text(candidate.rxcui, "RxNorm", "candidate.rxcui"),
          rxaui: text(candidate.rxaui, "RxNorm", "candidate.rxaui"),
          score: finiteNumber(candidate.score, "RxNorm", "candidate.score"),
          rank: integer(candidate.rank, "RxNorm", "candidate.rank"),
          name: optionalText(candidate.name, "RxNorm", "candidate.name"),
          source: optionalText(candidate.source, "RxNorm", "candidate.source"),
        };
      });
    },
    async getNdcStatus(
      ndc: string,
      options?: RequestOptions,
    ): Promise<Record<string, unknown>> {
      const value = await call.call("getNDCStatus", { ndc }, options);
      return record(
        record(value, "RxNorm", "response").ndcStatus,
        "RxNorm",
        "ndcStatus",
      );
    },
  };
}

export function createPrescribableMethods(
  call: SourceOperationsClient["prescribable"],
) {
  return rxMethods(call, "Prescribable RxNorm");
}

export function createRxClassMethods(call: SourceOperationsClient["rxClass"]) {
  return {
    /** Retrieves the RxNorm drug concepts assigned to a class by a relationship source. */
    async getMembers(
      input: { classId: string; relaSource: string; rela?: string },
      options?: RequestOptions,
    ): Promise<RxClassMember[]> {
      const value = await call.call("getClassMembers", input, options);
      const wrapper = record(value, "RxClass", "response");
      const group = optionalRecord(
        wrapper.drugMemberGroup,
        "RxClass",
        "drugMemberGroup",
      );
      return entries(group?.drugMember, "RxClass", "drugMember").map((item) => {
        const member = record(item, "RxClass", "drugMember");
        const concept = record(member.minConcept, "RxClass", "minConcept");
        return {
          rxcui: text(concept.rxcui, "RxClass", "rxcui"),
          name: text(concept.name, "RxClass", "name"),
          tty: text(concept.tty, "RxClass", "tty"),
        };
      });
    },
    async findClasses(
      className: string,
      options?: RequestOptions,
    ): Promise<RxClassConcept[]> {
      const value = await call.call("findClassByName", { className }, options);
      const wrapper = record(value, "RxClass", "response");
      const concepts = optionalRecord(
        wrapper.rxclassMinConceptList,
        "RxClass",
        "rxclassMinConceptList",
      );
      return entries(
        concepts?.rxclassMinConcept,
        "RxClass",
        "rxclassMinConcept",
      ).map((item) => {
        const concept = record(item, "RxClass", "class");
        return {
          classId: text(concept.classId, "RxClass", "classId"),
          className: text(concept.className, "RxClass", "className"),
          classType: text(concept.classType, "RxClass", "classType"),
        };
      });
    },
    async findClassesForRxCui(
      rxcui: string,
      options?: RequestOptions & { relaSource?: string },
    ): Promise<RxClassConcept[]> {
      const value = await call.call(
        "getClassByRxNormDrugId",
        { rxcui, relaSource: options?.relaSource },
        options,
      );
      const wrapper = record(value, "RxClass", "response");
      const concepts = optionalRecord(
        wrapper.rxclassDrugInfoList,
        "RxClass",
        "rxclassDrugInfoList",
      );
      return entries(
        concepts?.rxclassDrugInfo,
        "RxClass",
        "rxclassDrugInfo",
      ).map((item) => {
        const info = record(item, "RxClass", "rxclassDrugInfo");
        const concept = record(
          info.rxclassMinConceptItem,
          "RxClass",
          "rxclassMinConceptItem",
        );
        return {
          classId: text(concept.classId, "RxClass", "classId"),
          className: text(concept.className, "RxClass", "className"),
          classType: text(concept.classType, "RxClass", "classType"),
        };
      });
    },
  };
}

export function createRxTermsMethods(call: SourceOperationsClient["rxTerms"]) {
  return {
    async getTerm(
      rxcui: string,
      options?: RequestOptions,
    ): Promise<RxTerm | undefined> {
      const value = await call.call("getAllRxTermInfo", { rxcui }, options);
      const properties = optionalRecord(
        record(value, "RxTerms", "response").rxtermsProperties,
        "RxTerms",
        "rxtermsProperties",
      );
      if (!properties) return undefined;
      return {
        rxcui: text(properties.rxcui, "RxTerms", "rxcui"),
        displayName: text(properties.displayName, "RxTerms", "displayName"),
        fullName: optionalText(properties.fullName, "RxTerms", "fullName"),
        brandName: optionalText(properties.brandName, "RxTerms", "brandName"),
        strength: optionalText(properties.strength, "RxTerms", "strength"),
        route: optionalText(properties.route, "RxTerms", "route"),
      };
    },
  };
}
