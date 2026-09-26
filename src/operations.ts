/** A source-facing client for NLM drug and literature services. */
export type QueryValue =
  | string
  | number
  | boolean
  | readonly string[]
  | undefined;
export type Parameters = Record<string, QueryValue>;

export interface ClientOptions {
  /** Defaults to the runtime's global fetch. */
  fetch?: typeof fetch;
  /** Optional NCBI E-utilities identification; never included in error messages. */
  pubMed?: { apiKey?: string; email?: string; tool?: string };
  /** Required only for authenticated UMLS requests. */
  umls?: { apiKey: string };
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface PubMedRequestOptions extends RequestOptions {
  /** Use form-encoded POST for large E-utilities requests. */
  method?: "GET" | "POST";
}

export class NlmHttpError extends Error {
  constructor(
    readonly status: number,
    readonly source: string,
  ) {
    super(`${source} returned HTTP ${status}`);
    this.name = "NlmHttpError";
  }
}

type Operation = {
  path: string;
  required?: readonly string[];
  format?: "xml";
  defaults?: Parameters;
};

const sharedRxNormOperations = {
  filterByProperty: {
    path: "/rxcui/{rxcui}/filter",
    required: ["rxcui", "propName"],
  },
  findRxcuiById: { path: "/rxcui", required: ["idtype", "id"] },
  findRxcuiByString: { path: "/rxcui", required: ["name"] },
  getAllConceptsByTTY: { path: "/allconcepts", required: ["tty"] },
  getAllProperties: {
    path: "/rxcui/{rxcui}/allProperties",
    required: ["rxcui", "prop"],
  },
  getAllRelatedInfo: { path: "/rxcui/{rxcui}/allrelated", required: ["rxcui"] },
  getApproximateMatch: { path: "/approximateTerm", required: ["term"] },
  getDisplayTerms: { path: "/displaynames" },
  getDrugs: { path: "/drugs", required: ["name"] },
  getGenericProduct: { path: "/rxcui/{rxcui}/generic", required: ["rxcui"] },
  getIdTypes: { path: "/idtypes" },
  getMultiIngredBrand: { path: "/brands", required: ["ingredientids"] },
  getNDCs: { path: "/rxcui/{rxcui}/ndcs", required: ["rxcui"] },
  getPropCategories: { path: "/propCategories" },
  getPropNames: { path: "/propnames" },
  getRelaPaths: { path: "/relapaths" },
  getRelaTypes: { path: "/relatypes" },
  getRelatedByRelationship: {
    path: "/rxcui/{rxcui}/related",
    required: ["rxcui", "rela"],
  },
  getRelatedByType: {
    path: "/rxcui/{rxcui}/related",
    required: ["rxcui", "tty"],
  },
  getRxConceptProperties: {
    path: "/rxcui/{rxcui}/properties",
    required: ["rxcui"],
  },
  getRxNormName: { path: "/rxcui/{rxcui}", required: ["rxcui"] },
  getRxProperty: {
    path: "/rxcui/{rxcui}/property",
    required: ["rxcui", "propName"],
  },
  getSourceTypes: { path: "/sourcetypes" },
  getSpellingSuggestions: { path: "/spellingsuggestions", required: ["name"] },
  getTermTypes: { path: "/termtypes" },
} as const satisfies Record<string, Operation>;

const rxNormOperations = {
  ...sharedRxNormOperations,
  findActiveProducts: { path: "/rxcui/{rxcui}/active", required: ["rxcui"] },
  findRelatedNDCs: { path: "/relatedndc", required: ["ndc", "relation"] },
  getAllConceptsByStatus: { path: "/allstatus" },
  getAllHistoricalNDCs: {
    path: "/rxcui/{rxcui}/allhistoricalndcs",
    required: ["rxcui"],
  },
  getAllNDCsByStatus: { path: "/allNDCstatus" },
  getNDCProperties: { path: "/ndcproperties", required: ["id"] },
  getNDCStatus: { path: "/ndcstatus", required: ["ndc"] },
  getProprietaryInformation: {
    path: "/rxcui/{rxcui}/proprietary",
    required: ["rxcui"],
  },
  getReformulationConcepts: { path: "/reformulationConcepts" },
  getRxNormVersion: { path: "/version" },
  getRxcuiHistoryStatus: {
    path: "/rxcui/{rxcui}/historystatus",
    required: ["rxcui"],
  },
} as const satisfies Record<string, Operation>;

const prescribableOperations = sharedRxNormOperations;

const rxClassOperations = {
  findClassByName: { path: "/class/byName", required: ["className"] },
  findClassesById: { path: "/class/byId", required: ["classId"] },
  findSimilarClassesByClass: {
    path: "/class/similar",
    required: ["classId", "relaSource", "rela"],
  },
  findSimilarClassesByDrugList: {
    path: "/class/similarByRxcuis",
    required: ["rxcuis"],
  },
  getAllClasses: { path: "/allClasses" },
  getClassByRxNormDrugId: { path: "/class/byRxcui", required: ["rxcui"] },
  getClassByRxNormDrugName: {
    path: "/class/byDrugName",
    required: ["drugName"],
  },
  getClassContexts: { path: "/classContext", required: ["classId"] },
  getClassGraphBySource: { path: "/classGraph", required: ["classId"] },
  getClassMembers: {
    path: "/classMembers",
    required: ["classId", "relaSource"],
  },
  getClassTree: { path: "/classTree", required: ["classId"] },
  getClassTypes: { path: "/classTypes" },
  getRelaSourceVersion: {
    path: "/version/relaSource",
    required: ["relaSource"],
  },
  getRelas: { path: "/relas" },
  getSimilarityInformation: {
    path: "/class/similarInfo",
    required: [
      "classId1",
      "relaSource1",
      "rela1",
      "classId2",
      "relaSource2",
      "rela2",
    ],
  },
  getSourcesOfDrugClassRelations: { path: "/relaSources" },
  getSpellingSuggestions: { path: "/spellingsuggestions", required: ["term"] },
} as const satisfies Record<string, Operation>;

const rxTermsOperations = {
  getAllRxTermInfo: { path: "/rxcui/{rxcui}/allinfo", required: ["rxcui"] },
  getAllRxTermsProducts: { path: "/allconcepts" },
  getRxTermDisplayName: { path: "/rxcui/{rxcui}/name", required: ["rxcui"] },
  getRxTermsVersion: { path: "/version" },
} as const satisfies Record<string, Operation>;

const dailyMedOperations = {
  applicationnumbers: { path: "/applicationnumbers" },
  drugclasses: { path: "/drugclasses" },
  drugnames: { path: "/drugnames" },
  ndcs: { path: "/ndcs" },
  rxcuis: { path: "/rxcuis" },
  spls: { path: "/spls" },
  splDocument: { path: "/spls/{setid}", required: ["setid"], format: "xml" },
  splHistory: { path: "/spls/{setid}/history", required: ["setid"] },
  splMedia: { path: "/spls/{setid}/media", required: ["setid"] },
  splNdcs: { path: "/spls/{setid}/ndcs", required: ["setid"] },
  splPackaging: { path: "/spls/{setid}/packaging", required: ["setid"] },
  uniis: { path: "/uniis" },
} as const satisfies Record<string, Operation>;

const meshOperations = {
  descriptor: { path: "/lookup/descriptor", required: ["label"] },
  details: { path: "/lookup/details", required: ["descriptor"] },
  label: { path: "/lookup/label", required: ["resource"] },
  pair: { path: "/lookup/pair", required: ["label", "descriptor"] },
  qualifiers: { path: "/lookup/qualifiers", required: ["descriptor"] },
  term: { path: "/lookup/term", required: ["label"] },
  years: { path: "/lookup/years" },
  sparql: {
    path: "/sparql",
    required: ["query"],
    defaults: { format: "JSON" },
  },
} as const satisfies Record<string, Operation>;

const pubMedOperations = {
  einfo: { path: "/einfo.fcgi", defaults: { retmode: "json" } },
  esearch: {
    path: "/esearch.fcgi",
    required: ["term"],
    defaults: { retmode: "json" },
  },
  esummary: { path: "/esummary.fcgi", defaults: { retmode: "json" } },
  efetch: { path: "/efetch.fcgi", defaults: { retmode: "xml" } },
  epost: { path: "/epost.fcgi", defaults: { retmode: "xml" } },
  elink: {
    path: "/elink.fcgi",
    defaults: { retmode: "xml", dbfrom: "pubmed" },
  },
  espell: {
    path: "/espell.fcgi",
    required: ["term"],
    defaults: { retmode: "xml" },
  },
  ecitmatch: {
    path: "/ecitmatch.cgi",
    required: ["bdata"],
    defaults: { retmode: "xml" },
  },
  egquery: {
    path: "/egquery.fcgi",
    required: ["term"],
    defaults: { retmode: "xml" },
  },
} as const satisfies Record<string, Operation>;

type RequiredKeys<T> = T extends {
  required: readonly (infer K extends string)[];
}
  ? K
  : never;
type OperationArgs<T> = {
  [K in RequiredKeys<T>]: string | number;
} & Parameters;

type OperationCaller<
  Ops extends Record<string, Operation>,
  Options extends RequestOptions = RequestOptions,
> = {
  call<K extends keyof Ops & string>(
    name: K,
    args: OperationArgs<Ops[K]>,
    options?: Options,
  ): Promise<unknown>;
};

export class Transport {
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async request(
    source: string,
    url: URL,
    options: RequestOptions = {},
    init: RequestInit = {},
    responseType: "auto" | "bytes" = "auto",
  ): Promise<unknown> {
    const response = await this.fetchImpl(url.toString(), {
      ...init,
      signal: options.signal,
    });
    if (!response.ok) throw new NlmHttpError(response.status, source);
    if (response.status === 204) return undefined;
    if (responseType === "bytes") return response.arrayBuffer();
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("json"))
      return response.json() as Promise<unknown>;
    return response.text();
  }
}

function queryString(url: URL, args: Parameters, separator = " "): void {
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    url.searchParams.set(
      key,
      Array.isArray(value) ? value.join(separator) : String(value),
    );
  }
}

function operationCaller<
  Ops extends Record<string, Operation>,
  Options extends RequestOptions = RequestOptions,
>(
  transport: Transport,
  source: string,
  origin: string,
  prefix: string,
  operations: Ops,
  suffix = ".json",
  defaults: Parameters = {},
): OperationCaller<Ops, Options> {
  return {
    call(name, args, options) {
      const operation = operations[name];
      if (!operation) throw new TypeError(`Unsupported ${source} operation`);
      const query: Parameters = { ...defaults, ...operation.defaults, ...args };
      const path = operation.path.replace(/\{([^}]+)\}/g, (_, key: string) => {
        const value = query[key];
        if (value === undefined || Array.isArray(value))
          throw new TypeError(`Missing path parameter ${key}`);
        delete query[key];
        return encodeURIComponent(String(value));
      });
      for (const key of operation.required ?? []) {
        if (args[key] === undefined || args[key] === "")
          throw new TypeError(`Missing parameter ${key}`);
      }
      const url = new URL(
        `${prefix}${path}${operation.format ? `.${operation.format}` : suffix}`,
        origin,
      );
      queryString(url, query, source === "PubMed" ? "," : " ");
      if (
        source === "PubMed" &&
        options &&
        "method" in options &&
        options.method === "POST"
      ) {
        const body = url.searchParams.toString();
        url.search = "";
        return transport.request(source, url, options, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
      }
      return transport.request(source, url, options);
    },
  };
}

export type DrugCode =
  | { kind: "ndc"; code: string; name?: string; language?: "en" | "es" }
  | { kind: "rxcui"; code: string; name?: string; language?: "en" | "es" };

/** MedlinePlus Connect's code systems; medication name fallback is English only. */
export type ConnectInput =
  | DrugCode
  | { kind: "drugName"; name: string; language?: "en" }
  | {
      kind: "diagnosis";
      system: "icd10cm" | "icd9cm" | "snomedct";
      code: string;
      name?: string;
      language?: "en" | "es";
    }
  | { kind: "lab"; code: string; name?: string; language?: "en" | "es" }
  | {
      kind: "procedure";
      system: "cpt" | "snomedct";
      code: string;
      name?: string;
      language?: "en" | "es";
    };

export type DailyMedDownload =
  | { setid: string; format: "zip"; version?: number }
  | { setid: string; format: "pdf"; version?: never };

const codeSystems = {
  ndc: "2.16.840.1.113883.6.69",
  rxcui: "2.16.840.1.113883.6.88",
  icd10cm: "2.16.840.1.113883.6.90",
  icd9cm: "2.16.840.1.113883.6.103",
  snomedct: "2.16.840.1.113883.6.96",
  loinc: "2.16.840.1.113883.6.1",
  cpt: "2.16.840.1.113883.6.12",
} as const;

export class SourceOperationsClient {
  protected readonly transport: Transport;
  readonly rxNorm: OperationCaller<typeof rxNormOperations>;
  readonly prescribable: OperationCaller<typeof prescribableOperations>;
  readonly rxClass: OperationCaller<typeof rxClassOperations>;
  readonly rxTerms: OperationCaller<typeof rxTermsOperations>;
  readonly dailyMed: OperationCaller<typeof dailyMedOperations> & {
    download: (
      input: DailyMedDownload,
      options?: RequestOptions,
    ) => Promise<ArrayBuffer>;
  };
  readonly mesh: OperationCaller<typeof meshOperations> & {
    resource: (id: string, options?: RequestOptions) => Promise<unknown>;
  };
  readonly pubMed: OperationCaller<
    typeof pubMedOperations,
    PubMedRequestOptions
  >;
  readonly identifiers: {
    rxCuisForNdc: (ndc: string, options?: RequestOptions) => Promise<unknown>;
    ndcsForRxCui: (rxcui: string, options?: RequestOptions) => Promise<unknown>;
    splsForNdc: (ndc: string, options?: RequestOptions) => Promise<unknown>;
    splsForRxCui: (rxcui: string, options?: RequestOptions) => Promise<unknown>;
    ndcsForSpl: (setid: string, options?: RequestOptions) => Promise<unknown>;
    rxCuisForSpl: (setid: string, options?: RequestOptions) => Promise<unknown>;
    rxCuisForUnii: (unii: string, options?: RequestOptions) => Promise<unknown>;
    splsForUnii: (unii: string, options?: RequestOptions) => Promise<unknown>;
    rxCuisForName: (name: string, options?: RequestOptions) => Promise<unknown>;
    splsForName: (name: string, options?: RequestOptions) => Promise<unknown>;
    meshDescriptorsForName: (
      name: string,
      options?: RequestOptions,
    ) => Promise<unknown>;
  };
  readonly medlinePlusConnect: {
    drug: (input: DrugCode, options?: RequestOptions) => Promise<unknown>;
    connect: (
      input: ConnectInput,
      options?: RequestOptions & { method?: "GET" | "POST" },
    ) => Promise<unknown>;
  };

  constructor(options: ClientOptions = {}) {
    const transport = new Transport(options);
    this.transport = transport;
    const rxNav = "https://rxnav.nlm.nih.gov";
    this.rxNorm = operationCaller(
      transport,
      "RxNorm",
      rxNav,
      "/REST",
      rxNormOperations,
    );
    this.prescribable = operationCaller(
      transport,
      "Prescribable RxNorm",
      rxNav,
      "/REST/Prescribe",
      prescribableOperations,
    );
    this.rxClass = operationCaller(
      transport,
      "RxClass",
      rxNav,
      "/REST/rxclass",
      rxClassOperations,
    );
    this.rxTerms = operationCaller(
      transport,
      "RxTerms",
      rxNav,
      "/REST/RxTerms",
      rxTermsOperations,
    );
    this.dailyMed = {
      ...operationCaller(
        transport,
        "DailyMed",
        "https://dailymed.nlm.nih.gov",
        "/dailymed/services/v2",
        dailyMedOperations,
      ),
      async download(input, requestOptions) {
        const path =
          input.version === undefined
            ? input.format === "zip"
              ? "/dailymed/downloadzipfile.cfm"
              : "/dailymed/downloadpdffile.cfm"
            : "/dailymed/getFile.cfm";
        const url = new URL(path, "https://dailymed.nlm.nih.gov");
        if (input.version === undefined)
          queryString(url, { setId: input.setid });
        else
          queryString(url, {
            type: "zip",
            setid: input.setid,
            version: input.version,
          });
        const value = await transport.request(
          "DailyMed",
          url,
          requestOptions,
          {},
          "bytes",
        );
        if (!(value instanceof ArrayBuffer))
          throw new TypeError("Expected binary DailyMed response");
        return value;
      },
    };
    this.mesh = {
      ...operationCaller(
        transport,
        "MeSH",
        "https://id.nlm.nih.gov",
        "/mesh",
        meshOperations,
        "",
      ),
      resource(id: string, requestOptions?: RequestOptions) {
        const url = new URL(
          `/mesh/${encodeURIComponent(id)}.json`,
          "https://id.nlm.nih.gov",
        );
        return transport.request("MeSH", url, requestOptions);
      },
    };
    this.pubMed = operationCaller<
      typeof pubMedOperations,
      PubMedRequestOptions
    >(
      transport,
      "PubMed",
      "https://eutils.ncbi.nlm.nih.gov",
      "/entrez/eutils",
      pubMedOperations,
      "",
      {
        db: "pubmed",
        api_key: options.pubMed?.apiKey,
        email: options.pubMed?.email,
        tool: options.pubMed?.tool,
      },
    );
    const connect = (
      input: ConnectInput,
      requestOptions: RequestOptions & { method?: "GET" | "POST" } = {},
    ) => {
      const system =
        input.kind === "drugName"
          ? codeSystems.ndc
          : input.kind === "lab"
            ? codeSystems.loinc
            : input.kind === "diagnosis" || input.kind === "procedure"
              ? codeSystems[input.system]
              : codeSystems[input.kind];
      const query = new URLSearchParams();
      query.set("mainSearchCriteria.v.cs", system);
      if (input.kind !== "drugName")
        query.set("mainSearchCriteria.v.c", input.code);
      if ("name" in input && input.name !== undefined)
        query.set("mainSearchCriteria.v.dn", input.name);
      query.set("informationRecipient.languageCode.c", input.language ?? "en");
      query.set("knowledgeResponseType", "application/json");
      const post = requestOptions.method === "POST";
      const url = new URL(
        post ? "/application" : "/service",
        "https://connect.medlineplus.gov",
      );
      if (!post) url.search = query.toString();
      return transport.request(
        "MedlinePlus Connect",
        url,
        requestOptions,
        post
          ? {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: query.toString(),
            }
          : {},
      );
    };
    this.medlinePlusConnect = {
      connect,
      drug: (input, requestOptions) => connect(input, requestOptions),
    };
    this.identifiers = {
      rxCuisForNdc: (ndc, requestOptions) =>
        this.rxNorm.call(
          "findRxcuiById",
          { idtype: "NDC", id: ndc },
          requestOptions,
        ),
      ndcsForRxCui: (rxcui, requestOptions) =>
        this.rxNorm.call("getNDCs", { rxcui }, requestOptions),
      splsForNdc: (ndc, requestOptions) =>
        this.dailyMed.call("spls", { ndc }, requestOptions),
      splsForRxCui: (rxcui, requestOptions) =>
        this.dailyMed.call("spls", { rxcui }, requestOptions),
      ndcsForSpl: (setid, requestOptions) =>
        this.dailyMed.call("splNdcs", { setid }, requestOptions),
      rxCuisForSpl: (setid, requestOptions) =>
        this.rxNorm.call(
          "findRxcuiById",
          { idtype: "SPL_SET_ID", id: setid },
          requestOptions,
        ),
      rxCuisForUnii: (unii, requestOptions) =>
        this.rxNorm.call(
          "findRxcuiById",
          { idtype: "UNII_CODE", id: unii },
          requestOptions,
        ),
      splsForUnii: (unii, requestOptions) =>
        this.dailyMed.call("spls", { unii_code: unii }, requestOptions),
      rxCuisForName: (name, requestOptions) =>
        this.rxNorm.call("findRxcuiByString", { name }, requestOptions),
      splsForName: (name, requestOptions) =>
        this.dailyMed.call("spls", { drug_name: name }, requestOptions),
      meshDescriptorsForName: (name, requestOptions) =>
        this.mesh.call("descriptor", { label: name }, requestOptions),
    };
  }
}
