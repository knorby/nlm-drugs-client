import { describe, expect, it } from "vitest";
import { NlmDrugsClient, NlmHttpError } from "../src/index";

function fixture(body: unknown = {}, status = 200) {
  const requests: Array<{ url: URL; init: RequestInit | undefined }> = [];
  const client = new NlmDrugsClient({
    fetch: async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    },
  });
  return { client, requests };
}

describe("source-facing operations", () => {
  it("routes RxNorm and Prescribable operations to different datasets", async () => {
    const { client, requests } = fixture({ idGroup: { rxnormId: ["123"] } });
    await client.rxNorm.call("findRxcuiById", {
      idtype: "NDC",
      id: "0009-7529",
    });
    await client.prescribable.call("findRxcuiById", {
      idtype: "NDC",
      id: "0009-7529",
    });
    expect(requests.map(({ url }) => `${url.pathname}${url.search}`)).toEqual([
      "/REST/rxcui.json?idtype=NDC&id=0009-7529",
      "/REST/Prescribe/rxcui.json?idtype=NDC&id=0009-7529",
    ]);
  });

  it("maps identifier paths and arrays without changing upstream keys", async () => {
    const { client, requests } = fixture();
    await client.rxNorm.call("getNDCs", { rxcui: "198440" });
    await client.rxClass.call("getClassByRxNormDrugId", {
      rxcui: "198440",
      relas: ["has_EPC", "has_MoA"],
    });
    expect(requests[0]?.url.pathname).toBe("/REST/rxcui/198440/ndcs.json");
    expect(requests[0]?.url.search).toBe("");
    expect(requests[1]?.url.pathname).toBe("/REST/rxclass/class/byRxcui.json");
    expect(requests[1]?.url.searchParams.get("relas")).toBe("has_EPC has_MoA");
  });

  it("supports NDC to SPL and SPL back to NDC with native fields", async () => {
    const { client, requests } = fixture({ data: [] });
    await client.dailyMed.call("spls", { ndc: "00071-0157-23", page: 2 });
    await client.dailyMed.call("splNdcs", {
      setid: "fdbfe194-b845-42c5-bb87-a48118bc72e7",
    });
    expect(requests.map(({ url }) => `${url.pathname}${url.search}`)).toEqual([
      "/dailymed/services/v2/spls.json?ndc=00071-0157-23&page=2",
      "/dailymed/services/v2/spls/fdbfe194-b845-42c5-bb87-a48118bc72e7/ndcs.json",
    ]);
  });

  it("uses MeSH lookup and preserves resource identifiers", async () => {
    const { client, requests } = fixture([
      { resource: "http://id.nlm.nih.gov/mesh/D001241", label: "Aspirin" },
    ]);
    const result = await client.mesh.call("descriptor", {
      label: "Aspirin",
      match: "exact",
    });
    expect(result).toEqual([
      { resource: "http://id.nlm.nih.gov/mesh/D001241", label: "Aspirin" },
    ]);
    expect(requests[0]?.url.pathname).toBe("/mesh/lookup/descriptor");
    expect(requests[0]?.url.searchParams.get("label")).toBe("Aspirin");
  });

  it("serializes MedlinePlus drug code system, language and JSON format", async () => {
    const { client, requests } = fixture({ feed: { entry: [] } });
    await client.medlinePlusConnect.drug({
      kind: "ndc",
      code: "00310-0751-39",
      language: "es",
    });
    const url = requests[0]?.url;
    expect(url?.pathname).toBe("/service");
    expect(url?.searchParams.get("mainSearchCriteria.v.cs")).toBe(
      "2.16.840.1.113883.6.69",
    );
    expect(url?.searchParams.get("mainSearchCriteria.v.c")).toBe(
      "00310-0751-39",
    );
    expect(url?.searchParams.get("informationRecipient.languageCode.c")).toBe(
      "es",
    );
    expect(url?.searchParams.get("knowledgeResponseType")).toBe(
      "application/json",
    );
  });

  it("sends PubMed search with NCBI identification and no unrequested key", async () => {
    const { requests, client } = fixture({ esearchresult: { idlist: ["1"] } });
    await client.pubMed.call("esearch", {
      term: "aspirin[MeSH Terms]",
      retmax: 5,
    });
    expect(requests[0]?.url.pathname).toBe("/entrez/eutils/esearch.fcgi");
    expect(requests[0]?.url.searchParams.get("db")).toBe("pubmed");
    expect(requests[0]?.url.searchParams.get("term")).toBe(
      "aspirin[MeSH Terms]",
    );
    expect(requests[0]?.url.searchParams.get("retmode")).toBe("json");
    expect(requests[0]?.url.searchParams.has("api_key")).toBe(false);
  });

  it("preserves HTTP status without leaking request query credentials", async () => {
    const { client } = fixture({ error: "unavailable" }, 503);
    await expect(client.pubMed.call("einfo", {})).rejects.toBeInstanceOf(
      NlmHttpError,
    );
  });
});

describe("catalog coverage and identifier directions", () => {
  it("maps UNII and names to native RxNorm, DailyMed, and MeSH queries", async () => {
    const { client, requests } = fixture();
    await client.identifiers.rxCuisForUnii("R16CO5Y76E");
    await client.identifiers.splsForUnii("R16CO5Y76E");
    await client.identifiers.rxCuisForName("aspirin");
    await client.identifiers.splsForName("aspirin");
    await client.identifiers.meshDescriptorsForName("aspirin");
    expect(
      requests.map(({ url }) => [
        url.pathname,
        Object.fromEntries(url.searchParams),
      ]),
    ).toEqual([
      ["/REST/rxcui.json", { idtype: "UNII_CODE", id: "R16CO5Y76E" }],
      ["/dailymed/services/v2/spls.json", { unii_code: "R16CO5Y76E" }],
      ["/REST/rxcui.json", { name: "aspirin" }],
      ["/dailymed/services/v2/spls.json", { drug_name: "aspirin" }],
      ["/mesh/lookup/descriptor", { label: "aspirin" }],
    ]);
  });

  it("exposes the RxNav families without mixing their operation sets", async () => {
    const { client, requests } = fixture();
    await client.rxNorm.call("getNDCStatus", { ndc: "00310-0751-39" });
    await client.prescribable.call("getApproximateMatch", { term: "aspirn" });
    await client.rxClass.call("getClassMembers", {
      classId: "N0000175562",
      relaSource: "MEDRT",
    });
    await client.rxTerms.call("getRxTermDisplayName", { rxcui: "198440" });
    expect(requests.map(({ url }) => url.pathname)).toEqual([
      "/REST/ndcstatus.json",
      "/REST/Prescribe/approximateTerm.json",
      "/REST/rxclass/classMembers.json",
      "/REST/RxTerms/rxcui/198440/name.json",
    ]);
  });

  it("retrieves SPL documents as XML and supports returning to an NDC", async () => {
    const { client, requests } = fixture("<document />");
    await client.dailyMed.call("splDocument", { setid: "label-id" });
    await client.identifiers.ndcsForSpl("label-id");
    expect(requests.map(({ url }) => url.pathname)).toEqual([
      "/dailymed/services/v2/spls/label-id.xml",
      "/dailymed/services/v2/spls/label-id/ndcs.json",
    ]);
  });

  it("supports reverse mapping from NDC, RxCUI and SPL set ID", async () => {
    const { client, requests } = fixture();
    await client.identifiers.rxCuisForNdc("00310-0751-39");
    await client.identifiers.ndcsForRxCui("198440");
    await client.identifiers.splsForRxCui("198440");
    await client.identifiers.rxCuisForSpl("label-id");
    expect(
      requests.map(({ url }) => [
        url.pathname,
        Object.fromEntries(url.searchParams),
      ]),
    ).toEqual([
      ["/REST/rxcui.json", { idtype: "NDC", id: "00310-0751-39" }],
      ["/REST/rxcui/198440/ndcs.json", {}],
      ["/dailymed/services/v2/spls.json", { rxcui: "198440" }],
      ["/REST/rxcui.json", { idtype: "SPL_SET_ID", id: "label-id" }],
    ]);
  });

  it("supports PubMed XML fetch and MeSH descriptor retrieval by identifier", async () => {
    const { client, requests } = fixture("<PubmedArticleSet />");
    await client.pubMed.call("efetch", { id: "123", retmode: "xml" });
    await client.mesh.resource("D001241");
    expect(requests.map(({ url }) => url.pathname)).toEqual([
      "/entrez/eutils/efetch.fcgi",
      "/mesh/D001241.json",
    ]);
    expect(requests[0]?.url.searchParams.get("retmode")).toBe("xml");
  });

  it("encodes path segments rather than allowing path injection", async () => {
    const { client, requests } = fixture();
    await client.rxNorm.call("getNDCs", { rxcui: "a/b?c" });
    expect(requests[0]?.url.pathname).toBe("/REST/rxcui/a%2Fb%3Fc/ndcs.json");
  });
});

describe("other documented service forms", () => {
  it("requires documented RxNav query keys and forwards their upstream names", async () => {
    const { client, requests } = fixture();
    expect(() =>
      client.rxNorm.call("getNDCProperties", { ndc: "00310-0751-39" }),
    ).toThrow("Missing parameter id");
    await client.rxNorm.call("getNDCProperties", { id: "00310-0751-39" });
    expect(() =>
      client.rxClass.call("getClassMembers", { classId: "A12CA" }),
    ).toThrow("Missing parameter relaSource");
    await client.rxClass.call("getClassMembers", {
      classId: "A12CA",
      relaSource: "ATC",
    });
    await client.rxClass.call("getSpellingSuggestions", { term: "analgesic" });
    await client.rxClass.call("getRelas", {});
    expect(
      requests.map(({ url }) => [
        url.pathname,
        Object.fromEntries(url.searchParams),
      ]),
    ).toEqual([
      ["/REST/ndcproperties.json", { id: "00310-0751-39" }],
      [
        "/REST/rxclass/classMembers.json",
        { classId: "A12CA", relaSource: "ATC" },
      ],
      ["/REST/rxclass/spellingsuggestions.json", { term: "analgesic" }],
      ["/REST/rxclass/relas.json", {}],
    ]);
  });

  it("joins PubMed ID lists with commas rather than RxNav's space separator", async () => {
    const { client, requests } = fixture();
    await client.pubMed.call("esummary", { id: ["123", "456"] });
    expect(requests[0]?.url.searchParams.get("id")).toBe("123,456");
  });

  it("posts long PubMed ID lists as form data when requested", async () => {
    const { client, requests } = fixture();
    await client.pubMed.call(
      "epost",
      { id: ["123", "456"] },
      { method: "POST" },
    );
    expect(requests[0]?.url.pathname).toBe("/entrez/eutils/epost.fcgi");
    expect(requests[0]?.url.search).toBe("");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(new URLSearchParams(String(requests[0]?.init?.body)).get("id")).toBe(
      "123,456",
    );
  });

  it("joins required RxNorm ingredient lists with spaces", async () => {
    const { client, requests } = fixture();
    await client.rxNorm.call("getMultiIngredBrand", {
      ingredientids: ["8896", "20610"],
    });
    expect(requests[0]?.url.searchParams.get("ingredientids")).toBe(
      "8896 20610",
    );
  });

  it("requires MeSH lookup keys and requests JSON SPARQL results by default", async () => {
    const { client, requests } = fixture();
    expect(() => client.mesh.call("pair", { label: "Aspirin" })).toThrow(
      "Missing parameter descriptor",
    );
    await client.mesh.call("pair", { label: "Aspirin", descriptor: "D001241" });
    await client.mesh.call("sparql", {
      query: "SELECT * WHERE { ?s ?p ?o } LIMIT 1",
    });
    expect(requests[0]?.url.searchParams.get("descriptor")).toBe("D001241");
    expect(requests[1]?.url.searchParams.get("format")).toBe("JSON");
  });

  it("posts an ICD-10 diagnosis to MedlinePlus Connect as form data", async () => {
    const { client, requests } = fixture({ feed: { entry: [] } });
    await client.medlinePlusConnect.connect(
      {
        kind: "diagnosis",
        system: "icd10cm",
        code: "J45.909",
        language: "en",
      },
      { method: "POST" },
    );
    expect(requests[0]?.url.pathname).toBe("/application");
    expect(requests[0]?.url.search).toBe("");
    expect(requests[0]?.init?.method).toBe("POST");
    const body = new URLSearchParams(String(requests[0]?.init?.body));
    expect(body.get("mainSearchCriteria.v.cs")).toBe("2.16.840.1.113883.6.90");
    expect(body.get("mainSearchCriteria.v.c")).toBe("J45.909");
    expect(requests[0]?.init?.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
  });

  it("allows English-only medication name fallback but not Spanish name-only lookup", async () => {
    const { client, requests } = fixture();
    await client.medlinePlusConnect.connect({
      kind: "drugName",
      name: "aspirin",
      language: "en",
    });
    expect(requests[0]?.url.searchParams.get("mainSearchCriteria.v.dn")).toBe(
      "aspirin",
    );
    expect(requests[0]?.url.searchParams.has("mainSearchCriteria.v.c")).toBe(
      false,
    );
  });

  it("downloads the latest PDF and historical ZIP without mistaking them for text", async () => {
    const requests: URL[] = [];
    const client = new NlmDrugsClient({
      fetch: async (input) => {
        requests.push(new URL(String(input)));
        return new Response(new Uint8Array([0x50, 0x44, 0x46]), {
          status: 200,
        });
      },
    });
    const latest = await client.dailyMed.download({
      setid: "label-id",
      format: "pdf",
    });
    await client.dailyMed.download({
      setid: "label-id",
      format: "zip",
      version: 3,
    });
    expect([...new Uint8Array(latest)]).toEqual([0x50, 0x44, 0x46]);
    expect(requests.map((url) => `${url.pathname}${url.search}`)).toEqual([
      "/dailymed/downloadpdffile.cfm?setId=label-id",
      "/dailymed/getFile.cfm?type=zip&setid=label-id&version=3",
    ]);
  });

  it("does not include credential-bearing query strings in HTTP errors", async () => {
    const client = new NlmDrugsClient({
      pubMed: { apiKey: "secret-example" },
      fetch: async () => new Response("blocked", { status: 429 }),
    });
    try {
      await client.pubMed.call("esearch", { term: "aspirin" });
      throw new Error("Expected request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(NlmHttpError);
      expect(String(error)).not.toContain("secret-example");
    }
  });
});
