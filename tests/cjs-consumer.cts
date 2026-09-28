import pkg = require("../dist/index.cjs");

const client = new pkg.NlmDrugsClient();
const ids: Promise<string[]> = client.rxNorm.findConcepts("aspirin");

export { ids };
