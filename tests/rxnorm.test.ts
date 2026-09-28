import { describe, expect, it } from "vitest";
import { PrescribableRxNormClient } from "../src/prescribable.ts";
import { RxNormClient } from "../src/rxnorm.ts";
import { jsonResponse, stubFetch } from "./helpers.ts";

describe("RxNormClient", () => {
  it("findRxcuiByString returns RxCUIs for a name", async () => {
    const { fetch, urls } = stubFetch(() =>
      jsonResponse({ idGroup: { rxnormId: ["153165"] } }),
    );
    const client = new RxNormClient({ fetch });
    await expect(
      client.findRxcuiByString({ name: "lipitor" }),
    ).resolves.toEqual(["153165"]);
    expect(urls[0]).toBe(
      "https://rxnav.nlm.nih.gov/REST/rxcui.json?name=lipitor",
    );
  });

  it("normalizes a single rxnormId string to an array", async () => {
    const { fetch } = stubFetch(() =>
      jsonResponse({ idGroup: { rxnormId: "153165" } }),
    );
    const client = new RxNormClient({ fetch });
    await expect(
      client.findRxcuiByString({ name: "lipitor" }),
    ).resolves.toEqual(["153165"]);
  });

  it("normalizes a single approximateTerm candidate to an array", async () => {
    const { fetch } = stubFetch(() =>
      jsonResponse({
        approximateGroup: {
          inputTerm: "lipito",
          candidate: { rxcui: "153165", source: "RXNORM", name: "Lipitor" },
        },
      }),
    );
    const client = new RxNormClient({ fetch });
    const candidates = await client.approximateTerm({
      term: "lipito",
      maxEntries: 5,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.rxcui).toBe("153165");
  });

  it("getNDCs returns the NDC list", async () => {
    const { fetch, urls } = stubFetch(() =>
      jsonResponse({
        ndcGroup: {
          rxcui: "197361",
          ndcList: { ndc: ["00071-0158-23", "00071-0158-24"] },
        },
      }),
    );
    const client = new RxNormClient({ fetch });
    await expect(client.getNDCs({ rxcui: "197361" })).resolves.toEqual([
      "00071-0158-23",
      "00071-0158-24",
    ]);
    expect(urls[0]).toBe(
      "https://rxnav.nlm.nih.gov/REST/rxcui/197361/ndcs.json",
    );
  });

  it("getAllRelatedInfo returns concept groups by term type", async () => {
    const { fetch } = stubFetch(() =>
      jsonResponse({
        allRelatedGroup: {
          conceptGroup: [
            {
              tty: "BN",
              conceptProperties: [{ rxcui: "153165", name: "Lipitor" }],
            },
            { tty: "BPCK", conceptProperties: null },
          ],
        },
      }),
    );
    const client = new RxNormClient({ fetch });
    const groups = await client.getAllRelatedInfo({ rxcui: "153165" });
    expect(groups).toHaveLength(2);
    expect(groups[0]?.tty).toBe("BN");
    expect(groups[0]?.conceptProperties?.[0]?.name).toBe("Lipitor");
    expect(groups[1]?.conceptProperties).toBeNull();
  });

  it("getRxcuiHistoryStatus returns the status record", async () => {
    const { fetch } = stubFetch(() =>
      jsonResponse({
        rxcuiStatusHistory: {
          metaData: { status: "Active", source: "RXNORM" },
          attributes: { rxcui: "153165", name: "Lipitor", tty: "BN" },
        },
      }),
    );
    const client = new RxNormClient({ fetch });
    const history = await client.getRxcuiHistoryStatus({ rxcui: "153165" });
    expect(history.metaData.status).toBe("Active");
    expect(history.attributes?.name).toBe("Lipitor");
  });

  it("getRxcuiHistoryStatus throws when the concept is unknown", async () => {
    const { fetch } = stubFetch(() => jsonResponse({}));
    const client = new RxNormClient({ fetch });
    await expect(
      client.getRxcuiHistoryStatus({ rxcui: "0" }),
    ).rejects.toThrowError(/No status history for RxCUI 0/);
  });

  it("supports a custom base URL (RxNav-in-a-Box)", async () => {
    const { fetch, urls } = stubFetch(() =>
      jsonResponse({ idGroup: { rxnormId: ["153165"] } }),
    );
    const client = new RxNormClient({
      fetch,
      baseUrl: "https://rxnav-box.internal/REST",
    });
    await client.findRxcuiByString({ name: "lipitor" });
    expect(urls[0]).toBe(
      "https://rxnav-box.internal/REST/rxcui.json?name=lipitor",
    );
  });
});

describe("PrescribableRxNormClient", () => {
  it("scopes requests to the prescribable content", async () => {
    const { fetch, urls } = stubFetch(() =>
      jsonResponse({ idGroup: { rxnormId: ["617318"] } }),
    );
    const client = new PrescribableRxNormClient({ fetch });
    await client.findRxcuiByString({ name: "lipitor" });
    expect(urls[0]).toBe(
      "https://rxnav.nlm.nih.gov/REST/Prescribe/rxcui.json?name=lipitor",
    );
  });
});
