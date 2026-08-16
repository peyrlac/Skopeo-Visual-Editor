import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const studioTabDir = import.meta.dir;

describe('studio tab patch editor', () => {
    test('wires the class editor to preview/apply class patch mutations', async () => {
        const indexSource = await readFile(path.join(studioTabDir, 'index.tsx'), 'utf8');
        const classEditorSource = await readFile(path.join(studioTabDir, 'class-editor.tsx'), 'utf8');
        const patchCenterSource = await readFile(path.join(studioTabDir, 'patch-center.tsx'), 'utf8');

        expect(classEditorSource).toContain('onPreview(draft)');
        expect(classEditorSource).toContain('disabled={disabled || draft === value}');
        expect(patchCenterSource).toContain('export type StudioPendingPatch');
        expect(patchCenterSource).toContain('onApply');
        expect(patchCenterSource).toContain('onDiscard');

        expect(indexSource).toContain('api.studio.previewClassPatch.useMutation()');
        expect(indexSource).toContain('api.studio.applyClassPatch.useMutation()');
        expect(indexSource).toContain("className?.kind === 'static'");
        expect(indexSource).toContain('setPendingPatch(null)');
        expect(indexSource).toContain('await source.refetch()');
    });

    test('guards preview responses against stale selection source or sandbox context', async () => {
        const indexSource = await readFile(path.join(studioTabDir, 'index.tsx'), 'utf8');

        expect(indexSource).toContain('previewContextRef');
        expect(indexSource).toContain('previewRequestIdRef');
        expect(indexSource).toContain('previewContextRef.current');
        expect(indexSource).toContain('requestId !== previewRequestIdRef.current');
    });
});
