import { describe, expect, it } from "vitest";
import { NlmDrugsClient } from "../../src/index.js";

// Each test makes one real request. Keep these probes small and independent:
// a service outage should identify its own source rather than mask the others.
const client = new NlmDrugsClient({
  pubMed: {
    tool: "nlm-drugs-client-live-tests",
    ...(process.env.NCBI_EMAIL ? { email: process.env.NCBI_EMAIL } : {}),
  },
  ...(process.env.UMLS_API_KEY
    ? { umls: { apiKey: process.env.UMLS_API_KEY } }
    : {}),
});
const options = () => ({ signal: AbortSignal.timeout(25_000) });

describe("live upstream contracts (opt-in)", () => {
  it("RxNorm resolves an ingredient name", async () => {
    expect(
      await client.rxNorm.findConcepts("aspirin", { search: 2, ...options() }),
    ).toContain("1191");
  });

  it("RxNorm retrieves NDCs for a drug concept", async () => {
    const codes = await client.rxNorm.getNdcs("198440", options());
    expect(codes.length).toBeGreaterThan(0);
    expect(codes[0]).toMatch(/^\d+$/);
  });

  it("Prescribable RxNorm resolves a prescribed drug concept", async () => {
    const matches = await client.prescribable.findConcepts(
      "acetaminophen 500 MG Oral Tablet",
      { search: 2, ...options() },
    );
    expect(matches).toContain("198440");
  });

  it("RxClass searches therapeutic class names", async () => {
    const matches = await client.rxClass.findClasses("Analgesics", options());
    expect(
      matches.some((item) =>
        item.className.toUpperCase().includes("ANALGESIC"),
      ),
    ).toBe(true);
  });

  it("RxTerms resolves a display term by RxCUI", async () => {
    const term = await client.rxTerms.getTerm("198440", options());
    expect(term?.rxcui).toBe("198440");
    expect(term?.displayName).toBeTruthy();
  });

  it("DailyMed searches label summaries by drug name", async () => {
    const page = await client.dailyMed.searchSpls(
      { drugName: "aspirin", pageSize: 1 },
      options(),
    );
    expect(page.items[0]?.setid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(page.totalPages).toBeGreaterThan(0);
  });

  it("DailyMed retrieves package codes from a returned label set ID", async () => {
    const page = await client.dailyMed.searchSpls(
      { drugName: "aspirin", pageSize: 1 },
      options(),
    );
    const setid = page.items[0]?.setid;
    if (!setid) throw new Error("DailyMed search returned no label set ID");
    const codes = await client.dailyMed.ndcsForSpl(setid, options());
    expect(codes).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it("MeSH returns a descriptor for aspirin", async () => {
    const matches = await client.mesh.findDescriptors("Aspirin", {
      match: "exact",
      ...options(),
    });
    expect(matches.some((item) => item.id === "D001241")).toBe(true);
  });

  it("MedlinePlus Connect returns a drug information link", async () => {
    const pages = await client.medlinePlusConnect.findDrugPages(
      { kind: "rxcui", code: "1191" },
      options(),
    );
    expect(
      pages.some((page) => page.url.startsWith("https://medlineplus.gov/")),
    ).toBe(true);
  });

  it("MedlinePlus health topics parses keyword search XML", async () => {
    const page = await client.medlinePlus.searchTopics("aspirin", {
      pageSize: 1,
      ...options(),
    });
    expect(page.total).toBeGreaterThan(0);
    expect(page.results[0]?.title).toBeTruthy();
  });

  it("MedlinePlus Genetics parses its distinct XML search format", async () => {
    const page = await client.medlinePlusGenetics.search("alzheimer", {
      pageSize: 1,
      ...options(),
    });
    expect(page.total).toBeGreaterThan(0);
    expect(page.results[0]?.url).toContain("medlineplus.gov/genetics/");
  });

  it("MedlinePlus Genetics retrieves a structured condition page", async () => {
    const page = await client.medlinePlusGenetics.getPage(
      "condition",
      "alzheimers-disease",
      options(),
    );
    expect(page.name).toContain("Alzheimer");
  });

  it("PubMed returns PMIDs from a keyword search", async () => {
    const page = await client.pubMed.search("aspirin[MeSH Terms]", {
      pageSize: 1,
      ...options(),
    });
    expect(page.total).toBeGreaterThan(0);
    expect(page.ids[0]).toMatch(/^\d+$/);
  });

  it("PubMed retrieves summaries for a searched PMID", async () => {
    const page = await client.pubMed.search("aspirin[MeSH Terms]", {
      pageSize: 1,
      ...options(),
    });
    const id = page.ids[0];
    if (!id) throw new Error("PubMed search returned no PMID");
    const summaries = await client.pubMed.summarize([id], options());
    expect(summaries[0]?.uid).toBe(id);
    expect(summaries[0]?.title).toBeTruthy();
  });

  it("ClinicalTrials.gov returns studies matching an intervention", async () => {
    const page = await client.clinicalTrials.searchStudies(
      { intervention: "aspirin", pageSize: 1 },
      options(),
    );
    expect(page.studies[0]?.nctId).toMatch(/^NCT\d+$/);
  });

  it("ClinicalTrials.gov retrieves a study returned by search", async () => {
    const page = await client.clinicalTrials.searchStudies(
      { intervention: "aspirin", pageSize: 1 },
      options(),
    );
    const nctId = page.studies[0]?.nctId;
    if (!nctId) throw new Error("ClinicalTrials.gov search returned no NCT ID");
    expect((await client.clinicalTrials.getStudy(nctId, options())).nctId).toBe(
      nctId,
    );
  });

  it("PubChem resolves aspirin to its compound ID", async () => {
    expect(
      await client.pubChem.findCompoundIds("aspirin", options()),
    ).toContain(2244);
  });

  it("PubChem retrieves compound properties by CID", async () => {
    const properties = await client.pubChem.getProperties(
      2244,
      ["MolecularFormula", "MolecularWeight"],
      options(),
    );
    expect(properties.CID).toBe(2244);
    expect(properties.MolecularFormula).toBe("C9H8O4");
  });

  const umlsTest = process.env.UMLS_API_KEY ? it : it.skip;
  umlsTest("UMLS searches authenticated terminology", async () => {
    const matches = await client.umls.search("aspirin", {
      searchType: "exact",
      ...options(),
    });
    expect(matches.some((item) => item.ui === "C0004057")).toBe(true);
  });
});
