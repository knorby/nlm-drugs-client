import { describe, expect, it } from "vitest";
import { NlmDrugsClient, NlmResponseError } from "../src/index";

type Request = { url: URL; init?: RequestInit };

function fixture(responses: Array<unknown | string>) {
  const requests: Request[] = [];
  const client = new NlmDrugsClient({
    fetch: async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      const body = responses.shift();
      return typeof body === "string"
        ? new Response(body, { headers: { "content-type": "application/xml" } })
        : Response.json(body ?? {});
    },
    umls: { apiKey: "private-key" },
  });
  return { client, requests };
}

describe("typed source clients", () => {
  it("iterates PubMed ID pages without repeating an offset and retrieves XML", async () => {
    const { client, requests } = fixture([
      { esearchresult: { count: "2", retstart: "0", idlist: ["111"] } },
      { esearchresult: { count: "2", retstart: "1", idlist: ["222"] } },
      "<PubmedArticleSet />",
    ]);
    const ids = [];
    for await (const id of client.pubMed.iterateIds("aspirin", { pageSize: 1 }))
      ids.push(id);
    expect(ids).toEqual(["111", "222"]);
    expect(
      requests.slice(0, 2).map(({ url }) => url.searchParams.get("retstart")),
    ).toEqual(["0", "1"]);
    expect(await client.pubMed.fetchXml(ids)).toBe("<PubmedArticleSet />");
    expect(requests[2]?.url.searchParams.get("id")).toBe("111,222");
  });

  it("maps RxNorm NDC results and keeps empty Prescribable matches empty", async () => {
    const { client } = fixture([
      { idGroup: { rxnormId: ["198440"] } },
      { ndcGroup: { ndcList: { ndc: ["00071015723"] } } },
      { ndcStatus: { status: "ACTIVE" } },
      { idGroup: {} },
    ]);
    expect(await client.rxNorm.findByNdc("00071-0157-23")).toEqual(["198440"]);
    expect(await client.rxNorm.getNdcs("198440")).toEqual(["00071015723"]);
    expect(await client.rxNorm.getNdcStatus("00071015723")).toMatchObject({
      status: "ACTIVE",
    });
    expect(await client.prescribable.findConcepts("nonexistent-name")).toEqual(
      [],
    );
  });

  it("parses the RxClass drug-info wrapper rather than the class-name wrapper", async () => {
    const { client } = fixture([
      {
        rxclassDrugInfoList: {
          rxclassDrugInfo: [
            {
              rxclassMinConceptItem: {
                classId: "N02",
                className: "ANALGESICS",
                classType: "ATC1-4",
              },
            },
          ],
        },
      },
    ]);
    expect(
      await client.rxClass.findClassesForRxCui("198440", { relaSource: "ATC" }),
    ).toEqual([
      { classId: "N02", className: "ANALGESICS", classType: "ATC1-4" },
    ]);
  });

  it("reads DailyMed SPL package codes and XML without treating XML as JSON", async () => {
    const { client, requests } = fixture([
      { data: { ndcs: [{ ndc: "00071015723" }] } },
      "<document />",
    ]);
    expect(await client.dailyMed.ndcsForSpl("label-id")).toEqual([
      "00071015723",
    ]);
    expect(await client.dailyMed.getSplXml("label-id")).toBe("<document />");
    expect(requests[1]?.url.pathname).toBe(
      "/dailymed/services/v2/spls/label-id.xml",
    );
  });

  it("retrieves UMLS concept and atoms from their distinct result wrappers", async () => {
    const { client, requests } = fixture([
      { result: { ui: "C0004057", name: "Aspirin" } },
      { result: [{ ui: "A0001", name: "aspirin" }] },
    ]);
    expect(await client.umls.getConcept("C0004057")).toMatchObject({
      ui: "C0004057",
    });
    expect(
      await client.umls.getAtoms("C0004057", { source: "RXNORM" }),
    ).toMatchObject([{ ui: "A0001" }]);
    expect(requests[1]?.url.searchParams.get("sabs")).toBe("RXNORM");
  });

  it("finds RxNorm concepts by name and looks up a concept with its native identity", async () => {
    const { client, requests } = fixture([
      { idGroup: { rxnormId: ["1191"] } },
      { properties: { rxcui: "1191", name: "aspirin", tty: "IN" } },
    ]);
    expect(await client.rxNorm.findConcepts("aspirin", { search: 2 })).toEqual([
      "1191",
    ]);
    expect(await client.rxNorm.getConcept("1191")).toMatchObject({
      rxcui: "1191",
      name: "aspirin",
      tty: "IN",
    });
    expect(requests[0]?.url.searchParams.get("search")).toBe("2");
    expect(requests[1]?.url.pathname).toBe("/REST/rxcui/1191/properties.json");
  });

  it("keeps prescribable concepts, class search and RxTerms distinct", async () => {
    const { client, requests } = fixture([
      { idGroup: { rxnormId: ["1"] } },
      {
        rxclassMinConceptList: {
          rxclassMinConcept: [
            { classId: "N02", className: "ANALGESICS", classType: "ATC1-4" },
          ],
        },
      },
      {
        rxtermsProperties: {
          rxcui: "198440",
          displayName: "Acetaminophen (Oral Pill)",
          fullName: "acetaminophen 500 MG Oral Tablet",
        },
      },
    ]);
    expect(await client.prescribable.findConcepts("aspirin")).toEqual(["1"]);
    expect(await client.rxClass.findClasses("Analgesics")).toEqual([
      { classId: "N02", className: "ANALGESICS", classType: "ATC1-4" },
    ]);
    expect(await client.rxTerms.getTerm("198440")).toMatchObject({
      rxcui: "198440",
      displayName: "Acetaminophen (Oral Pill)",
    });
    expect(requests.map((request) => request.url.pathname)).toEqual([
      "/REST/Prescribe/rxcui.json",
      "/REST/rxclass/class/byName.json",
      "/REST/RxTerms/rxcui/198440/allinfo.json",
    ]);
  });

  it("searches and pages through DailyMed SPLs without exposing its metadata wrapper", async () => {
    const { client, requests } = fixture([
      {
        data: [{ setid: "a", title: "Aspirin", spl_version: 2 }],
        metadata: { current_page: 1, total_pages: 2, next_page: 2 },
      },
      {
        data: [{ setid: "b", title: "Aspirin", spl_version: 1 }],
        metadata: { current_page: 2, total_pages: 2 },
      },
    ]);
    const pages = [];
    for await (const spl of client.dailyMed.iterateSpls({
      drugName: "aspirin",
      pageSize: 1,
    }))
      pages.push(spl.setid);
    expect(pages).toEqual(["a", "b"]);
    expect(
      requests.map(({ url }) => [
        url.searchParams.get("drug_name"),
        url.searchParams.get("page"),
        url.searchParams.get("pagesize"),
      ]),
    ).toEqual([
      ["aspirin", "1", "1"],
      ["aspirin", "2", "1"],
    ]);
  });

  it("accepts DailyMed's string null pagination on empty and single-page searches", async () => {
    const { client } = fixture([
      {
        data: [],
        metadata: {
          current_page: 1,
          total_pages: 0,
          total_elements: 0,
          next_page: "null",
        },
      },
      {
        data: [{ setid: "label-a", title: "Label A", spl_version: 3 }],
        metadata: {
          current_page: 1,
          total_pages: 1,
          total_elements: 1,
          next_page: "null",
        },
      },
    ]);
    expect(await client.dailyMed.searchSpls({ ndc: "58151-155" })).toEqual({
      items: [],
      page: 1,
      totalPages: 0,
      totalItems: 0,
      nextPage: undefined,
    });
    expect(await client.dailyMed.searchSpls({ rxcui: "617314" })).toEqual({
      items: [
        {
          setid: "label-a",
          title: "Label A",
          splVersion: 3,
          publishedDate: undefined,
        },
      ],
      page: 1,
      totalPages: 1,
      totalItems: 1,
      nextPage: undefined,
    });
  });

  it("looks up MeSH descriptors and PubMed articles with parsed results", async () => {
    const { client, requests } = fixture([
      [{ resource: "http://id.nlm.nih.gov/mesh/D001241", label: "Aspirin" }],
      {
        esearchresult: {
          count: "2",
          retstart: "0",
          retmax: "2",
          idlist: ["111", "222"],
        },
      },
      {
        result: {
          uids: ["111"],
          "111": { uid: "111", title: "An aspirin study", pubdate: "2024" },
        },
      },
    ]);
    expect(await client.mesh.findDescriptors("Aspirin")).toEqual([
      {
        id: "D001241",
        label: "Aspirin",
        resource: "http://id.nlm.nih.gov/mesh/D001241",
      },
    ]);
    expect(
      await client.pubMed.search("aspirin[MeSH Terms]", { pageSize: 2 }),
    ).toEqual({ ids: ["111", "222"], total: 2, start: 0 });
    expect(await client.pubMed.summarize(["111"])).toEqual([
      { uid: "111", title: "An aspirin study", pubdate: "2024" },
    ]);
    expect(requests[1]?.url.searchParams.get("term")).toBe(
      "aspirin[MeSH Terms]",
    );
  });

  it("parses MedlinePlus Connect links, health topics and genetics XML search", async () => {
    const { client, requests } = fixture([
      {
        feed: {
          entry: [
            {
              title: { _value: "Aspirin" },
              link: [
                { href: "https://medlineplus.gov/druginfo/meds/a682878.html" },
              ],
            },
          ],
        },
      },
      '<nlmSearchResult><count>1</count><file>abc</file><server>srv</server><list><document rank="1" url="https://medlineplus.gov/aspirin.html"><content name="title">Aspirin</content></document></list></nlmSearchResult>',
      '<search_results count="1"><file>file1</file><server>server1</server><result><order>0</order><score>5.99</score><url>https://medlineplus.gov/genetics/condition/alzheimers-disease</url></result></search_results>',
    ]);
    expect(
      await client.medlinePlusConnect.findDrugPages({
        kind: "rxcui",
        code: "1191",
      }),
    ).toEqual([
      {
        title: "Aspirin",
        url: "https://medlineplus.gov/druginfo/meds/a682878.html",
      },
    ]);
    expect(await client.medlinePlus.searchTopics("aspirin")).toMatchObject({
      total: 1,
      file: "abc",
      server: "srv",
      results: [
        { title: "Aspirin", url: "https://medlineplus.gov/aspirin.html" },
      ],
    });
    expect(await client.medlinePlusGenetics.search("alzheimer")).toEqual({
      total: 1,
      file: "file1",
      server: "server1",
      results: [
        {
          order: 0,
          score: 5.99,
          url: "https://medlineplus.gov/genetics/condition/alzheimers-disease",
        },
      ],
    });
    expect(
      requests.slice(1).map(({ url }) => url.searchParams.get("db")),
    ).toEqual(["healthTopics", "ghr"]);
  });

  it("uses authenticated UMLS search and crosswalk without disclosing the API key", async () => {
    const { client, requests } = fixture([
      {
        result: {
          results: [
            {
              ui: "C0004057",
              name: "Aspirin",
              rootSource: "RXNORM",
              uri: "https://uts-ws.nlm.nih.gov/rest/content/current/CUI/C0004057",
            },
          ],
        },
      },
      { result: [{ ui: "1191", name: "aspirin", rootSource: "RXNORM" }] },
    ]);
    expect(await client.umls.search("aspirin")).toMatchObject([
      { ui: "C0004057", name: "Aspirin" },
    ]);
    expect(
      await client.umls.crosswalk({
        source: "RXNORM",
        sourceId: "1191",
        targetSource: "SNOMEDCT_US",
      }),
    ).toMatchObject([{ ui: "1191" }]);
    expect(requests[0]?.url.searchParams.get("apiKey")).toBe("private-key");
    expect(requests[1]?.url.pathname).toBe(
      "/rest/crosswalk/current/source/RXNORM/1191",
    );
  });

  it("iterates ClinicalTrials.gov token pages and fetches studies by NCT ID", async () => {
    const { client, requests } = fixture([
      {
        studies: [
          {
            protocolSection: {
              identificationModule: {
                nctId: "NCT00000001",
                briefTitle: "First",
              },
            },
          },
        ],
        nextPageToken: "next",
      },
      {
        studies: [
          {
            protocolSection: {
              identificationModule: {
                nctId: "NCT00000002",
                briefTitle: "Second",
              },
            },
          },
        ],
      },
      {
        protocolSection: {
          identificationModule: { nctId: "NCT00000001", briefTitle: "First" },
        },
      },
    ]);
    const ids = [];
    for await (const study of client.clinicalTrials.iterateStudies({
      condition: "asthma",
      pageSize: 1,
    }))
      ids.push(study.nctId);
    expect(ids).toEqual(["NCT00000001", "NCT00000002"]);
    expect(
      (await client.clinicalTrials.getStudy("NCT00000001")).briefTitle,
    ).toBe("First");
    expect(requests[1]?.url.searchParams.get("pageToken")).toBe("next");
    expect(requests[2]?.url.pathname).toBe("/api/v2/studies/NCT00000001");
  });

  it("resolves PubChem compounds by name and retrieves named CID properties", async () => {
    const { client, requests } = fixture([
      { IdentifierList: { CID: [2244] } },
      {
        PropertyTable: {
          Properties: [
            {
              CID: 2244,
              MolecularFormula: "C9H8O4",
              MolecularWeight: "180.16",
            },
          ],
        },
      },
    ]);
    expect(await client.pubChem.findCompoundIds("aspirin")).toEqual([2244]);
    expect(
      await client.pubChem.getProperties(2244, [
        "MolecularFormula",
        "MolecularWeight",
      ]),
    ).toEqual({
      CID: 2244,
      MolecularFormula: "C9H8O4",
      MolecularWeight: "180.16",
    });
    expect(requests[0]?.url.pathname).toBe(
      "/rest/pug/compound/name/aspirin/cids/JSON",
    );
    expect(requests[1]?.url.pathname).toBe(
      "/rest/pug/compound/cid/2244/property/MolecularFormula,MolecularWeight/JSON",
    );
  });

  it("rejects malformed upstream responses rather than returning falsely typed data", async () => {
    const { client } = fixture([{ esearchresult: { idlist: "not an array" } }]);
    await expect(client.pubMed.search("aspirin")).rejects.toBeInstanceOf(
      NlmResponseError,
    );
  });

  it("returns ranked approximate RxNorm matches and class members with native keys", async () => {
    const { client, requests } = fixture([
      {
        approximateGroup: {
          candidate: [
            {
              rxcui: "1191",
              rxaui: "123",
              score: "91.5",
              rank: "1",
              name: "aspirin",
              source: "RXNORM",
            },
          ],
        },
      },
      {
        drugMemberGroup: {
          drugMember: [
            {
              minConcept: {
                rxcui: "198440",
                name: "acetaminophen 500 MG Oral Tablet",
                tty: "SCD",
              },
            },
          ],
        },
      },
    ]);
    expect(
      await client.rxNorm.approximateMatches("asprin", {
        maxEntries: 5,
        activeOnly: true,
      }),
    ).toEqual([
      {
        rxcui: "1191",
        rxaui: "123",
        score: 91.5,
        rank: 1,
        name: "aspirin",
        source: "RXNORM",
      },
    ]);
    expect(
      await client.rxClass.getMembers({ classId: "N02", relaSource: "ATC" }),
    ).toEqual([
      { rxcui: "198440", name: "acetaminophen 500 MG Oral Tablet", tty: "SCD" },
    ]);
    expect(requests[0]?.url.searchParams.get("option")).toBe("1");
    expect(requests[1]?.url.searchParams.get("relaSource")).toBe("ATC");
  });

  it("loads genetics JSON by native slug and PUG View compound records", async () => {
    const { client, requests } = fixture([
      {
        name: "Alzheimer disease",
        ghr_page:
          "https://medlineplus.gov/genetics/condition/alzheimer-disease/",
      },
      { Record: { RecordNumber: 2244, Title: "Aspirin", Section: [] } },
    ]);
    expect(
      await client.medlinePlusGenetics.getPage(
        "condition",
        "alzheimer-disease",
      ),
    ).toMatchObject({ name: "Alzheimer disease" });
    expect(
      await client.pubChem.getRecord(2244, { heading: "Safety and Hazards" }),
    ).toMatchObject({ Record: { Title: "Aspirin" } });
    expect(requests[0]?.url.pathname).toBe(
      "/download/genetics/condition/alzheimer-disease.json",
    );
    expect(requests[1]?.url.searchParams.get("heading")).toBe(
      "Safety and Hazards",
    );
  });

  it("paginates health topics with server cursor and rejects malformed XML", async () => {
    const { client, requests } = fixture([
      '<nlmSearchResult><count>2</count><file>f1</file><server>s1</server><list><document url="https://medlineplus.gov/aspirin.html"><content name="title">Aspirin</content></document></list></nlmSearchResult>',
      '<nlmSearchResult><count>2</count><list><document url="https://medlineplus.gov/pain.html"><content name="title">Pain</content></document></list></nlmSearchResult>',
      '<nlmSearchResult><count>1</count><list><document url="https://medlineplus.gov/foo.html" /></list></nlmSearchResult>',
    ]);
    const pages = [];
    for await (const page of client.medlinePlus.iterateTopics("pain", {
      pageSize: 1,
    }))
      pages.push(page.title);
    expect(pages).toEqual(["Aspirin", "Pain"]);
    expect(requests[1]?.url.searchParams.get("file")).toBe("f1");
    expect(requests[1]?.url.searchParams.get("server")).toBe("s1");
    expect(requests[1]?.url.searchParams.get("retstart")).toBe("1");
    await expect(client.medlinePlus.searchTopics("foo")).rejects.toBeInstanceOf(
      NlmResponseError,
    );
  });

  it("normalizes malformed upstream identifiers and never sends UMLS requests without a key", async () => {
    const { client } = fixture([
      [{ resource: "http://id.nlm.nih.gov/mesh/bad", label: "bad" }],
    ]);
    await expect(client.mesh.findDescriptors("bad")).rejects.toBeInstanceOf(
      NlmResponseError,
    );
    let requests = 0;
    const noKey = new NlmDrugsClient({
      fetch: async () => {
        requests++;
        return Response.json({});
      },
    });
    await expect(noKey.umls.search("aspirin")).rejects.toThrow(
      "UMLS requires an API key",
    );
    expect(requests).toBe(0);
  });
});
