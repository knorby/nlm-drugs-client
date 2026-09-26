import type { RequestOptions, Transport } from "./operations.js";
import { entries, optionalText, record, responseUrl, text } from "./parse.js";

export interface ClinicalStudy {
  nctId: string;
  briefTitle: string;
  study: Record<string, unknown>;
}
export interface ClinicalSearch {
  condition?: string;
  intervention?: string;
  term?: string;
  pageSize?: number;
  pageToken?: string;
  countTotal?: boolean;
}
export interface ClinicalStudiesPage {
  studies: ClinicalStudy[];
  nextPageToken?: string;
  totalCount?: number;
}

function study(value: unknown): ClinicalStudy {
  const data = record(value, "ClinicalTrials.gov", "study");
  const section = record(
    data.protocolSection,
    "ClinicalTrials.gov",
    "protocolSection",
  );
  const identity = record(
    section.identificationModule,
    "ClinicalTrials.gov",
    "identificationModule",
  );
  return {
    nctId: text(identity.nctId, "ClinicalTrials.gov", "nctId"),
    briefTitle: text(identity.briefTitle, "ClinicalTrials.gov", "briefTitle"),
    study: data,
  };
}

export function createClinicalTrialsClient(transport: Transport) {
  const methods = {
    async searchStudies(
      input: ClinicalSearch = {},
      options?: RequestOptions,
    ): Promise<ClinicalStudiesPage> {
      const url = responseUrl("https://clinicaltrials.gov", "/api/v2/studies", {
        "query.cond": input.condition,
        "query.intr": input.intervention,
        "query.term": input.term,
        pageSize: input.pageSize,
        pageToken: input.pageToken,
        countTotal:
          input.countTotal === undefined ? undefined : String(input.countTotal),
        format: "json",
      });
      const response = record(
        await transport.request("ClinicalTrials.gov", url, options),
        "ClinicalTrials.gov",
        "response",
      );
      const count = response.totalCount;
      return {
        studies: entries(response.studies, "ClinicalTrials.gov", "studies").map(
          study,
        ),
        nextPageToken: optionalText(
          response.nextPageToken,
          "ClinicalTrials.gov",
          "nextPageToken",
        ),
        totalCount: typeof count === "number" ? count : undefined,
      };
    },
    async *iterateStudies(
      input: Omit<ClinicalSearch, "pageToken"> = {},
      options?: RequestOptions,
    ): AsyncGenerator<ClinicalStudy> {
      let pageToken: string | undefined;
      const seen = new Set<string>();
      do {
        const page = await methods.searchStudies(
          { ...input, pageToken },
          options,
        );
        yield* page.studies;
        pageToken = page.nextPageToken;
        if (!pageToken || seen.has(pageToken)) return;
        seen.add(pageToken);
      } while (pageToken);
    },
    async getStudy(
      nctId: string,
      options?: RequestOptions,
    ): Promise<ClinicalStudy> {
      const url = responseUrl(
        "https://clinicaltrials.gov",
        `/api/v2/studies/${encodeURIComponent(nctId)}`,
        { format: "json" },
      );
      return study(await transport.request("ClinicalTrials.gov", url, options));
    },
    async version(options?: RequestOptions): Promise<Record<string, unknown>> {
      return record(
        await transport.request(
          "ClinicalTrials.gov",
          responseUrl("https://clinicaltrials.gov", "/api/v2/version"),
          options,
        ),
        "ClinicalTrials.gov",
        "version",
      );
    },
  };
  return methods;
}
