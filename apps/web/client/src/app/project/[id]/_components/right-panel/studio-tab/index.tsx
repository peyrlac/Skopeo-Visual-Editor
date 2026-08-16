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
                <p className="text-xs text-muted-foreground">
                    Inspect and patch local Skopeo UI.
                </p>
            </div>

            {source.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icons.LoadingSpinner className="h-4 w-4 animate-spin" />
                    Resolving source...
                </div>
            )}

            {source.isError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {source.error.message}
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
