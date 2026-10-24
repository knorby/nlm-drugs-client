import { describe, expect, it } from "vitest";
import { NlmDrugsClient, NlmResponseError } from "../src/index";
import {
  finiteNumber,
  integer,
  list,
  optionalRecord,
  optionalText,
  record,
  responseUrl,
  stringList,
  text,
} from "../src/parse";

type RecordedRequest = { url: URL; init?: RequestInit };

function clientWith(handler: () => Promise<Response>) {
  const requests: RecordedRequest[] = [];
  const client = new NlmDrugsClient({
    fetch: async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return handler();
    },
  });
  return { client, requests };
}

function queue(responses: Array<unknown | string | Response>) {
  return clientWith(async () => {
    const next = responses.shift();
    if (next instanceof Response) return next;
    return typeof next === "string"
      ? new Response(next, { headers: { "content-type": "application/xml" } })
      : Response.json(next ?? {});
  });
}

describe("response validation helpers", () => {
  it("rejects non-object records but preserves object identity", () => {
    const value = { field: "value" };
    expect(record(value, "Source", "field")).toBe(value);
    for (const invalid of [null, undefined, "text", 1, true, []]) {
      expect(() => record(invalid, "Source", "field")).toThrow(
        NlmResponseError,
      );
    }
  });

  it("treats null and undefined as absent optional records", () => {
    expect(optionalRecord(undefined, "Source", "field")).toBeUndefined();
    expect(optionalRecord(null, "Source", "field")).toBeUndefined();
    expect(optionalRecord({ a: 1 }, "Source", "field")).toEqual({ a: 1 });
    expect(() => optionalRecord(1, "Source", "field")).toThrow(
      NlmResponseError,
    );
  });

  it("requires text and treats null and undefined as absent optional text", () => {
    expect(text("value", "Source", "field")).toBe("value");
    expect(() => text(1, "Source", "field")).toThrow(NlmResponseError);
    expect(optionalText(undefined, "Source", "field")).toBeUndefined();
    expect(optionalText(null, "Source", "field")).toBeUndefined();
    expect(optionalText("value", "Source", "field")).toBe("value");
    expect(() => optionalText(1, "Source", "field")).toThrow(NlmResponseError);
  });

  it("parses non-negative safe integers from numbers and numeric strings", () => {
    expect(integer(0, "Source", "field")).toBe(0);
    expect(integer("42", "Source", "field")).toBe(42);
    for (const invalid of [-1, "", "1.5", "text", 1e30]) {
      expect(() => integer(invalid, "Source", "field")).toThrow(
        NlmResponseError,
      );
    }
  });

  it("parses finite numbers from numbers and numeric strings", () => {
    expect(finiteNumber(1.5, "Source", "field")).toBe(1.5);
    expect(finiteNumber("2.5", "Source", "field")).toBe(2.5);
    for (const invalid of ["", "text", Number.POSITIVE_INFINITY]) {
      expect(() => finiteNumber(invalid, "Source", "field")).toThrow(
        NlmResponseError,
      );
    }
  });

  it("requires arrays and string entries where the schema demands them", () => {
    expect(list([1, 2], "Source", "field")).toEqual([1, 2]);
    expect(() => list("value", "Source", "field")).toThrow(NlmResponseError);
    expect(stringList(["a", "b"], "Source", "field")).toEqual(["a", "b"]);
    expect(() => stringList([1], "Source", "field")).toThrow(NlmResponseError);
  });

  it("builds URLs without serializing absent parameters", () => {
    const url = responseUrl("https://example.test", "/path", {
      present: "value",
      count: 2,
      absent: undefined,
    });
    expect(url.pathname).toBe("/path");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      present: "value",
      count: "2",
    });
    expect(responseUrl("https://example.test", "/plain").search).toBe("");
  });
});

describe("transport behavior", () => {
  it("returns undefined for empty responses and text for untyped bodies", async () => {
    const empty = clientWith(
      async () => new Response(null, { status: 204 }),
    ).client;
    expect(await empty.pubMed.call("einfo", {})).toBeUndefined();

    const untyped = clientWith(
      async () => new Response(new Blob([new Uint8Array([0x6f, 0x6b])])),
    ).client;
    expect(await untyped.mesh.call("sparql", { query: "ASK {}" })).toBe("ok");
  });

  it("falls back to the runtime fetch when none is supplied", () => {
    expect(new NlmDrugsClient()).toBeInstanceOf(NlmDrugsClient);
  });

  it("rejects unknown operations and invalid path parameters", () => {
    const { client } = clientWith(async () => Response.json({}));
    const call = client.rxNorm.call as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
    expect(() => call("missingOperation", {})).toThrow(
      "Unsupported RxNorm operation",
    );
    expect(() => call("getNDCs", {})).toThrow("Missing path parameter rxcui");
    expect(() => call("getNDCs", { rxcui: ["1"] })).toThrow(
      "Missing path parameter rxcui",
    );
    expect(() => client.rxNorm.call("getNDCs", { rxcui: "" })).toThrow(
      "Missing parameter rxcui",
    );
  });

  it("downloads the latest ZIP and rejects non-binary DailyMed responses", async () => {
    const { client, requests } = clientWith(
      async () => new Response(new Blob([new Uint8Array([1, 2])])),
    );
    const archive = await client.dailyMed.download({
      setid: "label-id",
      format: "zip",
    });
    expect(new Uint8Array(archive)).toEqual(new Uint8Array([1, 2]));
    expect(requests[0]?.url.pathname).toBe("/dailymed/downloadzipfile.cfm");
    expect(requests[0]?.url.searchParams.get("setId")).toBe("label-id");

    const transport = (
      client as unknown as {
        transport: { request: () => Promise<unknown> };
      }
    ).transport;
    transport.request = async () => "not binary";
    await expect(
      client.dailyMed.download({ setid: "label-id", format: "pdf" }),
    ).rejects.toThrow("Expected binary DailyMed response");
  });

  it("maps lab and procedure codes to their MedlinePlus Connect systems", async () => {
    const { client, requests } = clientWith(async () =>
      Response.json({ feed: {} }),
    );
    await client.medlinePlusConnect.connect({ kind: "lab", code: "1234-5" });
    await client.medlinePlusConnect.connect({
      kind: "procedure",
      system: "cpt",
      code: "12345",
    });
    expect(
      requests.map(({ url }) =>
        url.searchParams.get("mainSearchCriteria.v.cs"),
      ),
    ).toEqual(["2.16.840.1.113883.6.1", "2.16.840.1.113883.6.12"]);
  });

  it("looks up SPLs directly by NDC", async () => {
    const { client, requests } = clientWith(async () =>
      Response.json({ data: [] }),
    );
    await client.identifiers.splsForNdc("00071-0157-23");
    expect(requests[0]?.url.searchParams.get("ndc")).toBe("00071-0157-23");
  });
});

describe("service response edges", () => {
  it("reports ClinicalTrials.gov totals and version metadata", async () => {
    const { client, requests } = queue([
      { studies: [], totalCount: 7, nextPageToken: "next" },
      { version: "2.0" },
    ]);
    expect(
      await client.clinicalTrials.searchStudies({
        condition: "asthma",
        countTotal: true,
      }),
    ).toEqual({
      studies: [],
      totalCount: 7,
      nextPageToken: "next",
    });
    expect(await client.clinicalTrials.version()).toEqual({ version: "2.0" });
    expect(requests[0]?.url.searchParams.get("countTotal")).toBe("true");
    expect(requests[1]?.url.pathname).toBe("/api/v2/version");
  });

  it("accepts MedlinePlus searches without a result list", async () => {
    const { client } = queue([
      "<nlmSearchResult><count>0</count></nlmSearchResult>",
    ]);
    expect(await client.medlinePlus.searchTopics("nothing")).toMatchObject({
      results: [],
      total: 0,
      file: undefined,
      server: undefined,
    });
  });

  it("accepts genetics results without optional rank and score", async () => {
    const { client } = queue([
      '<search_results count="1"><result><url>https://example.test/topic</url></result></search_results>',
    ]);
    expect(await client.medlinePlusGenetics.search("topic")).toMatchObject({
      total: 1,
      results: [
        {
          url: "https://example.test/topic",
          order: undefined,
          score: undefined,
        },
      ],
    });
  });

  it("rejects incomplete MedlinePlus pagination options", async () => {
    const { client } = clientWith(async () => Response.json({}));
    await expect(
      client.medlinePlus.searchTopics("aspirin", { file: "f1" }),
    ).rejects.toThrow("file and server must be supplied together");
    await expect(
      client.medlinePlus.searchTopics("aspirin", { server: "s1" }),
    ).rejects.toThrow("file and server must be supplied together");
    await expect(
      client.medlinePlus.searchTopics("aspirin", { start: 10 }),
    ).rejects.toThrow("Pagination requires the file and server");
  });

  it("validates MedlinePlus iteration page sizes and cursors", async () => {
    const invalid = queue([]);
    await expect(
      invalid.client.medlinePlus
        .iterateTopics("aspirin", { pageSize: 0 })
        .next(),
    ).rejects.toThrow("pageSize must be a positive integer");

    const defaults = queue([
      "<nlmSearchResult><count>0</count></nlmSearchResult>",
    ]);
    const empty = [];
    for await (const item of defaults.client.medlinePlus.iterateTopics(
      "aspirin",
    ))
      empty.push(item);
    expect(empty).toEqual([]);
    expect(defaults.requests[0]?.url.searchParams.get("retmax")).toBe("10");

    const missingCursor = queue([
      '<nlmSearchResult><count>2</count><list><document url="https://example.test/aspirin"><content name="title">Aspirin</content></document></list></nlmSearchResult>',
    ]);
    const iterator = missingCursor.client.medlinePlus.iterateTopics("aspirin", {
      pageSize: 1,
    });
    expect((await iterator.next()).value).toEqual({
      title: "Aspirin",
      url: "https://example.test/aspirin",
    });
    await expect(iterator.next()).rejects.toThrow(
      "MedlinePlus Topics omitted pagination cursor",
    );
  });

  it("retrieves MeSH resources and runs SPARQL queries", async () => {
    const { client, requests } = queue([
      { resource: "descriptor" },
      { head: {} },
    ]);
    expect(await client.mesh.getResource("D001241")).toEqual({
      resource: "descriptor",
    });
    expect(await client.mesh.sparql("SELECT * WHERE {}")).toEqual({ head: {} });
    expect(requests.map(({ url }) => url.pathname)).toEqual([
      "/mesh/D001241.json",
      "/mesh/sparql",
    ]);
  });

  it("rejects invalid PubChem identifiers and property requests", async () => {
    const { client } = queue([
      { IdentifierList: { CID: ["2244"] } },
      { IdentifierList: { CID: [0] } },
      { PropertyTable: { Properties: [{ CID: 999, XLogP: 1 }] } },
      {
        PropertyTable: {
          Properties: [
            {
              CID: 2244,
              MolecularFormula: "C9H8O4",
              Nested: { value: 1 },
              Missing: null,
            },
          ],
        },
      },
    ]);
    await expect(client.pubChem.findCompoundIds("aspirin")).rejects.toThrow(
      "PubChem returned an invalid CID",
    );
    await expect(client.pubChem.findCompoundIds("aspirin")).rejects.toThrow(
      "PubChem returned an invalid CID",
    );
    await expect(client.pubChem.getProperties(-1, ["XLogP"])).rejects.toThrow(
      "CID must be a positive integer",
    );
    await expect(client.pubChem.getProperties(1, [])).rejects.toThrow(
      "At least one property is required",
    );
    await expect(
      client.pubChem.getProperties(2244, ["MolecularFormula"]),
    ).rejects.toThrow("PubChem returned an unexpected CID");
    expect(
      await client.pubChem.getProperties(2244, ["MolecularFormula"]),
    ).toEqual({ CID: 2244, MolecularFormula: "C9H8O4" });
    await expect(client.pubChem.getRecord(0)).rejects.toThrow(
      "CID must be a positive integer",
    );
  });

  it("handles empty PubMed requests and summaries without dates", async () => {
    expect(await queue([]).client.pubMed.summarize([])).toEqual([]);
    expect(await queue([]).client.pubMed.fetchXml([])).toBe("");

    const noDate = queue([
      { result: { uids: ["1"], "1": { uid: "1", title: "Title" } } },
    ]);
    const summaries = await noDate.client.pubMed.summarize(["1"]);
    expect(summaries).toMatchObject([{ uid: "1", title: "Title" }]);
    expect(summaries[0]?.pubdate).toBeUndefined();
  });

  it("uses PubMed's default page size and rejects invalid page sizes", async () => {
    const { client, requests } = queue([
      { esearchresult: { count: "0", retstart: "0", idlist: [] } },
    ]);
    const ids = [];
    for await (const id of client.pubMed.iterateIds("aspirin")) ids.push(id);
    expect(ids).toEqual([]);
    expect(requests[0]?.url.searchParams.get("retmax")).toBe("100");
    await expect(
      client.pubMed.iterateIds("aspirin", { pageSize: -1 }).next(),
    ).rejects.toThrow("pageSize must be a positive integer");
  });

  it("returns empty RxNorm and RxTerms results when the service omits data", async () => {
    const { client, requests } = queue([
      { idGroup: {} },
      { properties: undefined },
      { ndcGroup: {} },
      { approximateGroup: {} },
      { rxtermsProperties: undefined },
    ]);
    expect(await client.rxNorm.findByNdc("00071-0157-23")).toEqual([]);
    expect(await client.rxNorm.getConcept("1191")).toBeUndefined();
    expect(await client.rxNorm.getNdcs("1191")).toEqual([]);
    expect(await client.rxNorm.approximateMatches("aspirn")).toEqual([]);
    expect(await client.rxTerms.getTerm("1191")).toBeUndefined();
    expect(requests[3]?.url.searchParams.get("option")).toBe("0");
  });
});
