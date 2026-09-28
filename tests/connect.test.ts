import { describe, expect, it } from "vitest";
import { MedlinePlusConnectClient } from "../src/connect.ts";
import { jsonResponse, stubFetch } from "./helpers.ts";

const entry = {
  title: { _value: "Atorvastatin", type: "text" },
  link: [
    {
      href: "https://medlineplus.gov/druginfo/meds/a600045.html",
      rel: "alternate",
    },
  ],
  summary: {
    type: "html",
    _value: "Atorvastatin is used to reduce the risk of heart attack",
  },
  updated: { _value: "2026-09-28T14:53:04Z" },
};

describe("MedlinePlusConnectClient", () => {
  it("maps an RxNorm code to MedlinePlus topics", async () => {
    const { fetch, urls } = stubFetch(() =>
      jsonResponse({
        feed: { title: { _value: "MedlinePlus Connect" }, entry },
      }),
    );
    const client = new MedlinePlusConnectClient({ fetch });
    const results = await client.connect({
      codeSystem: "rxnorm",
      code: "153165",
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Atorvastatin");
    expect(results[0]?.url).toBe(
      "https://medlineplus.gov/druginfo/meds/a600045.html",
    );
    expect(results[0]?.updated).toBe("2026-09-28T14:53:04Z");
    expect(urls[0]).toBe(
      "https://connect.medlineplus.gov/service?mainSearchCriteria.v.cs=2.16.840.1.113883.6.88&mainSearchCriteria.v.c=153165&knowledgeResponseType=application%2Fjson",
    );
  });

  it("uses the correct OID per code system", async () => {
    const { fetch, urls } = stubFetch(() => jsonResponse({ feed: {} }));
    const client = new MedlinePlusConnectClient({ fetch });
    await client.connect({ codeSystem: "icd10cm", code: "I10" });
    expect(urls[0]).toContain("mainSearchCriteria.v.cs=2.16.840.1.113883.6.90");
    expect(urls[0]).toContain("mainSearchCriteria.v.c=I10");
  });

  it("normalizes a single entry object to an array and tolerates missing links", async () => {
    const { fetch } = stubFetch(() =>
      jsonResponse({
        feed: { entry: { title: { _value: "Sodium" }, link: [] } },
      }),
    );
    const client = new MedlinePlusConnectClient({ fetch });
    const results = await client.connect({ codeSystem: "ndc", code: "12345" });
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Sodium");
    expect(results[0]?.url).toBe("");
  });
});
