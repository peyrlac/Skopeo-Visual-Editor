# Skopeo Studio V2/V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Skopeo Studio from a selected-element class patcher into a practical local component lab with manual Figma/reference comparison.

**Architecture:** Reuse the V1 Studio router, local filesystem provider, and patch center. Add parser support for discovering exported React components, expose component/reference procedures through `studio`, then add Studio panel tabs for `Inspect`, `Components`, and `References`.

**Tech Stack:** Next.js app router, tRPC, Bun tests, `@onlook/parser` Babel helpers, local `NodeFsProvider`, React client components, local browser storage, Docker smoke checks.

## Global Constraints

- Local-first: no OAuth, no CodeSandbox, no required external runtime beyond existing local Docker/Skopeo preview.
- Skopeo target root is `ONLOOK_LOCAL_PROJECT_ROOT`, currently `/workspace/skopeo-next`.
- V2 must work against the mounted `SkopeoAPP/Next` source tree.
- V2 must not require Storybook or a Figma API token.
- V3 import is manual-first: paste/export JSON, SVG, PNG metadata, or notes; store references locally through Studio.
- Every code edit still goes through the V1 patch preview/apply path; V2/V3 do not overwrite source directly.
- Existing V1 `Inspect` flow must stay usable.

---

## File Structure

- Create `packages/parser/src/skopeo-studio/component-catalog.ts`
  Finds exported React-like components in TSX/JSX source files and returns stable metadata.

- Modify `packages/parser/src/skopeo-studio/index.ts`
  Exports component catalog APIs.

- Create `packages/parser/test/skopeo-studio/component-catalog.test.ts`
  Unit tests for exported function, const arrow, default, UI folder, and non-component filtering.

- Modify `apps/web/client/src/server/api/routers/studio/index.ts`
  Adds `listComponents`, `listReferences`, `saveReference`, and `deleteReference`.

- Modify `apps/web/client/test/studio/studio-router.test.ts`
  Adds integration coverage for component discovery and local reference storage.

- Create `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/component-catalog.tsx`
  Component Lab list/search and selected component summary.

- Create `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/reference-panel.tsx`
  Manual Figma/reference import, list, and selected reference comparison notes.

- Modify `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/index.tsx`
  Adds `Inspect`, `Components`, and `References` tabs while keeping V1 inspector as the default tab.

- Create `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/component-catalog.test.ts`
  Unit tests for filtering/sorting helper used by the component catalog UI.

---

## Task 1: Parser Component Catalog

**Files:**
- Create: `packages/parser/src/skopeo-studio/component-catalog.ts`
- Modify: `packages/parser/src/skopeo-studio/index.ts`
- Test: `packages/parser/test/skopeo-studio/component-catalog.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type StudioComponentMeta = {
      id: string;
      name: string;
      filePath: string;
      exportName: string;
      exportType: 'named' | 'default';
      importPath: string;
      folder: 'components' | 'views' | 'ui' | 'app' | 'other';
      propTypeName: string | null;
      usesClassName: boolean;
      line: number | null;
  };

  export function listStudioComponentsFromFiles(
      files: Array<{ path: string; content: string }>,
  ): StudioComponentMeta[];
  ```

- [ ] **Step 1: Write failing parser tests**

Create `packages/parser/test/skopeo-studio/component-catalog.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { listStudioComponentsFromFiles } from '../../src/skopeo-studio';

describe('listStudioComponentsFromFiles', () => {
    test('discovers named function and arrow React components', () => {
        const components = listStudioComponentsFromFiles([
            {
                path: 'src/components/MediaCard.tsx',
                content: `
type MediaCardProps = { title: string; className?: string };
export function MediaCard(props: MediaCardProps) {
  return <article className={props.className}>{props.title}</article>;
}
export const StatCard = ({ className }: { className?: string }) => <div className={className} />;
const helper = () => null;
`,
            },
        ]);

        expect(components.map((component) => component.name)).toEqual(['MediaCard', 'StatCard']);
        expect(components[0]).toMatchObject({
            id: 'src/components/MediaCard.tsx:MediaCard',
            folder: 'components',
            propTypeName: 'MediaCardProps',
            usesClassName: true,
            importPath: '@/components/MediaCard',
        });
    });

    test('discovers default exported page/view components', () => {
        const components = listStudioComponentsFromFiles([
            {
                path: 'src/views/DashboardPage.tsx',
                content: `export default function DashboardPage() { return <main />; }`,
            },
        ]);

        expect(components).toHaveLength(1);
        expect(components[0]).toMatchObject({
            name: 'DashboardPage',
            exportName: 'default',
            exportType: 'default',
            folder: 'views',
        });
    });

    test('filters lowercase utilities and non-tsx files', () => {
        const components = listStudioComponentsFromFiles([
            { path: 'src/lib/utils.ts', content: 'export function cn() { return ""; }' },
            { path: 'src/components/ui/button.tsx', content: 'export function Button() { return <button />; }' },
        ]);

        expect(components.map((component) => component.name)).toEqual(['Button']);
        expect(components[0]?.folder).toBe('ui');
    });
});
```

- [ ] **Step 2: Run failing test**

Run: `bun test packages/parser/test/skopeo-studio/component-catalog.test.ts`

Expected: FAIL because `listStudioComponentsFromFiles` is missing.

- [ ] **Step 3: Implement component catalog**

Create `component-catalog.ts` using `getAstFromContent`, `traverse`, `t`, and `generate`. Detect:
- `export function PascalName(props: PropsType) { return <.../> }`
- `export const PascalName = (props: PropsType) => <.../>`
- `export default function PascalName() { return <.../> }`

Filter to `.tsx` and `.jsx`. Component names must start with `A-Z`. `usesClassName` is true when the component source contains `className`. `importPath` strips `src/`, extension, and prefixes `@/`.

- [ ] **Step 4: Run parser tests**

Run:

```bash
bun test packages/parser/test/skopeo-studio/component-catalog.test.ts
bun test packages/parser/test/skopeo-studio
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/parser/src/skopeo-studio packages/parser/test/skopeo-studio
git commit -m "feat: discover skopeo studio components"
```

## Task 2: Studio Local Component And Reference API

**Files:**
- Modify: `apps/web/client/src/server/api/routers/studio/index.ts`
- Modify: `apps/web/client/test/studio/studio-router.test.ts`

**Interfaces:**
- Consumes: `listStudioComponentsFromFiles`
- Produces:
  ```ts
  studio.listComponents({ sandboxId: string })
  studio.listReferences({ sandboxId: string })
  studio.saveReference({ sandboxId: string, reference: StudioReferenceInput })
  studio.deleteReference({ sandboxId: string, id: string })
  ```
- Reference file path: `.onlook/skopeo-studio/figma-references.json`

- [ ] **Step 1: Write failing router tests**

Append tests in `apps/web/client/test/studio/studio-router.test.ts`:

```ts
test('lists Skopeo components from the local project', async () => {
    const caller = createCaller(await createTestContext());
    const components = await caller.studio.listComponents({ sandboxId: LOCAL_SANDBOX_ID });

    expect(components.some((component) => component.name === 'MediaCard')).toBe(true);
    expect(components.some((component) => component.name === 'DashboardPage')).toBe(true);
});

test('saves and lists manual Figma references locally', async () => {
    const caller = createCaller(await createTestContext());
    const saved = await caller.studio.saveReference({
        sandboxId: LOCAL_SANDBOX_ID,
        reference: {
            title: 'Media card Figma',
            kind: 'figma-json',
            componentId: 'src/components/MediaCard.tsx:MediaCard',
            content: '{"name":"Media card"}',
            notes: 'Match spacing and poster ratio.',
        },
    });

    const references = await caller.studio.listReferences({ sandboxId: LOCAL_SANDBOX_ID });
    expect(references.some((reference) => reference.id === saved.id)).toBe(true);

    await caller.studio.deleteReference({ sandboxId: LOCAL_SANDBOX_ID, id: saved.id });
});
```

- [ ] **Step 2: Run failing router tests**

Run: `bun test --timeout 60000 apps/web/client/test/studio/studio-router.test.ts`

Expected: FAIL because the procedures do not exist.

- [ ] **Step 3: Implement API**

In `studio/index.ts`:
- Import `listStudioComponentsFromFiles`.
- Add `listComponents` that reuses `readSearchFiles()` and returns sorted metadata.
- Add `StudioReference` and `StudioReferenceInput` zod schemas.
- Store references in `.onlook/skopeo-studio/figma-references.json`.
- Ensure `.onlook/skopeo-studio` exists before writing.
- Use `crypto.randomUUID()` for ids and ISO strings for `createdAt`.
- `deleteReference` rewrites the JSON file without the target id.

- [ ] **Step 4: Run router tests and typecheck**

Run:

```bash
bun test --timeout 60000 apps/web/client/test/studio/studio-router.test.ts
bun --filter @onlook/web-client typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/client/src/server/api/routers/studio apps/web/client/test/studio/studio-router.test.ts
git commit -m "feat: add skopeo studio local catalog api"
```

## Task 3: Component Lab UI

**Files:**
- Create: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/component-catalog.tsx`
- Create: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/component-catalog.test.ts`
- Modify: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/index.tsx`

**Interfaces:**
- Consumes: `api.studio.listComponents.useQuery({ sandboxId })`
- Produces:
  ```ts
  export function filterStudioComponents(
      components: StudioComponentListItem[],
      query: string,
  ): StudioComponentListItem[];
  ```

- [ ] **Step 1: Write failing UI helper tests**

Create `component-catalog.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { filterStudioComponents } from './component-catalog';

const components = [
    { id: '1', name: 'MediaCard', filePath: 'src/components/MediaCard.tsx', folder: 'components' },
    { id: '2', name: 'DashboardPage', filePath: 'src/views/DashboardPage.tsx', folder: 'views' },
    { id: '3', name: 'Button', filePath: 'src/components/ui/button.tsx', folder: 'ui' },
] as const;

describe('filterStudioComponents', () => {
    test('matches by component name and path case-insensitively', () => {
        expect(filterStudioComponents([...components], 'media').map((item) => item.name)).toEqual(['MediaCard']);
        expect(filterStudioComponents([...components], 'views').map((item) => item.name)).toEqual(['DashboardPage']);
    });

    test('sorts ui components after app components when query is empty', () => {
        expect(filterStudioComponents([...components], '').map((item) => item.name)).toEqual([
            'MediaCard',
            'DashboardPage',
            'Button',
        ]);
    });
});
```

- [ ] **Step 2: Run failing test**

Run: `bun test 'apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/component-catalog.test.ts'`

Expected: FAIL because `component-catalog.tsx` is missing.

- [ ] **Step 3: Implement catalog UI**

Create `component-catalog.tsx`:
- Export `StudioComponentListItem` type with the fields used by the UI.
- Export `filterStudioComponents`.
- Render a search input.
- Render count, folder badge, component name, file path, import path, `className` capability, and prop type.
- Keep layout compact for right panel.

Modify `index.tsx`:
- Add local tab state: `inspect | components | references`.
- Render three small tab buttons.
- Keep V1 inspector under `inspect`.
- Render `<ComponentCatalog sandboxId={sandboxId} />` under `components`.

- [ ] **Step 4: Run UI tests and typecheck**

Run:

```bash
bun test 'apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/component-catalog.test.ts'
bun --filter @onlook/web-client typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab
git commit -m "feat: add skopeo studio component lab"
```

## Task 4: Manual Figma Reference Panel

**Files:**
- Create: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/reference-panel.tsx`
- Modify: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/index.tsx`

**Interfaces:**
- Consumes:
  - `api.studio.listComponents.useQuery`
  - `api.studio.listReferences.useQuery`
  - `api.studio.saveReference.useMutation`
  - `api.studio.deleteReference.useMutation`

- [ ] **Step 1: Implement reference panel**

Create `reference-panel.tsx`:
- Title input.
- Kind select with `figma-json`, `svg`, `image-note`, `notes`.
- Component select populated from component catalog.
- Notes textarea.
- Content textarea for pasted JSON/SVG/URL/notes.
- Save button.
- Reference list showing title, kind, attached component id, created date, and delete button.
- Compare card showing selected component metadata beside selected reference notes/content preview.

- [ ] **Step 2: Wire References tab**

Modify `index.tsx`:
- Add `references` tab button.
- Render `<ReferencePanel sandboxId={sandboxId} />`.

- [ ] **Step 3: Run typecheck**

Run: `bun --filter @onlook/web-client typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab
git commit -m "feat: add skopeo studio figma references"
```

## Task 5: V2/V3 Smoke Verification

**Files:**
- No product files unless defects appear.

- [ ] **Step 1: Run full targeted checks**

Run:

```bash
bun test packages/parser/test/skopeo-studio
bun test --timeout 60000 apps/web/client/test/studio/studio-router.test.ts
bun test 'apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/component-catalog.test.ts'
bun test 'apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/tailwind-controls.test.ts'
bun --filter @onlook/web-client typecheck
```

Expected: PASS.

- [ ] **Step 2: Rebuild and restart Docker**

Run:

```bash
docker compose build web-client
docker compose up -d --no-build --force-recreate web-client
```

Expected: image builds and web-client starts healthy.

- [ ] **Step 3: Browser smoke**

Use local Chrome and Playwright to verify:
- `http://localhost:3000` redirects to local import.
- Finish setup reaches `/project/<id>`.
- Studio shows `Inspect`, `Components`, and `References`.
- Components tab lists at least `MediaCard`, `PageHeader`, and one `*Page`.
- References tab saves a manual `figma-json` reference and shows it in the list.

- [ ] **Step 4: Commit smoke script if created**

```bash
git add apps/web/client/test/studio
git commit -m "test: add skopeo studio v2 smoke"
```

## Self-Review Checklist

- Spec coverage: V2 component catalog/lab and V3 manual Figma reference compare are covered.
- Placeholder scan: no TBD/TODO/fill-in instructions.
- Type consistency: parser, router, and UI function names match across tasks.
- Scope control: no full Figma API, no Storybook, no direct code generation beyond V1 patch path.
