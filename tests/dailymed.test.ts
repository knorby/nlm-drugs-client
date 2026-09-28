import { describe, expect, it } from "vitest";
import { DailyMedClient } from "../src/dailymed.ts";
import { jsonResponse, stubFetch, textResponse } from "./helpers.ts";

describe("DailyMedClient", () => {
  it("getSpls searches labels by drug name", async () => {
    const { fetch, urls } = stubFetch(() =>
      jsonResponse({
        metadata: {
          total_elements: 3,
          total_pages: 1,
          current_page: 1,
          elements_per_page: 100,
        },
        data: [
          {
            setid: "a60cc18b-0631-4cf0-b021-9f52224ece65",
            spl_version: 8,
            published_date: "Jul 15, 2026",
            title: "LIPITOR (ATORVASTATIN CALCIUM) TABLET, FILM COATED",
          },
        ],
      }),
    );
    const client = new DailyMedClient({ fetch });
    const result = await client.getSpls({ drugName: "lipitor" });
    expect(result.metadata.total_elements).toBe(3);
    expect(result.data[0]?.setid).toBe("a60cc18b-0631-4cf0-b021-9f52224ece65");
    expect(urls[0]).toBe(
      "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=lipitor",
    );
  });

  it("getSpl downloads the label as raw XML", async () => {
    const { fetch, urls } = stubFetch(() =>
      textResponse('<?xml version="1.0"?><document/>'),
    );
    const client = new DailyMedClient({ fetch });
    await expect(
      client.getSpl({ setId: "a60cc18b-0631-4cf0-b021-9f52224ece65" }),
    ).resolves.toMatch(/^<\?xml/);
    expect(urls[0]).toBe(
      "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/a60cc18b-0631-4cf0-b021-9f52224ece65.xml",
    );
  });

  it("getSplHistory unwraps the data envelope", async () => {
    const { fetch } = stubFetch(() =>
      jsonResponse({
        data: {
          spl: {
            title: "LIPITOR (ATORVASTATIN CALCIUM) TABLET, FILM COATED",
            setid: "a60cc18b-0631-4cf0-b021-9f52224ece65",
          },
          history: [
            { spl_version: 8, published_date: "Jul 15, 2026" },
            { spl_version: 7, published_date: "Jun 27, 2024" },
          ],
        },
      }),
    );
    const client = new DailyMedClient({ fetch });
    const history = await client.getSplHistory({
      setId: "a60cc18b-0631-4cf0-b021-9f52224ece65",
    });
    expect(history.spl.setid).toBe("a60cc18b-0631-4cf0-b021-9f52224ece65");
    expect(history.history).toHaveLength(2);
    expect(history.history[0]?.spl_version).toBe(8);
  });

  it("getUniis returns the UNII index", async () => {
    const { fetch } = stubFetch(() =>
      jsonResponse({
        metadata: { total_elements: 107866 },
        data: [
          {
            active_moiety:
              "(2-AMINO-5,6-DICHLOROQUINAZOLIN-3(4H )-YL)ACETIC ACID",
            unii_code: "03TUA9L576",
          },
        ],
      }),
    );
    const client = new DailyMedClient({ fetch });
    const result = await client.getUniis({ page: 1 });
    expect(result.data[0]?.unii_code).toBe("03TUA9L576");
  });
});
