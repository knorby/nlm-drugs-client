import type { RequestOptions, SourceOperationsClient } from "./operations.js";
import { entries, integer, optionalText, record, text } from "./parse.js";

export interface SplSummary {
  setid: string;
  title: string;
  splVersion: number;
  publishedDate?: string;
}

export interface SplSearch {
  drugName?: string;
  ndc?: string;
  rxcui?: string;
  unii?: string;
  page?: number;
  pageSize?: number;
}

export interface SplPage {
  items: SplSummary[];
  page: number;
  totalPages: number;
  totalItems?: number;
  nextPage?: number;
}

export function createDailyMedMethods(
  call: SourceOperationsClient["dailyMed"],
) {
  const methods = {
    /** Queries SPL labels with source-native filters, returning a parsed page. */
    async searchSpls(
      filters: SplSearch = {},
      options?: RequestOptions,
    ): Promise<SplPage> {
      const response = record(
        await call.call(
          "spls",
          {
            drug_name: filters.drugName,
            ndc: filters.ndc,
            rxcui: filters.rxcui,
            unii_code: filters.unii,
            page: filters.page,
            pagesize: filters.pageSize,
          },
          options,
        ),
        "DailyMed",
        "response",
      );
      const metadata = record(response.metadata, "DailyMed", "metadata");
      const items = entries(response.data, "DailyMed", "data").map(
        (value): SplSummary => {
          const item = record(value, "DailyMed", "data item");
          return {
            setid: text(item.setid, "DailyMed", "setid"),
            title: text(item.title, "DailyMed", "title"),
            splVersion: integer(item.spl_version, "DailyMed", "spl_version"),
            publishedDate: optionalText(
              item.published_date,
              "DailyMed",
              "published_date",
            ),
          };
        },
      );
      return {
        items,
        page: integer(metadata.current_page, "DailyMed", "current_page"),
        totalPages: integer(metadata.total_pages, "DailyMed", "total_pages"),
        totalItems:
          metadata.total_elements === undefined
            ? undefined
            : integer(metadata.total_elements, "DailyMed", "total_elements"),
        nextPage:
          metadata.next_page === undefined ||
          metadata.next_page === null ||
          metadata.next_page === "null"
            ? undefined
            : integer(metadata.next_page, "DailyMed", "next_page"),
      };
    },
    async *iterateSpls(
      filters: Omit<SplSearch, "page"> = {},
      options?: RequestOptions,
    ): AsyncGenerator<SplSummary> {
      let page = 1;
      const seen = new Set<number>();
      while (!seen.has(page)) {
        seen.add(page);
        const result = await methods.searchSpls({ ...filters, page }, options);
        yield* result.items;
        if (
          result.nextPage === undefined ||
          result.nextPage > result.totalPages ||
          result.nextPage <= page
        )
          return;
        page = result.nextPage;
      }
    },
    async ndcsForSpl(
      setid: string,
      options?: RequestOptions,
    ): Promise<string[]> {
      const response = record(
        await call.call("splNdcs", { setid }, options),
        "DailyMed",
        "response",
      );
      const data = record(response.data, "DailyMed", "data");
      return entries(data.ndcs, "DailyMed", "ndcs").map((item) =>
        text(record(item, "DailyMed", "ndc").ndc, "DailyMed", "ndc"),
      );
    },
    getSplXml(setid: string, options?: RequestOptions): Promise<string> {
      return call
        .call("splDocument", { setid }, options)
        .then((value) => text(value, "DailyMed", "SPL XML"));
    },
  };
  return methods;
}
