# DailyMed SPL pagination handoff (2026-09-26)

Ritualog needs `dailyMed.searchSpls()` for NDC/RxCUI→SPL lookup. DailyMed
returns the **string** `"null"` in `metadata.next_page` on valid single-page
and empty search responses. The typed method previously passed that value to
the integer parser and threw `NlmResponseError` instead of returning the page.

`src/dailymed.ts` now treats JSON `null` and the literal `"null"` as no next
page. `tests/typed-clients.test.ts` covers both empty and single-page response
shapes; existing numeric pagination behavior remains unchanged. The regression
test failed with `DailyMed returned an invalid next_page` before the fix and
passed after it.

Verification: targeted regression failed before the fix and passed afterward.
Library lint, typecheck, 42 unit tests, build, and live probes passed
(18 passed, 1 skipped). The Expo consumer passed typecheck and iOS/Android
exports. Ritualog also passed lint, typecheck, 408 tests, Android export, and
the full pre-commit suite after its generated files were normalized.

The Ritualog integration uses the raw `splPackaging` and `splMedia` operations
only after selecting a specific SPL. A live Lipitor response listed all four
strengths under each product code, so Ritualog suppresses the strength when a
label lists conflicting strengths for the same ingredient. It never promotes
label-level strengths into a product dose or label images into product photos.

Follow-up: the API may emit other sentinel strings in other metadata fields;
do not generalize parsing until an actual affected typed method is identified.
The library remains unpublished; Ritualog consumes the local `file:` package.
CI/release needs a published or otherwise reproducible package source before
it can install this dependency. No commit, push, or publish was made.
