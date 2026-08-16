## Task 5 Report: Class Editor And Patch Center

### Summary

Implemented the Skopeo Studio class editor and patch center in `studio-tab`.
Static `className` values can now be edited, previewed through `api.studio.previewClassPatch.useMutation`, reviewed as a pending diff, discarded, and applied through `api.studio.applyClassPatch.useMutation`.

The pending patch is reset when the active sandbox, selected oid, resolved source file, source oid, or static class value changes. Preview/apply errors are rendered in the panel, apply/preview controls are disabled while mutations or source refetching are active, and the source query is refetched after apply.

Corrective pass: `handlePreview` now guards async preview responses with both a current preview context key and a monotonically increasing request id. The context key covers sandbox, selected oid, resolved file path, resolved source oid, and static class value, so a preview response that resolves after a sandbox/selection/source change is ignored instead of recreating a stale `pendingPatch`. The existing reset-on-context-change behavior remains in place.

### Files Changed

- `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/class-editor.tsx`
- `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/patch-center.tsx`
- `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/index.tsx`
- `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/index.test.ts`
- `.superpowers/sdd/2026-08-16-skopeo-studio-v1/task-5-report.md`

### Commit

- `eb6b2fd61f94e55ddbdb0efc861a969df80361e8` - `feat: add skopeo studio patch center`

### Tests

- `bun test 'apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/index.test.ts'`
  - RED before implementation: failed with `ENOENT` for missing `class-editor.tsx`.
  - GREEN after implementation: `1 pass`, `0 fail`, `10 expect() calls`.
  - Corrective RED: failed because `index.tsx` did not contain the stale-preview guard refs/request id.
  - Corrective GREEN: `2 pass`, `0 fail`, `14 expect() calls`.
- `bun --filter @onlook/web-client typecheck`
  - PASS: `@onlook/web-client typecheck: Exited with code 0`.

### Risks / Notes

- The UI test is source-level, matching the existing lightweight right-panel test style; it verifies wiring and required component behavior patterns rather than rendering React interactions.
- No router/parser code was changed.
- No Docker or new dependencies were used.
