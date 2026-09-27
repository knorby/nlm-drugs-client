# Changesets

Changesets manage versioning and changelogs for this package. Each change is
recorded as a markdown file in this directory; when you're ready to release,
changesets consumes them to bump the version and generate the changelog.

## Workflow

1. **Make your code changes** (feature, bugfix, etc.) on a branch.
2. **Create a changeset** describing the change:
   ```bash
   npx changeset
   ```
   Select patch / minor / major, write a short summary. A new `.md` file
   appears in `.changeset/` — commit it alongside your code.
3. **Open a PR** with both the code change and the changeset file.
4. **Release** when ready:
   ```bash
   npx changeset version   # bumps package.json + writes CHANGELOG.md
   npm run release          # builds + publishes to npm
   ```

The release workflow is staged at `workflow-templates/release.yml`; it runs
only after it has been moved to `.github/workflows/release.yml` and the
first-publish prerequisites in `AGENTS.md` are complete.

The `.md` files in this directory are consumed and deleted by `changeset version`.
