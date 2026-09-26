# Expo compatibility fixture

This minimal Expo SDK 57 app imports the package's typed RxNorm and
MedlinePlus methods. From the repository root, run `npm run check:expo` to
build the package, install this fixture's lockfile, type-check it, and export
iOS and Android Hermes bundles with Metro. The default CI workflow runs the
same check in a separate job.

An export confirms the package and its XML parser resolve in Metro. It does
not execute requests on an iOS or Android device or validate network access.
The UI calls the public services only when the app is launched. Keep UMLS API
keys out of mobile bundles; use a trusted backend for authenticated calls.

This fixture has its own development dependencies and lockfile. Review its
audit findings separately from the package's runtime and build dependencies.
`npx expo install --check` verifies the SDK-compatible package versions, even
when a newer React, React Native, or TypeScript release exists on npm.

As of 2026-09-26, `npm audit` reports ten moderate findings cascading from
Expo's configuration tooling through `xcode@3.0.1` and its `uuid@7.0.3`
dependency ([uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq)).
This app is a development-only build fixture; it is not published or deployed.
The package's separate audit reports one low-severity advisory in development
`esbuild@0.27.7` ([esbuild advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)).
Recheck both dependency trees when Expo and the build tools release compatible
fixes; do not downgrade the Expo SDK solely to silence an audit report.
