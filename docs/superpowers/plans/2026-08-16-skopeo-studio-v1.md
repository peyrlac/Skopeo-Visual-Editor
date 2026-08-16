# Skopeo Studio V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Skopeo Studio slice: select a Skopeo element, resolve its `data-oid` to source code, edit static Tailwind classes through a Studio inspector, preview a diff, and apply or discard the patch locally.

**Architecture:** Add a dedicated Studio tRPC router backed by the local NodeFs provider and a small TSX transform module. Add a new right-panel `Studio` tab that reads the current Onlook selection, calls Studio APIs, renders an inspector and patch center, and applies patches only after preview.

**Tech Stack:** Next.js app router, tRPC, MobX editor state, existing Onlook preload/selection model, `@onlook/parser` Babel utilities, local `NodeFsProvider`, Tailwind class string edits, Vitest/Bun tests, Playwright smoke checks.

## Global Constraints

- Local-first: no OAuth, no CodeSandbox, no required external runtime beyond existing local Supabase/Docker and Skopeo preview.
- Skopeo target root is `ONLOOK_LOCAL_PROJECT_ROOT`, currently `/workspace/skopeo-next`.
- V1 edits only safe static string `className` attributes automatically.
- Complex `className` expressions such as `cn(...)`, template strings, and conditionals are detected and reported as unsupported.
- Every edit must create a pending patch with a readable diff before file write.
- V1 Studio appears as a new right-panel tab named `Studio`; existing chat/design surfaces remain intact.
- Tests must cover parser transforms before browser UI work is considered done.

---

## File Structure

- Create `apps/web/client/src/server/api/routers/studio/index.ts`
  Owns tRPC procedures for resolving selected elements, previewing class patches, applying patches, and later component discovery.

- Modify `apps/web/client/src/server/api/root.ts`
  Registers `studio: studioRouter`.

- Modify `apps/web/client/src/server/api/routers/index.ts`
  Exports `studioRouter`.

- Create `packages/parser/src/skopeo-studio/source-map.ts`
  Finds JSX elements by `data-oid`, extracts metadata, returns static className editability.

- Create `packages/parser/src/skopeo-studio/class-patch.ts`
  Replaces safe static `className` values for one oid and returns updated source.

- Create `packages/parser/src/skopeo-studio/diff.ts`
  Generates compact unified diffs for patch preview.

- Create `packages/parser/src/skopeo-studio/index.ts`
  Public exports for Studio transform functions and types.

- Modify `packages/parser/src/index.ts`
  Exports `./skopeo-studio`.

- Create `packages/parser/test/skopeo-studio/source-map.test.ts`
  Unit tests for oid resolution and className metadata.

- Create `packages/parser/test/skopeo-studio/class-patch.test.ts`
  Unit tests for safe edits and unsupported expressions.

- Create `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/types.ts`
  Shared UI-side Studio types.

- Create `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/index.tsx`
  Studio tab container.

- Create `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/selection-summary.tsx`
  Shows selected element and source metadata.

- Create `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/class-editor.tsx`
  Simple class token editor and curated Tailwind controls.

- Create `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/patch-center.tsx`
  Shows pending patch diff and apply/discard controls.

- Modify `apps/web/client/src/app/project/[id]/_components/right-panel/index.tsx`
  Adds Chat/Studio segmented tabs and renders `StudioTab`.

- Create `apps/web/client/test/studio/studio-router.test.ts`
  Integration tests for local source resolve and patch preview/apply using a fixture project.

- Create `apps/web/client/test/studio/fixtures/skopeo-mini/src/components/Card.tsx`
  Fixture TSX file with static and complex className examples.

---

## Task 1: Parser Source Mapping

**Files:**
- Create: `packages/parser/src/skopeo-studio/source-map.ts`
- Create: `packages/parser/src/skopeo-studio/index.ts`
- Modify: `packages/parser/src/index.ts`
- Test: `packages/parser/test/skopeo-studio/source-map.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type StudioClassNameInfo =
      | { kind: 'static'; value: string }
      | { kind: 'missing'; value: null }
      | { kind: 'unsupported'; value: string; reason: string };

  export type StudioElementSource = {
      oid: string;
      filePath: string;
      tagName: string;
      componentName: string | null;
      line: number | null;
      column: number | null;
      className: StudioClassNameInfo;
  };

  export function resolveElementSourceFromFiles(
      files: Array<{ path: string; content: string }>,
      oid: string,
  ): StudioElementSource | null;
  ```
- Consumes existing `getAstFromContent`, `traverse`, and `EditorAttributes.DATA_ONLOOK_ID`.

- [ ] **Step 1: Write failing source-map tests**

Create `packages/parser/test/skopeo-studio/source-map.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { resolveElementSourceFromFiles } from '../../src/skopeo-studio';

const filePath = 'src/components/Card.tsx';

describe('resolveElementSourceFromFiles', () => {
    test('finds an element by data-oid and returns static className metadata', () => {
        const result = resolveElementSourceFromFiles(
            [
                {
                    path: filePath,
                    content: `
export function MediaCard() {
  return (
    <article data-oid="card-1" className="rounded-lg border bg-card p-4">
      <h2 data-oid="title-1" className="text-lg font-semibold">Dune</h2>
    </article>
  );
}
`,
                },
            ],
            'title-1',
        );

        expect(result).toEqual({
            oid: 'title-1',
            filePath,
            tagName: 'h2',
            componentName: 'MediaCard',
            line: expect.any(Number),
            column: expect.any(Number),
            className: { kind: 'static', value: 'text-lg font-semibold' },
        });
    });

    test('marks cn calls as unsupported', () => {
        const result = resolveElementSourceFromFiles(
            [
                {
                    path: filePath,
                    content: `
import { cn } from '@/lib/utils';
export function MediaCard({ active }: { active: boolean }) {
  return <article data-oid="card-1" className={cn("rounded-lg", active && "border-primary")} />;
}
`,
                },
            ],
            'card-1',
        );

        expect(result?.className.kind).toBe('unsupported');
        expect(result?.className.value).toContain('cn(');
    });

    test('returns null when oid is absent', () => {
        const result = resolveElementSourceFromFiles(
            [{ path: filePath, content: '<div data-oid="other" />' }],
            'missing',
        );

        expect(result).toBeNull();
    });
});
```

- [ ] **Step 2: Run the failing test**

Run: `bun test packages/parser/test/skopeo-studio/source-map.test.ts`

Expected: FAIL because `packages/parser/src/skopeo-studio` does not exist.

- [ ] **Step 3: Implement source mapping**

Create `packages/parser/src/skopeo-studio/source-map.ts`:

```ts
import { EditorAttributes } from '@onlook/constants';
import { getAstFromContent } from '../parse';
import type { NodePath, T } from '../packages';
import { generate, t, traverse } from '../packages';

export type StudioClassNameInfo =
    | { kind: 'static'; value: string }
    | { kind: 'missing'; value: null }
    | { kind: 'unsupported'; value: string; reason: string };

export type StudioElementSource = {
    oid: string;
    filePath: string;
    tagName: string;
    componentName: string | null;
    line: number | null;
    column: number | null;
    className: StudioClassNameInfo;
};

export function resolveElementSourceFromFiles(
    files: Array<{ path: string; content: string }>,
    oid: string,
): StudioElementSource | null {
    for (const file of files) {
        const match = resolveElementSourceInFile(file.path, file.content, oid);
        if (match) {
            return match;
        }
    }
    return null;
}

export function resolveElementSourceInFile(
    filePath: string,
    content: string,
    oid: string,
): StudioElementSource | null {
    const ast = getAstFromContent(content);
    if (!ast) {
        return null;
    }

    let result: StudioElementSource | null = null;

    traverse(ast, {
        JSXOpeningElement(path) {
            if (result) {
                path.stop();
                return;
            }

            const dataOid = getStringAttribute(path.node, EditorAttributes.DATA_ONLOOK_ID);
            if (dataOid !== oid) {
                return;
            }

            result = {
                oid,
                filePath,
                tagName: getTagName(path.node.name),
                componentName: findComponentName(path),
                line: path.node.loc?.start.line ?? null,
                column: path.node.loc?.start.column ?? null,
                className: getClassNameInfo(path.node),
            };
            path.stop();
        },
    });

    return result;
}

function getStringAttribute(node: T.JSXOpeningElement, name: string): string | null {
    const attr = node.attributes.find(
        (attribute) => t.isJSXAttribute(attribute) && attribute.name.name === name,
    );
    if (!attr || !t.isJSXAttribute(attr) || !attr.value || !t.isStringLiteral(attr.value)) {
        return null;
    }
    return attr.value.value;
}

function getClassNameInfo(node: T.JSXOpeningElement): StudioClassNameInfo {
    const attr = node.attributes.find(
        (attribute) => t.isJSXAttribute(attribute) && attribute.name.name === 'className',
    );

    if (!attr || !t.isJSXAttribute(attr) || !attr.value) {
        return { kind: 'missing', value: null };
    }

    if (t.isStringLiteral(attr.value)) {
        return { kind: 'static', value: attr.value.value };
    }

    return {
        kind: 'unsupported',
        value: generate(attr.value).code,
        reason: 'Only static string className values are supported in V1',
    };
}

function getTagName(name: T.JSXOpeningElement['name']): string {
    if (t.isJSXIdentifier(name)) {
        return name.name;
    }
    if (t.isJSXMemberExpression(name)) {
        return generate(name).code;
    }
    return 'unknown';
}

function findComponentName(path: NodePath<T.JSXOpeningElement>): string | null {
    const fn = path.findParent((parent) => {
        return (
            parent.isFunctionDeclaration() ||
            parent.isFunctionExpression() ||
            parent.isArrowFunctionExpression()
        );
    });

    if (!fn) {
        return null;
    }

    if (fn.isFunctionDeclaration() && fn.node.id?.name) {
        return fn.node.id.name;
    }

    const parent = fn.parentPath;
    if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
        return parent.node.id.name;
    }

    return null;
}
```

Create `packages/parser/src/skopeo-studio/index.ts`:

```ts
export * from './source-map';
```

Modify `packages/parser/src/index.ts`:

```ts
export * from './skopeo-studio';
```

- [ ] **Step 4: Run source-map test**

Run: `bun test packages/parser/test/skopeo-studio/source-map.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/parser/src/skopeo-studio packages/parser/src/index.ts packages/parser/test/skopeo-studio/source-map.test.ts
git commit -m "feat: add skopeo studio source mapping"
```

## Task 2: Parser Class Patch And Diff

**Files:**
- Create: `packages/parser/src/skopeo-studio/class-patch.ts`
- Create: `packages/parser/src/skopeo-studio/diff.ts`
- Modify: `packages/parser/src/skopeo-studio/index.ts`
- Test: `packages/parser/test/skopeo-studio/class-patch.test.ts`

**Interfaces:**
- Consumes: `StudioElementSource` from Task 1.
- Produces:
  ```ts
  export type StudioPatchPreview = {
      filePath: string;
      oid: string;
      before: string;
      after: string;
      diff: string;
  };

  export function previewClassNamePatchInFile(input: {
      filePath: string;
      content: string;
      oid: string;
      nextClassName: string;
  }): StudioPatchPreview;
  ```

- [ ] **Step 1: Write failing class patch tests**

Create `packages/parser/test/skopeo-studio/class-patch.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { previewClassNamePatchInFile } from '../../src/skopeo-studio';

describe('previewClassNamePatchInFile', () => {
    test('replaces a static className for one oid', () => {
        const content = `
export function Card() {
  return (
    <article data-oid="card-1" className="rounded-lg border bg-card p-4">
      <h2 data-oid="title-1" className="text-lg font-semibold">Dune</h2>
    </article>
  );
}
`;

        const patch = previewClassNamePatchInFile({
            filePath: 'src/components/Card.tsx',
            content,
            oid: 'title-1',
            nextClassName: 'text-2xl font-bold text-primary',
        });

        expect(patch.before).toContain('text-lg font-semibold');
        expect(patch.after).toContain('text-2xl font-bold text-primary');
        expect(patch.after).toContain('data-oid="card-1"');
        expect(patch.diff).toContain('-');
        expect(patch.diff).toContain('+');
    });

    test('throws for unsupported className expressions', () => {
        const content = `
export function Card({ active }: { active: boolean }) {
  return <article data-oid="card-1" className={active ? "border" : "rounded"} />;
}
`;

        expect(() =>
            previewClassNamePatchInFile({
                filePath: 'src/components/Card.tsx',
                content,
                oid: 'card-1',
                nextClassName: 'rounded-lg',
            }),
        ).toThrow('Only static string className values are supported');
    });

    test('throws when oid is missing', () => {
        expect(() =>
            previewClassNamePatchInFile({
                filePath: 'src/components/Card.tsx',
                content: '<div data-oid="other" className="p-4" />',
                oid: 'missing',
                nextClassName: 'p-6',
            }),
        ).toThrow('No JSX element found');
    });
});
```

- [ ] **Step 2: Run failing tests**

Run: `bun test packages/parser/test/skopeo-studio/class-patch.test.ts`

Expected: FAIL because `previewClassNamePatchInFile` is missing.

- [ ] **Step 3: Implement class patcher and diff**

Create `packages/parser/src/skopeo-studio/diff.ts`:

```ts
export function createUnifiedDiff(filePath: string, before: string, after: string): string {
    if (before === after) {
        return '';
    }

    const beforeLines = before.split('\n');
    const afterLines = after.split('\n');
    const lines = [`--- ${filePath}`, `+++ ${filePath}`];
    const max = Math.max(beforeLines.length, afterLines.length);

    for (let i = 0; i < max; i++) {
        const beforeLine = beforeLines[i];
        const afterLine = afterLines[i];
        if (beforeLine === afterLine) {
            continue;
        }
        if (beforeLine !== undefined) {
            lines.push(`-${beforeLine}`);
        }
        if (afterLine !== undefined) {
            lines.push(`+${afterLine}`);
        }
    }

    return lines.join('\n');
}
```

Create `packages/parser/src/skopeo-studio/class-patch.ts`:

```ts
import { EditorAttributes } from '@onlook/constants';
import { getAstFromContent } from '../parse';
import { generate, t, traverse } from '../packages';
import { createUnifiedDiff } from './diff';

export type StudioPatchPreview = {
    filePath: string;
    oid: string;
    before: string;
    after: string;
    diff: string;
};

export function previewClassNamePatchInFile(input: {
    filePath: string;
    content: string;
    oid: string;
    nextClassName: string;
}): StudioPatchPreview {
    const ast = getAstFromContent(input.content);
    if (!ast) {
        throw new Error(`Could not parse ${input.filePath}`);
    }

    let found = false;

    traverse(ast, {
        JSXOpeningElement(path) {
            const oid = getStringAttribute(path.node, EditorAttributes.DATA_ONLOOK_ID);
            if (oid !== input.oid) {
                return;
            }

            found = true;
            const attr = path.node.attributes.find(
                (attribute) =>
                    t.isJSXAttribute(attribute) && attribute.name.name === 'className',
            );

            if (!attr || !t.isJSXAttribute(attr)) {
                path.node.attributes.push(
                    t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(input.nextClassName)),
                );
                path.stop();
                return;
            }

            if (!attr.value || !t.isStringLiteral(attr.value)) {
                throw new Error('Only static string className values are supported in V1');
            }

            attr.value = t.stringLiteral(input.nextClassName);
            path.stop();
        },
    });

    if (!found) {
        throw new Error(`No JSX element found for oid ${input.oid}`);
    }

    const after = generate(ast).code;

    return {
        filePath: input.filePath,
        oid: input.oid,
        before: input.content,
        after,
        diff: createUnifiedDiff(input.filePath, input.content, after),
    };
}

function getStringAttribute(node: import('../packages').T.JSXOpeningElement, name: string): string | null {
    const attr = node.attributes.find(
        (attribute) => t.isJSXAttribute(attribute) && attribute.name.name === name,
    );
    if (!attr || !t.isJSXAttribute(attr) || !attr.value || !t.isStringLiteral(attr.value)) {
        return null;
    }
    return attr.value.value;
}
```

Modify `packages/parser/src/skopeo-studio/index.ts`:

```ts
export * from './class-patch';
export * from './diff';
export * from './source-map';
```

- [ ] **Step 4: Run parser tests**

Run: `bun test packages/parser/test/skopeo-studio`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add packages/parser/src/skopeo-studio packages/parser/test/skopeo-studio
git commit -m "feat: preview skopeo studio class patches"
```

## Task 3: Studio tRPC Router

**Files:**
- Create: `apps/web/client/src/server/api/routers/studio/index.ts`
- Modify: `apps/web/client/src/server/api/root.ts`
- Modify: `apps/web/client/src/server/api/routers/index.ts`
- Test: `apps/web/client/test/studio/studio-router.test.ts`
- Create: `apps/web/client/test/studio/fixtures/skopeo-mini/src/components/Card.tsx`

**Interfaces:**
- Consumes:
  - `resolveElementSourceFromFiles`
  - `previewClassNamePatchInFile`
  - `env.ONLOOK_LOCAL_PROJECT_ROOT`
- Produces tRPC procedures:
  ```ts
  studio.resolveElementSource({ sandboxId: string, oid: string })
  studio.previewClassPatch({ sandboxId: string, filePath: string, oid: string, nextClassName: string })
  studio.applyClassPatch({ sandboxId: string, filePath: string, oid: string, nextClassName: string })
  ```

- [ ] **Step 1: Write fixture**

Create `apps/web/client/test/studio/fixtures/skopeo-mini/src/components/Card.tsx`:

```tsx
export function Card() {
    return (
        <article data-oid="card-1" className="rounded-lg border bg-card p-4">
            <h2 data-oid="title-1" className="text-lg font-semibold">
                Dune
            </h2>
            <p data-oid="body-1" className={true ? 'text-sm' : 'text-xs'}>
                A desert planet.
            </p>
        </article>
    );
}
```

- [ ] **Step 2: Write integration tests**

Create `apps/web/client/test/studio/studio-router.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { previewClassNamePatchInFile, resolveElementSourceFromFiles } from '@onlook/parser';

const root = path.join(import.meta.dir, 'tmp-skopeo-mini');
const filePath = 'src/components/Card.tsx';
const absoluteFile = path.join(root, filePath);

const fixture = `export function Card() {
    return (
        <article data-oid="card-1" className="rounded-lg border bg-card p-4">
            <h2 data-oid="title-1" className="text-lg font-semibold">
                Dune
            </h2>
        </article>
    );
}
`;

describe('studio local transforms', () => {
    beforeEach(async () => {
        await mkdir(path.dirname(absoluteFile), { recursive: true });
        await writeFile(absoluteFile, fixture, 'utf8');
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    test('resolves an oid from local files', async () => {
        const content = await readFile(absoluteFile, 'utf8');
        const source = resolveElementSourceFromFiles([{ path: filePath, content }], 'title-1');
        expect(source?.filePath).toBe(filePath);
        expect(source?.className).toEqual({ kind: 'static', value: 'text-lg font-semibold' });
    });

    test('previews and writes class patch output', async () => {
        const content = await readFile(absoluteFile, 'utf8');
        const patch = previewClassNamePatchInFile({
            filePath,
            content,
            oid: 'title-1',
            nextClassName: 'text-2xl font-bold text-primary',
        });

        await writeFile(absoluteFile, patch.after, 'utf8');
        const updated = await readFile(absoluteFile, 'utf8');

        expect(updated).toContain('text-2xl font-bold text-primary');
        expect(patch.diff).toContain('text-lg font-semibold');
    });
});
```

These tests exercise the transform layer without booting Next. The tRPC router itself is validated by browser smoke tests in Task 7.

- [ ] **Step 3: Run tests**

Run: `bun test apps/web/client/test/studio/studio-router.test.ts`

Expected: PASS once Task 1 and Task 2 are complete.

- [ ] **Step 4: Implement router**

Create `apps/web/client/src/server/api/routers/studio/index.ts`:

```ts
import { env } from '@/env';
import { NodeFsProvider } from '@onlook/code-provider/providers/nodefs';
import {
    previewClassNamePatchInFile,
    resolveElementSourceFromFiles,
} from '@onlook/parser';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../../trpc';

const TEXT_EXTENSIONS = /\.(tsx|ts|jsx|js)$/;
const SEARCH_DIRS = ['src/components', 'src/views', 'src/app'];

export const studioRouter = createTRPCRouter({
    resolveElementSource: protectedProcedure
        .input(z.object({ sandboxId: z.string(), oid: z.string() }))
        .query(async ({ input }) => {
            ensureLocalSandbox(input.sandboxId);
            const files = await readSearchFiles();
            return resolveElementSourceFromFiles(files, input.oid);
        }),

    previewClassPatch: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
                filePath: z.string(),
                oid: z.string(),
                nextClassName: z.string(),
            }),
        )
        .mutation(async ({ input }) => {
            ensureLocalSandbox(input.sandboxId);
            const provider = await getLocalProvider();
            try {
                const { file } = await provider.readFile({ args: { path: input.filePath } });
                if (typeof file.content !== 'string') {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: `${input.filePath} is not a text file`,
                    });
                }
                return previewClassNamePatchInFile({
                    filePath: input.filePath,
                    content: file.content,
                    oid: input.oid,
                    nextClassName: input.nextClassName,
                });
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),

    applyClassPatch: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
                filePath: z.string(),
                oid: z.string(),
                nextClassName: z.string(),
            }),
        )
        .mutation(async ({ input }) => {
            ensureLocalSandbox(input.sandboxId);
            const provider = await getLocalProvider();
            try {
                const { file } = await provider.readFile({ args: { path: input.filePath } });
                if (typeof file.content !== 'string') {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: `${input.filePath} is not a text file`,
                    });
                }
                const patch = previewClassNamePatchInFile({
                    filePath: input.filePath,
                    content: file.content,
                    oid: input.oid,
                    nextClassName: input.nextClassName,
                });
                await provider.writeFile({
                    args: { path: input.filePath, content: patch.after, overwrite: true },
                });
                return { ...patch, status: 'applied' as const };
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
});

function ensureLocalSandbox(sandboxId: string) {
    if (!sandboxId.startsWith('local:')) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Skopeo Studio V1 only supports local projects',
        });
    }
}

async function getLocalProvider() {
    const provider = new NodeFsProvider({ rootDir: env.ONLOOK_LOCAL_PROJECT_ROOT });
    await provider.initialize({});
    return provider;
}

async function readSearchFiles() {
    const provider = await getLocalProvider();
    try {
        const files: Array<{ path: string; content: string }> = [];
        for (const dir of SEARCH_DIRS) {
            await collectTextFiles(provider, dir, files);
        }
        return files;
    } finally {
        await provider.destroy().catch(() => {});
    }
}

async function collectTextFiles(
    provider: NodeFsProvider,
    dir: string,
    files: Array<{ path: string; content: string }>,
) {
    let entries;
    try {
        entries = (await provider.listFiles({ args: { path: dir } })).files;
    } catch {
        return;
    }

    for (const entry of entries) {
        const childPath = `${dir}/${entry.name}`;
        if (entry.type === 'directory') {
            await collectTextFiles(provider, childPath, files);
            continue;
        }
        if (!TEXT_EXTENSIONS.test(entry.name)) {
            continue;
        }
        const { file } = await provider.readFile({ args: { path: childPath } });
        if (typeof file.content === 'string') {
            files.push({ path: childPath, content: file.content });
        }
    }
}
```

Modify `apps/web/client/src/server/api/routers/index.ts`:

```ts
export * from './studio';
```

Modify `apps/web/client/src/server/api/root.ts`:

```ts
import { studioRouter } from './routers';

export const appRouter = createTRPCRouter({
    studio: studioRouter,
    // existing routers...
});
```

- [ ] **Step 5: Run typecheck**

Run: `bun --filter @onlook/web-client typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/web/client/src/server/api/root.ts apps/web/client/src/server/api/routers/index.ts apps/web/client/src/server/api/routers/studio apps/web/client/test/studio
git commit -m "feat: add skopeo studio local api"
```

## Task 4: Right Panel Studio Tab Shell

**Files:**
- Modify: `apps/web/client/src/app/project/[id]/_components/right-panel/index.tsx`
- Create: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/types.ts`
- Create: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/index.tsx`
- Create: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/selection-summary.tsx`

**Interfaces:**
- Consumes: `editorEngine.elements.selected[0]`
- Consumes: active branch sandbox id from `editorEngine.branches.activeBranch`
- Consumes: `api.studio.resolveElementSource.useQuery`
- Produces: visible `Studio` tab with selected element/source state.

- [ ] **Step 1: Create UI types**

Create `types.ts`:

```ts
export type StudioPanelMode = 'chat' | 'studio';

export type StudioSelectedElementView = {
    oid: string | null;
    domId: string;
    tagName: string;
    text: string | null;
};
```

- [ ] **Step 2: Create selection summary**

Create `selection-summary.tsx`:

```tsx
import { Badge } from '@onlook/ui/badge';

export function SelectionSummary({
    oid,
    tagName,
    filePath,
    componentName,
    classNameValue,
    unsupportedReason,
}: {
    oid: string | null;
    tagName: string | null;
    filePath?: string;
    componentName?: string | null;
    classNameValue?: string | null;
    unsupportedReason?: string;
}) {
    if (!oid) {
        return (
            <div className="rounded-md border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                Select an element in the preview to inspect its Skopeo source.
            </div>
        );
    }

    return (
        <div className="space-y-3 rounded-md border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{componentName ?? tagName ?? 'Element'}</p>
                    <p className="truncate text-xs text-muted-foreground">{filePath ?? 'Source not found'}</p>
                </div>
                <Badge variant="secondary">{oid}</Badge>
            </div>
            {classNameValue !== undefined && (
                <pre className="max-h-28 overflow-auto rounded border border-border bg-muted/40 p-2 text-xs">
                    {classNameValue || 'No className'}
                </pre>
            )}
            {unsupportedReason && (
                <p className="text-xs text-amber-500">{unsupportedReason}</p>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Create Studio tab**

Create `index.tsx`:

```tsx
'use client';

import { useEditorEngine } from '@/components/store/editor';
import { api } from '@/trpc/react';
import { Icons } from '@onlook/ui/icons';
import { observer } from 'mobx-react-lite';
import { SelectionSummary } from './selection-summary';

export const StudioTab = observer(() => {
    const editorEngine = useEditorEngine();
    const selected = editorEngine.elements.selected[0];
    const branch = editorEngine.branches.activeBranch;
    const oid = selected?.instanceId ?? selected?.oid ?? null;
    const sandboxId = branch?.sandbox?.id;

    const source = api.studio.resolveElementSource.useQuery(
        { sandboxId: sandboxId ?? '', oid: oid ?? '' },
        { enabled: !!sandboxId && !!oid },
    );

    const className = source.data?.className;

    return (
        <div className="flex h-full flex-col gap-3 p-3">
            <div>
                <h2 className="text-sm font-semibold">Skopeo Studio</h2>
                <p className="text-xs text-muted-foreground">Inspect and patch local Skopeo UI.</p>
            </div>

            {source.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icons.LoadingSpinner className="h-4 w-4 animate-spin" />
                    Resolving source...
                </div>
            )}

            <SelectionSummary
                oid={oid}
                tagName={selected?.tagName ?? null}
                filePath={source.data?.filePath}
                componentName={source.data?.componentName}
                classNameValue={className?.value ?? undefined}
                unsupportedReason={className?.kind === 'unsupported' ? className.reason : undefined}
            />
        </div>
    );
});
```

- [ ] **Step 4: Add right-panel tab switch**

Modify `right-panel/index.tsx` to add local state:

```tsx
const [panelMode, setPanelMode] = useState<'chat' | 'studio'>('studio');
```

Replace the header label area with two buttons:

```tsx
<div className="flex items-center gap-1 p-1">
    <button
        className={cn('rounded px-2 py-1 text-xs', panelMode === 'studio' && 'bg-muted text-foreground')}
        onClick={() => setPanelMode('studio')}
    >
        Studio
    </button>
    <button
        className={cn('rounded px-2 py-1 text-xs', panelMode === 'chat' && 'bg-muted text-foreground')}
        onClick={() => setPanelMode('chat')}
    >
        Chat
    </button>
</div>
```

Render:

```tsx
{panelMode === 'studio' ? (
    <StudioTab />
) : currentConversation ? (
    <ChatTab conversationId={currentConversation.id} projectId={editorEngine.projectId} />
) : null}
```

Keep `ChatControls` visible only in chat mode.

- [ ] **Step 5: Run typecheck**

Run: `bun --filter @onlook/web-client typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/web/client/src/app/project/[id]/_components/right-panel
git commit -m "feat: add skopeo studio right panel"
```

## Task 5: Class Editor And Patch Center

**Files:**
- Create: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/class-editor.tsx`
- Create: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/patch-center.tsx`
- Modify: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/index.tsx`

**Interfaces:**
- Consumes: static className source from Task 4.
- Consumes:
  - `api.studio.previewClassPatch.useMutation`
  - `api.studio.applyClassPatch.useMutation`
- Produces: pending patch state in `StudioTab`.

- [ ] **Step 1: Create ClassEditor**

Create `class-editor.tsx`:

```tsx
import { Button } from '@onlook/ui/button';
import { Textarea } from '@onlook/ui/textarea';
import { useEffect, useState } from 'react';

export function ClassEditor({
    value,
    disabled,
    onPreview,
}: {
    value: string;
    disabled?: boolean;
    onPreview: (nextClassName: string) => void;
}) {
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Tailwind classes</p>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled || draft === value}
                    onClick={() => onPreview(draft)}
                >
                    Preview patch
                </Button>
            </div>
            <Textarea
                value={draft}
                disabled={disabled}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-28 resize-y font-mono text-xs"
            />
        </div>
    );
}
```

- [ ] **Step 2: Create PatchCenter**

Create `patch-center.tsx`:

```tsx
import { Button } from '@onlook/ui/button';

export type StudioPendingPatch = {
    filePath: string;
    oid: string;
    before: string;
    after: string;
    diff: string;
    nextClassName: string;
};

export function PatchCenter({
    patch,
    isApplying,
    onApply,
    onDiscard,
}: {
    patch: StudioPendingPatch | null;
    isApplying: boolean;
    onApply: () => void;
    onDiscard: () => void;
}) {
    if (!patch) {
        return (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No pending patch. Edit a class list and preview it here.
            </div>
        );
    }

    return (
        <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{patch.filePath}</p>
                    <p className="text-xs text-muted-foreground">oid {patch.oid}</p>
                </div>
                <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={onDiscard}>
                        Discard
                    </Button>
                    <Button size="sm" disabled={isApplying} onClick={onApply}>
                        Apply
                    </Button>
                </div>
            </div>
            <pre className="max-h-64 overflow-auto rounded border border-border bg-muted/40 p-2 text-xs">
                {patch.diff || 'No textual diff'}
            </pre>
        </div>
    );
}
```

- [ ] **Step 3: Wire mutations in StudioTab**

In `studio-tab/index.tsx`, add:

```tsx
const [pendingPatch, setPendingPatch] = useState<StudioPendingPatch | null>(null);
const previewPatch = api.studio.previewClassPatch.useMutation();
const applyPatch = api.studio.applyClassPatch.useMutation();

const handlePreview = async (nextClassName: string) => {
    if (!source.data || !sandboxId) return;
    const patch = await previewPatch.mutateAsync({
        sandboxId,
        filePath: source.data.filePath,
        oid: source.data.oid,
        nextClassName,
    });
    setPendingPatch({ ...patch, nextClassName });
};

const handleApply = async () => {
    if (!pendingPatch || !sandboxId) return;
    await applyPatch.mutateAsync({
        sandboxId,
        filePath: pendingPatch.filePath,
        oid: pendingPatch.oid,
        nextClassName: pendingPatch.nextClassName,
    });
    setPendingPatch(null);
    await source.refetch();
};
```

Render `ClassEditor` only when `className?.kind === 'static'`, and render `PatchCenter` below it.

- [ ] **Step 4: Run typecheck**

Run: `bun --filter @onlook/web-client typecheck`

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab
git commit -m "feat: add skopeo studio patch center"
```

## Task 6: Figma-Like Inspector Presets

**Files:**
- Modify: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/class-editor.tsx`
- Create: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/tailwind-controls.ts`
- Create: `apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/tailwind-controls.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function replaceTailwindGroup(className: string, group: TailwindGroup, nextToken: string): string;
  export type TailwindGroup = 'padding' | 'gap' | 'radius' | 'shadow' | 'textSize' | 'fontWeight' | 'background';
  ```
- Consumes: plain className string from `ClassEditor`.

- [ ] **Step 1: Write Tailwind control tests**

Create `tailwind-controls.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { replaceTailwindGroup } from './tailwind-controls';

describe('replaceTailwindGroup', () => {
    test('replaces padding tokens', () => {
        expect(replaceTailwindGroup('rounded-lg p-4 bg-card', 'padding', 'p-6')).toBe(
            'rounded-lg bg-card p-6',
        );
    });

    test('adds missing radius token', () => {
        expect(replaceTailwindGroup('border bg-card', 'radius', 'rounded-xl')).toBe(
            'border bg-card rounded-xl',
        );
    });
});
```

- [ ] **Step 2: Implement token replacement helper**

Create `tailwind-controls.ts`:

```ts
import { customTwMerge } from '@onlook/utility';

export type TailwindGroup =
    | 'padding'
    | 'gap'
    | 'radius'
    | 'shadow'
    | 'textSize'
    | 'fontWeight'
    | 'background';

const GROUP_PATTERNS: Record<TailwindGroup, RegExp> = {
    padding: /^(p|px|py|pt|pr|pb|pl)-/,
    gap: /^gap-/,
    radius: /^rounded/,
    shadow: /^shadow/,
    textSize: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,
    fontWeight: /^font-/,
    background: /^bg-/,
};

export function replaceTailwindGroup(
    className: string,
    group: TailwindGroup,
    nextToken: string,
): string {
    const pattern = GROUP_PATTERNS[group];
    const kept = className
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => !pattern.test(token));
    return customTwMerge([...kept, nextToken].join(' '));
}
```

- [ ] **Step 3: Add preset controls to ClassEditor**

In `class-editor.tsx`, add small button groups:

```tsx
const presets = [
    { group: 'padding', label: 'P4', token: 'p-4' },
    { group: 'padding', label: 'P6', token: 'p-6' },
    { group: 'gap', label: 'Gap 3', token: 'gap-3' },
    { group: 'radius', label: 'R lg', token: 'rounded-lg' },
    { group: 'radius', label: 'R xl', token: 'rounded-xl' },
    { group: 'shadow', label: 'Shadow', token: 'shadow-lg' },
] as const;
```

On button click:

```tsx
setDraft((current) => replaceTailwindGroup(current, preset.group, preset.token));
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
bun test "apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab/tailwind-controls.test.ts"
bun --filter @onlook/web-client typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add apps/web/client/src/app/project/[id]/_components/right-panel/studio-tab
git commit -m "feat: add skopeo studio class presets"
```

## Task 7: Browser Smoke Verification

**Files:**
- No product files unless defects appear.
- Optional create: `apps/web/client/test/studio/smoke-local-studio.js`

**Interfaces:**
- Consumes running Docker Onlook at `http://localhost:3000`.
- Consumes Skopeo preview at `http://localhost:3001`.
- Produces manual/browser evidence for V1.

- [ ] **Step 1: Rebuild Docker**

Run:

```bash
docker compose build web-client
docker compose up -d --no-build --force-recreate web-client
```

Expected: image builds and `web-client` starts.

- [ ] **Step 2: Verify ports**

Run:

```powershell
Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing -TimeoutSec 20
Invoke-WebRequest -Uri http://localhost:3001 -UseBasicParsing -TimeoutSec 20
```

Expected: both return HTTP 200.

- [ ] **Step 3: Run browser smoke script**

Use Playwright with local Chrome:

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.getByText('DEV MODE: Sign in as demo user').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.goto('http://localhost:3000/projects/import/local', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=file]').setInputFiles('D:/Development/Skopeo/SkopeoAPP/Next');
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await page.waitForURL(/\\/project\\//, { timeout: 90000 });
  await page.getByText('Studio').waitFor({ timeout: 60000 });
  console.log(page.url());
  await browser.close();
})();
```

Expected: reaches `/project/<id>` and sees the `Studio` tab.

- [ ] **Step 4: Manual V1 interaction check**

In browser:

1. Open `http://localhost:3000`.
2. Dev login.
3. Open/import Skopeo local project.
4. Select an element with a visible overlay.
5. Open `Studio`.
6. Confirm source file and className show.
7. Change a safe class string.
8. Preview patch.
9. Apply patch.
10. Confirm the target TSX file changed and preview still runs.

- [ ] **Step 5: Commit verification script if created**

```bash
git add apps/web/client/test/studio/smoke-local-studio.js
git commit -m "test: add skopeo studio smoke check"
```

## V2 Plan Stub: Component Catalog And Lab

Do not start V2 until V1 browser smoke passes.

V2 tasks:

1. Add `studio.listComponents` using parser export discovery for `src/components`, `src/views`, and `src/components/ui`.
2. Add `ComponentCatalog` tab in Studio with search and component metadata.
3. Generate `/__skopeo-studio/component/<componentId>` preview route in SkopeoAPP/Next.
4. Add mock prop registry for core Skopeo components: `MediaCard`, `PageHeader`, `AppLayout`, `StatCard`, `DiscoverySection`.
5. Reuse V1 inspector and patch center against selected DOM inside component preview.

## V3 Plan Stub: Figma Import And Compare

Do not start V3 until V2 component preview can load at least three Skopeo components.

V3 tasks:

1. Add manual Figma reference import panel for PNG/SVG/JSON.
2. Store references under `.onlook/skopeo-studio/figma-references`.
3. Attach references to components in the Component Lab.
4. Add side-by-side compare view.
5. Add draft generation only after reference compare is stable.

## Self-Review Checklist

- Spec coverage: V1 source mapping, patch preview/apply, Studio tab, safe className scope, and verification are covered.
- Placeholder scan: no task contains TBD/TODO/fill-in instructions.
- Type consistency: router method names match UI calls: `resolveElementSource`, `previewClassPatch`, `applyClassPatch`.
- Scope control: V2 and V3 are intentionally stubs gated behind V1 verification.
