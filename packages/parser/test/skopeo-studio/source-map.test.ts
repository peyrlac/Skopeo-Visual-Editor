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
