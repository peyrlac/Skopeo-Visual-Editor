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
