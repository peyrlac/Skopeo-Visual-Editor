# Task 1 Report

status: DONE_WITH_CONCERNS

## Red Test

Command:

```text
bun test packages/parser/test/skopeo-studio/component-catalog.test.ts
```

Failure: the test could not import `listStudioComponentsFromFiles` because it was not exported from `packages/parser/src/skopeo-studio/index.ts`.

## Green Tests

- `bun test packages/parser/test/skopeo-studio/component-catalog.test.ts`: PASS, 3 tests.
- `bun test packages/parser/test/skopeo-studio`: PASS, 11 tests and 19 assertions.
- Targeted ESLint and `git diff --check`: PASS.

## Commit Hashes

`b8745a06e2d46d9447fd1fcc3a1a670c8404d945` (implementation and report commit).

## Changed Files

- `packages/parser/src/skopeo-studio/component-catalog.ts`
- `packages/parser/src/skopeo-studio/index.ts`
- `packages/parser/test/skopeo-studio/component-catalog.test.ts`
- `.superpowers/sdd/2026-08-16-skopeo-studio-v2-v3/task-1-report.md`

## Self-Review

- Catalogs exported PascalCase function declarations and arrow-function components from `.tsx` and `.jsx` files.
- Captures default versus named exports, prop type names, source line, className usage, folder classification, stable ids, and import paths.
- Filters lowercase utilities and non-JSX TypeScript files.
- Repository-wide `bunx tsc --noEmit -p packages/parser/tsconfig.json` remains non-green because of unrelated existing workspace resolution and JSX configuration errors; the new file's local type errors were fixed.

## Round 1 Fix Report

status: DONE

### Red Test

- `bun test packages/parser/test/skopeo-studio/component-catalog.test.ts`: FAIL as expected; the new regression showed `FormatDate` was incorrectly catalogued.

### Green Tests

- `bun test packages/parser/test/skopeo-studio/component-catalog.test.ts`: PASS, 4 tests and 7 assertions.
- `bun test packages/parser/test/skopeo-studio`: PASS, 12 tests and 20 assertions.
- Targeted ESLint and `git diff --check`: PASS with no errors.

### Fix Summary

- Added recursive Babel AST JSX detection for exported function and arrow implementations.
- PascalCase exports are now catalogued only when their implementation contains a JSX element or fragment.

### Changed Files

- `packages/parser/src/skopeo-studio/component-catalog.ts`
- `packages/parser/test/skopeo-studio/component-catalog.test.ts`
- `.superpowers/sdd/2026-08-16-skopeo-studio-v2-v3/task-1-report.md`

### Commit

Pending final fix commit.
