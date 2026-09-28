import { describe, expect, it } from "vitest";
import { RxTermsClient } from "../src/rxterms.ts";
import { jsonResponse, stubFetch } from "./helpers.ts";

describe("RxTermsClient", () => {
  it("returns RxTerms properties for a prescribable concept", async () => {
    const { fetch, urls } = stubFetch(() =>
      jsonResponse({
        rxtermsProperties: {
          brandName: "LIPITOR",
          displayName: "LIPITOR (Oral Pill)",
          fullName: "atorvastatin 20 MG Oral Tablet [Lipitor]",
          fullGenericName: "atorvastatin 20 MG Oral Tablet",
          strength: "20 mg",
          rxtermsDoseForm: "Tab",
          route: "Oral Pill",
          termType: "SBD",
          rxcui: "617318",
          genericRxcui: "617310",
          rxnormDoseForm: "Oral Tablet",
        },
      }),
    );
    const client = new RxTermsClient({ fetch });
    const info = await client.getRxTermsInfo({ rxcui: "617318" });
    expect(info?.displayName).toBe("LIPITOR (Oral Pill)");
    expect(info?.strength).toBe("20 mg");
    expect(urls[0]).toBe(
      "https://rxnav.nlm.nih.gov/REST/RxTerms/rxcui/617318/allinfo.json",
    );
  });

  it("returns undefined for concepts outside RxTerms", async () => {
    const { fetch } = stubFetch(() => jsonResponse({}));
    const client = new RxTermsClient({ fetch });
    await expect(
      client.getRxTermsInfo({ rxcui: "153165" }),
    ).resolves.toBeUndefined();
  });
});
