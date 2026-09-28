import { describe, expect, it } from "vitest";
import { createNlmClient } from "../src/client.ts";
import { MedlinePlusConnectClient } from "../src/connect.ts";
import { DailyMedClient } from "../src/dailymed.ts";
import { PrescribableRxNormClient } from "../src/prescribable.ts";
import { RxClassClient } from "../src/rxclass.ts";
import { RxNormClient } from "../src/rxnorm.ts";
import { RxTermsClient } from "../src/rxterms.ts";
import { jsonResponse, stubFetch } from "./helpers.ts";

describe("createNlmClient", () => {
  it("wires every sub-client with default endpoints", () => {
    const nlm = createNlmClient();
    expect(nlm.rxnorm).toBeInstanceOf(RxNormClient);
    expect(nlm.prescribable).toBeInstanceOf(PrescribableRxNormClient);
    expect(nlm.rxterms).toBeInstanceOf(RxTermsClient);
    expect(nlm.rxclass).toBeInstanceOf(RxClassClient);
    expect(nlm.dailymed).toBeInstanceOf(DailyMedClient);
    expect(nlm.connect).toBeInstanceOf(MedlinePlusConnectClient);
  });

  it("propagates base URL and fetch overrides to sub-clients", async () => {
    const { fetch, urls } = stubFetch(() =>
      jsonResponse({ idGroup: { rxnormId: ["153165"] } }),
    );
    const nlm = createNlmClient({
      rxnavBaseUrl: "https://rxnav-box.internal/REST",
      fetch,
    });
    await nlm.rxnorm.findRxcuiByString({ name: "lipitor" });
    expect(urls[0]).toBe(
      "https://rxnav-box.internal/REST/rxcui.json?name=lipitor",
    );
  });
});
