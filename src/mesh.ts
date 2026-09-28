import type { RequestOptions, SourceOperationsClient } from "./operations.js";
import { list, NlmResponseError, record, text } from "./parse.js";

export interface MeshDescriptor {
  id: string;
  label: string;
  resource: string;
}

export function createMeshMethods(call: SourceOperationsClient["mesh"]) {
  return {
    async findDescriptors(
      label: string,
      options?: RequestOptions & {
        match?: "exact" | "contains" | "startsWith";
      },
    ): Promise<MeshDescriptor[]> {
      const response = await call.call(
        "descriptor",
        { label, match: options?.match },
        options,
      );
      return list(response, "MeSH", "descriptors").map((value) => {
        const item = record(value, "MeSH", "descriptor");
        const resource = text(item.resource, "MeSH", "resource");
        const id = resource.split("/").at(-1);
        if (!id || !/^D\d+$/.test(id))
          throw new NlmResponseError("MeSH", "descriptor identifier");
        return { id, resource, label: text(item.label, "MeSH", "label") };
      });
    },
    /** Returns the native RDF/JSON-LD resource; schema depends on its MeSH type. */
    getResource(id: string, options?: RequestOptions) {
      return call.resource(id, options);
    },
    /** Query endpoint for relationships that are not covered by label lookup. */
    sparql(query: string, options?: RequestOptions): Promise<unknown> {
      return call.call("sparql", { query }, options);
    },
  };
}
