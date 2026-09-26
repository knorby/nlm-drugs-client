import type { RequestOptions, Transport } from "./operations.js";
import { list, record, responseUrl } from "./parse.js";

export type CompoundProperty =
  | "MolecularFormula"
  | "MolecularWeight"
  | "CanonicalSMILES"
  | "IsomericSMILES"
  | "IUPACName"
  | "InChI"
  | "InChIKey"
  | "XLogP"
  | "ExactMass";
export interface CompoundProperties {
  CID: number;
  [property: string]: string | number;
}

export function createPubChemClient(transport: Transport) {
  const fetchJson = (path: string, options?: RequestOptions) =>
    transport.request(
      "PubChem",
      responseUrl("https://pubchem.ncbi.nlm.nih.gov", path),
      options,
    );
  return {
    async findCompoundIds(
      name: string,
      options?: RequestOptions,
    ): Promise<number[]> {
      const response = record(
        await fetchJson(
          `/rest/pug/compound/name/${encodeURIComponent(name)}/cids/JSON`,
          options,
        ),
        "PubChem",
        "response",
      );
      const ids = record(response.IdentifierList, "PubChem", "IdentifierList");
      return list(ids.CID, "PubChem", "CID").map((item) => {
        if (
          typeof item !== "number" ||
          !Number.isSafeInteger(item) ||
          item <= 0
        )
          throw new TypeError("PubChem returned an invalid CID");
        return item;
      });
    },
    async getProperties(
      cid: number,
      properties: readonly CompoundProperty[],
      options?: RequestOptions,
    ): Promise<CompoundProperties> {
      if (!Number.isSafeInteger(cid) || cid <= 0)
        throw new RangeError("CID must be a positive integer");
      if (!properties.length)
        throw new TypeError("At least one property is required");
      const response = record(
        await fetchJson(
          `/rest/pug/compound/cid/${cid}/property/${properties.join(",")}/JSON`,
          options,
        ),
        "PubChem",
        "response",
      );
      const table = record(response.PropertyTable, "PubChem", "PropertyTable");
      const item = record(
        list(table.Properties, "PubChem", "Properties")[0],
        "PubChem",
        "properties",
      );
      if (item.CID !== cid)
        throw new TypeError("PubChem returned an unexpected CID");
      const result: CompoundProperties = { CID: cid };
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === "string" || typeof value === "number")
          result[key] = value;
      }
      return result;
    },
    /** PUG View's rich nested record for a CID (for example, safety headings). */
    async getRecord(
      cid: number,
      options?: RequestOptions & { heading?: string },
    ): Promise<Record<string, unknown>> {
      if (!Number.isSafeInteger(cid) || cid <= 0)
        throw new RangeError("CID must be a positive integer");
      const url = responseUrl(
        "https://pubchem.ncbi.nlm.nih.gov",
        `/rest/pug_view/data/compound/${cid}/JSON`,
        { heading: options?.heading },
      );
      return record(
        await transport.request("PubChem", url, options),
        "PubChem",
        "record",
      );
    },
  };
}
