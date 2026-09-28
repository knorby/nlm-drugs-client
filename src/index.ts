/** Typed clients for NLM terminology, labels, literature and related public biomedical services. */
import { createClinicalTrialsClient } from "./clinical-trials.js";
import { createDailyMedMethods } from "./dailymed.js";
import {
  createConnectMethods,
  createGeneticsClient,
  createMedlinePlusClient,
} from "./medlineplus.js";
import { createMeshMethods } from "./mesh.js";
import { type ClientOptions, SourceOperationsClient } from "./operations.js";
import { createPubChemClient } from "./pubchem.js";
import { createPubMedMethods } from "./pubmed.js";
import {
  createPrescribableMethods,
  createRxClassMethods,
  createRxNormMethods,
  createRxTermsMethods,
} from "./rxnav.js";
import { createUmlsClient } from "./umls.js";

export type {
  ClinicalSearch,
  ClinicalStudiesPage,
  ClinicalStudy,
} from "./clinical-trials.js";
export type { SplPage, SplSearch, SplSummary } from "./dailymed.js";
export type {
  GeneticsSearchPage,
  GeneticsSearchResult,
  MedlinePage,
  TopicSearchOptions,
  TopicSearchPage,
} from "./medlineplus.js";
export type { MeshDescriptor } from "./mesh.js";
export type {
  ClientOptions,
  ConnectInput,
  DailyMedDownload,
  DrugCode,
  Parameters,
  PubMedRequestOptions,
  QueryValue,
  RequestOptions,
} from "./operations.js";
export { NlmHttpError } from "./operations.js";
export { NlmResponseError } from "./parse.js";
export type { CompoundProperties, CompoundProperty } from "./pubchem.js";
export type { PubMedSearchPage, PubMedSummary } from "./pubmed.js";
export type {
  RxApproximateMatch,
  RxClassConcept,
  RxClassMember,
  RxConcept,
  RxTerm,
} from "./rxnav.js";
export type { UmlsResult, UmlsSearchOptions } from "./umls.js";

/** Source-specific typed methods with the complete catalog available through `.call`. */
export class NlmDrugsClient extends SourceOperationsClient {
  declare readonly rxNorm: SourceOperationsClient["rxNorm"] &
    ReturnType<typeof createRxNormMethods>;
  declare readonly prescribable: SourceOperationsClient["prescribable"] &
    ReturnType<typeof createPrescribableMethods>;
  declare readonly rxClass: SourceOperationsClient["rxClass"] &
    ReturnType<typeof createRxClassMethods>;
  declare readonly rxTerms: SourceOperationsClient["rxTerms"] &
    ReturnType<typeof createRxTermsMethods>;
  declare readonly dailyMed: SourceOperationsClient["dailyMed"] &
    ReturnType<typeof createDailyMedMethods>;
  declare readonly mesh: SourceOperationsClient["mesh"] &
    ReturnType<typeof createMeshMethods>;
  declare readonly pubMed: SourceOperationsClient["pubMed"] &
    ReturnType<typeof createPubMedMethods>;
  declare readonly medlinePlusConnect: SourceOperationsClient["medlinePlusConnect"] &
    ReturnType<typeof createConnectMethods>;
  readonly medlinePlus: ReturnType<typeof createMedlinePlusClient>;
  readonly medlinePlusGenetics: ReturnType<typeof createGeneticsClient>;
  readonly umls: ReturnType<typeof createUmlsClient>;
  readonly clinicalTrials: ReturnType<typeof createClinicalTrialsClient>;
  readonly pubChem: ReturnType<typeof createPubChemClient>;

  constructor(options: ClientOptions = {}) {
    super(options);
    this.rxNorm = Object.assign(this.rxNorm, createRxNormMethods(this.rxNorm));
    this.prescribable = Object.assign(
      this.prescribable,
      createPrescribableMethods(this.prescribable),
    );
    this.rxClass = Object.assign(
      this.rxClass,
      createRxClassMethods(this.rxClass),
    );
    this.rxTerms = Object.assign(
      this.rxTerms,
      createRxTermsMethods(this.rxTerms),
    );
    this.dailyMed = Object.assign(
      this.dailyMed,
      createDailyMedMethods(this.dailyMed),
    );
    this.mesh = Object.assign(this.mesh, createMeshMethods(this.mesh));
    this.pubMed = Object.assign(this.pubMed, createPubMedMethods(this.pubMed));
    this.medlinePlusConnect = Object.assign(
      this.medlinePlusConnect,
      createConnectMethods(this.medlinePlusConnect),
    );
    this.medlinePlus = createMedlinePlusClient(this.transport);
    this.medlinePlusGenetics = createGeneticsClient(this.transport);
    this.umls = createUmlsClient(this.transport, options.umls?.apiKey);
    this.clinicalTrials = createClinicalTrialsClient(this.transport);
    this.pubChem = createPubChemClient(this.transport);
  }
}
