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
