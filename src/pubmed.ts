import type {
  PubMedRequestOptions,
  SourceOperationsClient,
} from "./operations.js";
import { integer, list, record, stringList, text } from "./parse.js";

export interface PubMedSearchPage {
  ids: string[];
  total: number;
  start: number;
}
export interface PubMedSummary {
  uid: string;
  title: string;
  pubdate?: string;
}

export function createPubMedMethods(call: SourceOperationsClient["pubMed"]) {
  const methods = {
    async search(
      term: string,
      options: PubMedRequestOptions & {
        pageSize?: number;
        start?: number;
        sort?: string;
      } = {},
    ): Promise<PubMedSearchPage> {
      const response = record(
        await call.call(
          "esearch",
          {
            term,
            retmax: options.pageSize,
            retstart: options.start,
            sort: options.sort,
          },
          options,
        ),
        "PubMed",
        "response",
      );
      const result = record(response.esearchresult, "PubMed", "esearchresult");
      return {
        ids: stringList(result.idlist, "PubMed", "idlist"),
        total: integer(result.count, "PubMed", "count"),
        start: integer(result.retstart, "PubMed", "retstart"),
      };
    },
    async *iterateIds(
      term: string,
      options: PubMedRequestOptions & { pageSize?: number } = {},
    ): AsyncGenerator<string> {
      const pageSize = options.pageSize ?? 100;
      if (!Number.isSafeInteger(pageSize) || pageSize <= 0)
        throw new RangeError("pageSize must be a positive integer");
      let start = 0;
      while (true) {
        const page = await methods.search(term, {
          ...options,
          pageSize,
          start,
        });
        yield* page.ids;
        start += page.ids.length;
        if (start >= page.total || page.ids.length === 0) return;
      }
    },
    async summarize(
      ids: readonly string[],
      options?: PubMedRequestOptions,
    ): Promise<PubMedSummary[]> {
      if (!ids.length) return [];
      const response = record(
        await call.call("esummary", { id: ids }, options),
        "PubMed",
        "response",
      );
      const result = record(response.result, "PubMed", "result");
      return list(result.uids, "PubMed", "uids").map((id) => {
        const uid = text(id, "PubMed", "uid");
        const item = record(result[uid], "PubMed", `result.${uid}`);
        return {
          uid: text(item.uid, "PubMed", "item.uid"),
          title: text(item.title, "PubMed", "title"),
          pubdate:
            item.pubdate === undefined
              ? undefined
              : text(item.pubdate, "PubMed", "pubdate"),
        };
      });
    },
    async fetchXml(
      ids: readonly string[],
      options?: PubMedRequestOptions,
    ): Promise<string> {
      if (!ids.length) return "";
      return text(
        await call.call("efetch", { id: ids, retmode: "xml" }, options),
        "PubMed",
        "EFetch XML",
      );
    },
  };
  return methods;
}
