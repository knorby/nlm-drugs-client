/**
 * Fully typed client for the U.S. National Library of Medicine drug APIs:
 * RxNorm, Prescribable RxNorm, RxTerms, RxClass, DailyMed v2, and
 * MedlinePlus Connect.
 *
 * @example
 * ```ts
 * import { createNlmClient } from "@knorby/nlm-drugs-client";
 *
 * const nlm = createNlmClient();
 * const [rxcui] = await nlm.rxnorm.findRxcuiByString({ name: "lipitor" });
 * ```
 *
 * @module
 */

export type { NlmClient, NlmClientOptions } from "./client.ts";
export { createNlmClient } from "./client.ts";
export type {
  ConnectCodeSystem,
  ConnectParams,
  ConnectResult,
  MedlinePlusConnectClientOptions,
} from "./connect.ts";
export { MedlinePlusConnectClient } from "./connect.ts";
export type {
  DailyMedClientOptions,
  DailyMedDrugName,
  DailyMedMetadata,
  DailyMedSpl,
  DailyMedSplHistory,
  DailyMedSplVersion,
  DailyMedUnii,
  GetSplsParams,
  PageParams,
} from "./dailymed.ts";
export { DailyMedClient } from "./dailymed.ts";
export { NlmApiError } from "./error.ts";
export type { FetchLike, HttpConfig, QueryParams, QueryValue } from "./http.ts";
export { Http, joinBaseUrl, toArray } from "./http.ts";
export { PrescribableRxNormClient } from "./prescribable.ts";
export type {
  FindClassByDrugParams,
  GetClassMembersParams,
  RxClassClientOptions,
  RxClassDrugInfo,
  RxClassDrugMember,
  RxClassMinConceptItem,
  RxClassNodeAttr,
  RxNormMinConcept,
} from "./rxclass.ts";
export { RxClassClient } from "./rxclass.ts";
export type {
  ApproximateTermCandidate,
  ApproximateTermParams,
  FindRxcuiByStringParams,
  RxcuiParams,
  RxcuiStatusHistory,
  RxNavClientOptions,
  RxNormConceptGroup,
  RxNormConceptProperty,
} from "./rxnorm.ts";
export { RxNormClient } from "./rxnorm.ts";
export type {
  RxTermsClientOptions,
  RxTermsProperties,
} from "./rxterms.ts";
export { RxTermsClient } from "./rxterms.ts";
