import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

describe('right panel tabs', () => {
    test('keeps the chat tab switch separate from the chat dropdown trigger', async () => {
        const source = await readFile(path.join(import.meta.dir, 'index.tsx'), 'utf8');

        expect(source).not.toMatch(
            /<ChatPanelDropdown[\s\S]*>\s*<button[\s\S]*>\s*<Icons\.Sparkles[\s\S]*Chat[\s\S]*<\/button>\s*<\/ChatPanelDropdown>/,
        );
    });
});
