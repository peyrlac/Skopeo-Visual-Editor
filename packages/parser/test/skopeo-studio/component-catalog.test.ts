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
            {
                path: 'src/components/ui/button.tsx',
                content: 'export function Button() { return <button />; }',
            },
        ]);

        expect(components.map((component) => component.name)).toEqual(['Button']);
        expect(components[0]?.folder).toBe('ui');
    });
});
