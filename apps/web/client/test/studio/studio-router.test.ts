import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.env.SKIP_ENV_VALIDATION = 'true';

const root = path.join(import.meta.dir, 'tmp-skopeo-mini');
const filePath = 'src/components/Card.tsx';
const absoluteFile = path.join(root, filePath);
const packageFile = path.join(root, 'package.json');
const referencesFile = path.join(root, '.onlook', 'skopeo-studio', 'figma-references.json');

const fixture = `export function Card() {
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

export function MediaCard() {
    return <article>Media card</article>;
}

export default function DashboardPage() {
    return <main>Dashboard</main>;
}
`;

describe('studio router', () => {
    beforeEach(async () => {
        process.env.ONLOOK_LOCAL_PROJECT_ROOT = root;
        await mkdir(path.dirname(absoluteFile), { recursive: true });
        await writeFile(absoluteFile, fixture, 'utf8');
        await writeFile(packageFile, '{"name":"skopeo-mini"}\n', 'utf8');
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    test('resolves an oid from local files through tRPC', async () => {
        const caller = await createStudioCaller();

        const source = await caller.studio.resolveElementSource({
            sandboxId: 'local:test',
            oid: 'title-1',
        });

        expect(source?.filePath).toBe(filePath);
        expect(source?.className).toEqual({ kind: 'static', value: 'text-lg font-semibold' });
    }, 15000);

    test('previews a class patch through tRPC', async () => {
        const caller = await createStudioCaller();

        const patch = await caller.studio.previewClassPatch({
            sandboxId: 'local:test',
            filePath,
            oid: 'title-1',
            nextClassName: 'text-2xl font-bold text-primary',
        });

        expect(patch.after).toContain('text-2xl font-bold text-primary');
        expect(patch.diff).toContain('text-lg font-semibold');
        expect(await readFile(absoluteFile, 'utf8')).toBe(fixture);
    });

    test('applies a class patch through tRPC', async () => {
        const caller = await createStudioCaller();

        const patch = await caller.studio.applyClassPatch({
            sandboxId: 'local:test',
            filePath,
            oid: 'title-1',
            nextClassName: 'text-2xl font-bold text-primary',
        });

        const updated = await readFile(absoluteFile, 'utf8');
        expect(patch.status).toBe('applied');
        expect(updated).toContain('text-2xl font-bold text-primary');
        expect(updated).not.toContain('text-lg font-semibold');
    });

    test('lists Skopeo components from the local project', async () => {
        const caller = await createStudioCaller();
        const components = await caller.studio.listComponents({ sandboxId: 'local:test' });

        expect(components.some((component) => component.name === 'MediaCard')).toBe(true);
        expect(components.some((component) => component.name === 'DashboardPage')).toBe(true);
    });

    test('saves and lists manual Figma references locally', async () => {
        const caller = await createStudioCaller();
        const saved = await caller.studio.saveReference({
            sandboxId: 'local:test',
            reference: {
                title: 'Media card Figma',
                kind: 'figma-json',
                componentId: 'src/components/MediaCard.tsx:MediaCard',
                content: '{"name":"Media card"}',
                notes: 'Match spacing and poster ratio.',
            },
        });

        const references = await caller.studio.listReferences({ sandboxId: 'local:test' });
        expect(references.some((reference) => reference.id === saved.id)).toBe(true);
        expect(JSON.parse(await readFile(referencesFile, 'utf8'))).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: saved.id })]),
        );

        await caller.studio.deleteReference({ sandboxId: 'local:test', id: saved.id });
        expect(await caller.studio.listReferences({ sandboxId: 'local:test' })).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: saved.id })]),
        );
    });

    test('rejects malformed local reference data', async () => {
        const caller = await createStudioCaller();
        await mkdir(path.dirname(referencesFile), { recursive: true });
        await writeFile(referencesFile, '{not valid json', 'utf8');

        await expect(caller.studio.listReferences({ sandboxId: 'local:test' })).rejects.toThrow();
    });

    test('does not create a reference file when deleting an unknown reference', async () => {
        const caller = await createStudioCaller();

        await caller.studio.deleteReference({ sandboxId: 'local:test', id: 'unknown' });

        await expect(readFile(referencesFile, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    });

    test('rejects a non-local sandbox through tRPC', async () => {
        const caller = await createStudioCaller();

        await expect(
            caller.studio.resolveElementSource({
                sandboxId: 'remote:test',
                oid: 'title-1',
            }),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    test('rejects new studio procedures for non-local sandboxes', async () => {
        const caller = await createStudioCaller();

        await expect(caller.studio.listComponents({ sandboxId: 'remote:test' })).rejects.toMatchObject({
            code: 'BAD_REQUEST',
        });
        await expect(caller.studio.listReferences({ sandboxId: 'remote:test' })).rejects.toMatchObject({
            code: 'BAD_REQUEST',
        });
        await expect(
            caller.studio.saveReference({
                sandboxId: 'remote:test',
                reference: {
                    title: 'Media card Figma',
                    kind: 'figma-json',
                    componentId: 'src/components/MediaCard.tsx:MediaCard',
                    content: '{"name":"Media card"}',
                    notes: 'Match spacing and poster ratio.',
                },
            }),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        await expect(
            caller.studio.deleteReference({ sandboxId: 'remote:test', id: 'reference-1' }),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    test('rejects class patches outside the V1 source roots', async () => {
        const caller = await createStudioCaller();

        await expect(
            caller.studio.previewClassPatch({
                sandboxId: 'local:test',
                filePath: 'package.json',
                oid: 'title-1',
                nextClassName: 'text-2xl',
            }),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
});

async function createStudioCaller() {
    const { appRouter } = await import('~/server/api/root');
    return appRouter.createCaller({
        db: {},
        headers: new Headers(),
        supabase: {},
        user: {
            id: 'user-1',
            email: 'user@example.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        },
    });
}
