import { describe, expect, it } from "vitest";
import { RxClassClient } from "../src/rxclass.ts";
import { jsonResponse, stubFetch } from "./helpers.ts";

describe("RxClassClient", () => {
  it("findClassByDrug returns classes for an RxCUI", async () => {
    const { fetch, urls } = stubFetch(() =>
      jsonResponse({
        rxclassDrugInfoList: {
          rxclassDrugInfo: [
            {
              minConcept: {
                rxcui: "617310",
                name: "atorvastatin 20 MG Oral Tablet",
                tty: "SCD",
              },
              rxclassMinConceptItem: {
                classId: "C10AA",
                className: "HMG CoA reductase inhibitors",
                classType: "ATC1-4",
              },
              rela: "",
              relaSource: "ATCPROD",
            },
          ],
        },
      }),
    );
    const client = new RxClassClient({ fetch });
    const infos = await client.findClassByDrug({ rxcui: "617318" });
    expect(infos).toHaveLength(1);
    expect(infos[0]?.rxclassMinConceptItem?.classId).toBe("C10AA");
    expect(urls[0]).toBe(
      "https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json?rxcui=617318",
    );
  });

  it("getClassMembers sends relaSource and maps members", async () => {
    const { fetch, urls } = stubFetch(() =>
      jsonResponse({
        drugMemberGroup: {
          drugMember: [
            {
              minConcept: { rxcui: "36721", name: "sodium sulfate", tty: "IN" },
              nodeAttr: [
                { attrName: "SourceId", attrValue: "A12CA02" },
                { attrName: "Relation", attrValue: "DIRECT" },
              ],
            },
          ],
        },
      }),
    );
    const client = new RxClassClient({ fetch });
    const members = await client.getClassMembers({
      classId: "A12CA",
      relaSource: "ATC",
    });
    expect(members[0]?.minConcept.name).toBe("sodium sulfate");
    expect(members[0]?.nodeAttr?.[0]?.attrValue).toBe("A12CA02");
    expect(urls[0]).toBe(
      "https://rxnav.nlm.nih.gov/REST/rxclass/classMembers.json?classId=A12CA&relaSource=ATC",
    );
  });
});
