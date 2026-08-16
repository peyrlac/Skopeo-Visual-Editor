'use client';

import { useEditorEngine } from '@/components/store/editor';
import { api } from '@/trpc/react';
import { Icons } from '@onlook/ui/icons';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { ClassEditor } from './class-editor';
import { PatchCenter, type StudioPendingPatch } from './patch-center';
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
    const previewContextKey =
        sandboxId && source.data
            ? [sandboxId, oid, source.data.filePath, source.data.oid, className?.value ?? ''].join('\0')
            : null;
    const [pendingPatch, setPendingPatch] = useState<StudioPendingPatch | null>(null);
    const previewContextRef = useRef<string | null>(previewContextKey);
    const previewRequestIdRef = useRef(0);
    previewContextRef.current = previewContextKey;
    const previewPatch = api.studio.previewClassPatch.useMutation();
    const applyPatch = api.studio.applyClassPatch.useMutation();

    useEffect(() => {
        previewContextRef.current = previewContextKey;
        previewRequestIdRef.current += 1;
        setPendingPatch(null);
        previewPatch.reset();
        applyPatch.reset();
    }, [previewContextKey]);

    const handlePreview = async (nextClassName: string) => {
        if (!source.data || !sandboxId || !previewContextKey) {
            return;
        }

        const requestId = previewRequestIdRef.current + 1;
        previewRequestIdRef.current = requestId;
        const requestContextKey = previewContextKey;
        const patch = await previewPatch.mutateAsync({
            sandboxId,
            filePath: source.data.filePath,
            oid: source.data.oid,
            nextClassName,
        });
        if (
            requestId !== previewRequestIdRef.current ||
            requestContextKey !== previewContextRef.current
        ) {
            return;
        }

        setPendingPatch({ ...patch, nextClassName });
    };

    const handleApply = async () => {
        if (!pendingPatch || !sandboxId) {
            return;
        }

        await applyPatch.mutateAsync({
            sandboxId,
            filePath: pendingPatch.filePath,
            oid: pendingPatch.oid,
            nextClassName: pendingPatch.nextClassName,
        });
        setPendingPatch(null);
        await source.refetch();
    };

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

            {className?.kind === 'static' && (
                <>
                    <ClassEditor
                        value={className.value}
                        disabled={source.isFetching || previewPatch.isPending || applyPatch.isPending}
                        onPreview={handlePreview}
                    />

                    {previewPatch.isError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {previewPatch.error.message}
                        </div>
                    )}

                    <PatchCenter
                        patch={pendingPatch}
                        isApplying={applyPatch.isPending}
                        onApply={handleApply}
                        onDiscard={() => {
                            setPendingPatch(null);
                            applyPatch.reset();
                        }}
                    />

                    {applyPatch.isError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {applyPatch.error.message}
                        </div>
                    )}
                </>
            )}
        </div>
    );
});
