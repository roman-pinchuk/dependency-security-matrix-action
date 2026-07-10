# Dependency Security Matrix Action

[![CI](https://github.com/roman-pinchuk/dependency-security-matrix-action/actions/workflows/ci.yml/badge.svg)](https://github.com/roman-pinchuk/dependency-security-matrix-action/actions/workflows/ci.yml)
[![Check dist](https://github.com/roman-pinchuk/dependency-security-matrix-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/roman-pinchuk/dependency-security-matrix-action/actions/workflows/check-dist.yml)
[![Integration](https://github.com/roman-pinchuk/dependency-security-matrix-action/actions/workflows/integration.yml/badge.svg)](https://github.com/roman-pinchuk/dependency-security-matrix-action/actions/workflows/integration.yml)
[![Release](https://github.com/roman-pinchuk/dependency-security-matrix-action/actions/workflows/release.yml/badge.svg)](https://github.com/roman-pinchuk/dependency-security-matrix-action/actions/workflows/release.yml)

Generate a README dependency matrix from a package manifest, with optional scanner-backed security status.

The first supported scanner is Snyk. If the scanner report is missing or invalid, the action can still generate a dependency inventory table with current and latest npm versions.

## Usage

Add markers to your README:

```md
<!-- START_MATRIX_TABLE -->
<!-- END_MATRIX_TABLE -->
```

Run Snyk when a token is available, but let the matrix fall back when Snyk cannot produce a report:

```yaml
name: Dependency Security Matrix

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  matrix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Run Snyk
        continue-on-error: true
        uses: snyk/actions/node@v1
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --dev --json --json-file-output=snyk-results.json

      - name: Generate dependency security matrix
        id: matrix
        uses: roman-pinchuk/dependency-security-matrix-action@v1
        with:
          scanner: snyk
          scanner-report: snyk-results.json
          manifest: package.json
          manifest-type: npm
          readme: README.md

      - name: Commit matrix update
        if: github.event_name != 'pull_request' && steps.matrix.outputs.updated == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add README.md
          git commit -m "chore: update dependency security matrix"
          git push
```

## Generated Output

With scanner data:

```md
| Dependency | Type | Current Version | Security Status | Latest npm Version |
| :--- | :--- | :--- | :--- | :--- |
| **pino** | dependencies | `^10.0.0` | No known issues | `10.3.1` |
| **typescript** | devDependencies | `^5.7.3` | 1 high | `5.9.3` |
```

Without scanner data:

```md
| Dependency | Type | Current Version | Latest npm Version |
| :--- | :--- | :--- | :--- |
| **pino** | dependencies | `^10.0.0` | `10.3.1` |
| **typescript** | devDependencies | `^5.7.3` | `5.9.3` |

> Security status unavailable because no scanner report was provided or parsed.
```

## Commit Behavior

This action only modifies the markdown file in the runner workspace. Commit and push behavior belongs in the calling workflow.

Minimal commit step:

```yaml
- name: Commit Matrix Updates
  if: github.event_name != 'pull_request' && steps.matrix.outputs.updated == 'true'
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
    git add README.md
    git commit -m "chore: update dependency security matrix"
    git push
```

## Fallback Behavior

By default, the action does not fail when `scanner-report` is missing or invalid. It warns and generates a table without the `Security Status` column.

Set this when scanner data must be present:

```yaml
with:
  scanner-report-required: 'true'
```

## Inputs

| Input | Default | Description |
| :--- | :--- | :--- |
| `scanner` | `snyk` | Security scanner report format. Currently supports `snyk`. |
| `scanner-report` | empty | Path to scanner JSON report. |
| `scanner-report-required` | `false` | Fail when scanner report is missing or invalid. |
| `fallback-without-scanner` | `true` | Generate inventory table when scanner data is unavailable. |
| `manifest` | `package.json` | Path to dependency manifest. |
| `manifest-type` | `npm` | Manifest ecosystem. Currently supports `npm`. |
| `readme` | `README.md` | Markdown file to update. |
| `start-marker` | `<!-- START_MATRIX_TABLE -->` | Start marker for generated region. |
| `end-marker` | `<!-- END_MATRIX_TABLE -->` | End marker for generated region. |
| `include-dependencies` | `true` | Include `dependencies`. |
| `include-dev-dependencies` | `true` | Include `devDependencies`. |
| `include-latest-version` | `true` | Fetch latest versions from npm registry. |
| `include-status-note` | `true` | Add a fallback note when security status is unavailable. |
| `heading` | `## Dynamic Dependency & Security Matrix` | Generated table heading. |
| `fail-on-missing-markers` | `true` | Fail if README markers are missing. |

## Outputs

| Output | Description |
| :--- | :--- |
| `updated` | Whether the markdown file changed. |
| `dependency-count` | Number of dependencies rendered. |
| `latest-version-count` | Number of latest versions resolved. |
| `scanner-used` | Scanner adapter used, or `none`. |
| `security-status-available` | Whether security status was included. |
| `issue-count` | Total scanner findings included. |

## Scope

This action updates markdown only. It does not run scanners, upload SARIF, commit files, or push branches. Keep those responsibilities in the calling workflow.

## Versioning

Use the moving major tag for compatible updates:

```yaml
uses: roman-pinchuk/dependency-security-matrix-action@v1
```

Pin to a patch release when you need maximum repeatability:

```yaml
uses: roman-pinchuk/dependency-security-matrix-action@v1.0.3
```

## Development

```bash
npm ci
npm run check
```

JavaScript actions execute the bundled file in `dist/`, so source changes must be followed by:

```bash
npm run build
```

## License

MIT
