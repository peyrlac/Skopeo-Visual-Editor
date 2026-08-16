# Task 3 Report: Studio tRPC Router

## Summary

Implemented the Skopeo Studio local-first tRPC router and registered it on the app router as `studio`.

The router exposes:

- `studio.resolveElementSource`
- `studio.previewClassPatch`
- `studio.applyClassPatch`

All procedures require a `sandboxId` beginning with `local:` and use `env.ONLOOK_LOCAL_PROJECT_ROOT` through `NodeFsProvider`. `previewClassPatch` and `applyClassPatch` now reject file paths outside the Skopeo Studio V1 source roots (`src/components`, `src/views`, `src/app`) and outside the supported source extensions (`.tsx`, `.ts`, `.jsx`, `.js`) before reading or writing.

Updated the Studio test to exercise the router through `appRouter.createCaller` with an authenticated context stub.

## Files Changed

- `apps/web/client/src/server/api/root.ts`
- `apps/web/client/src/server/api/routers/index.ts`
- `apps/web/client/src/server/api/routers/studio/index.ts`
- `apps/web/client/test/studio/fixtures/skopeo-mini/src/components/Card.tsx`
- `apps/web/client/test/studio/studio-router.test.ts`

## Commit

- `7b01a01ffc7b8e97c340007be21fbbce64e07cb5` - `feat: add skopeo studio local api`
- Current commit - `fix: harden skopeo studio router`

## Tests

- `bun test apps/web/client/test/studio/studio-router.test.ts`
  - Result: PASS
  - Evidence: 5 pass, 0 fail, 10 expectations
  - Coverage: `resolveElementSource`, `previewClassPatch`, `applyClassPatch`, non-local sandbox rejection, and V1 source-root path rejection through tRPC

- `bun --filter @onlook/web-client typecheck`
  - Result: PASS
  - Evidence: exited with code 0

- `git diff --check`
  - Result: PASS
  - Evidence: exit code 0; only Windows CRLF warnings for touched files

## Risks / Notes

- No parser files were modified.
- No dependencies were added.
- Docker was not run.
- Router tests now use authenticated tRPC caller execution without booting Next.
- `readSearchFiles` silently skips missing search directories so local projects without `src/views` or `src/app` can still resolve elements from existing directories.
