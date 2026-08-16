import { describe, expect, test } from 'bun:test';
import { filterStudioComponents } from './component-catalog';

const components = [
    { id: '1', name: 'MediaCard', filePath: 'src/components/MediaCard.tsx', folder: 'components' },
    { id: '2', name: 'DashboardPage', filePath: 'src/views/DashboardPage.tsx', folder: 'views' },
    { id: '3', name: 'Button', filePath: 'src/components/ui/button.tsx', folder: 'ui' },
] as const;

describe('filterStudioComponents', () => {
    test('matches by component name and path case-insensitively', () => {
        expect(filterStudioComponents([...components], 'media').map((item) => item.name)).toEqual([
            'MediaCard',
        ]);
        expect(filterStudioComponents([...components], 'views').map((item) => item.name)).toEqual([
            'DashboardPage',
        ]);
    });

    test('sorts ui components after app components when query is empty', () => {
        expect(filterStudioComponents([...components], '').map((item) => item.name)).toEqual([
            'MediaCard',
            'DashboardPage',
            'Button',
        ]);
    });
});
