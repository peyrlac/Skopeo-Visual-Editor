'use client';

import { api } from '@/trpc/react';
import { Button } from '@onlook/ui/button';
import { Input } from '@onlook/ui/input';
import { Textarea } from '@onlook/ui/textarea';
import { useMemo, useState } from 'react';

const referenceKinds = ['figma-json', 'svg', 'image-note', 'notes'] as const;
type ReferenceKind = (typeof referenceKinds)[number];

type ReferenceDraft = {
    title: string;
    kind: ReferenceKind;
    componentId: string;
    notes: string;
    content: string;
};

const emptyDraft: ReferenceDraft = {
    title: '',
    kind: 'figma-json',
    componentId: '',
    notes: '',
    content: '',
};

export function ReferencePanel({ sandboxId }: { sandboxId?: string }) {
    const [draft, setDraft] = useState<ReferenceDraft>(emptyDraft);
    const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
    const components = api.studio.listComponents.useQuery(
        { sandboxId: sandboxId ?? '' },
        { enabled: Boolean(sandboxId) },
    );
    const references = api.studio.listReferences.useQuery(
        { sandboxId: sandboxId ?? '' },
        { enabled: Boolean(sandboxId) },
    );
    const saveReference = api.studio.saveReference.useMutation();
    const deleteReference = api.studio.deleteReference.useMutation();
    const selectedReference =
        references.data?.find((reference) => reference.id === selectedReferenceId) ?? null;
    const selectedComponent = useMemo(
        () =>
            components.data?.find(
                (component) => component.id === selectedReference?.componentId,
            ) ?? null,
        [components.data, selectedReference?.componentId],
    );

    const updateDraft = <Key extends keyof ReferenceDraft>(key: Key, value: ReferenceDraft[Key]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!sandboxId) {
            return;
        }

        const reference = await saveReference.mutateAsync({ sandboxId, reference: draft });
        setDraft(emptyDraft);
        setSelectedReferenceId(reference.id);
        await references.refetch();
    };

    const handleDelete = async (id: string) => {
        if (!sandboxId) {
            return;
        }

        await deleteReference.mutateAsync({ sandboxId, id });
        if (selectedReferenceId === id) {
            setSelectedReferenceId(null);
        }
        await references.refetch();
    };

    if (!sandboxId) {
        return (
            <div className="text-xs text-muted-foreground">
                Select a local project to manage references.
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            <form className="space-y-2" onSubmit={handleSave}>
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        value={draft.title}
                        onChange={(event) => updateDraft('title', event.target.value)}
                        placeholder="Reference title"
                        className="h-8 text-xs"
                        required
                    />
                    <select
                        value={draft.kind}
                        onChange={(event) => updateDraft('kind', event.target.value as ReferenceKind)}
                        className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                    >
                        {referenceKinds.map((kind) => (
                            <option key={kind} value={kind}>
                                {kind}
                            </option>
                        ))}
                    </select>
                </div>
                <select
                    value={draft.componentId}
                    onChange={(event) => updateDraft('componentId', event.target.value)}
                    className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
                    required
                >
                    <option value="">Attach to component</option>
                    {(components.data ?? []).map((component) => (
                        <option key={component.id} value={component.id}>
                            {component.name} - {component.filePath}
                        </option>
                    ))}
                </select>
                <Textarea
                    value={draft.notes}
                    onChange={(event) => updateDraft('notes', event.target.value)}
                    placeholder="Notes"
                    className="min-h-16 resize-y text-xs"
                />
                <Textarea
                    value={draft.content}
                    onChange={(event) => updateDraft('content', event.target.value)}
                    placeholder="Paste Figma JSON, SVG, image URL, or notes"
                    className="min-h-24 resize-y font-mono text-xs"
                />
                <Button size="sm" type="submit" disabled={saveReference.isPending}>
                    {saveReference.isPending ? 'Saving...' : 'Save reference'}
                </Button>
            </form>

            {(components.isError || references.isError || saveReference.isError || deleteReference.isError) && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                    {components.error?.message ??
                        references.error?.message ??
                        saveReference.error?.message ??
                        deleteReference.error?.message}
                </div>
            )}

            <div className="min-h-0 space-y-1">
                <div className="text-xs font-medium text-muted-foreground">References</div>
                {references.isLoading && (
                    <div className="text-xs text-muted-foreground">Loading references...</div>
                )}
                {references.data?.map((reference) => (
                    <div
                        key={reference.id}
                        className={`flex items-start justify-between gap-2 border-b py-2 ${
                            selectedReferenceId === reference.id ? 'bg-muted/50' : ''
                        }`}
                    >
                        <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setSelectedReferenceId(reference.id)}
                        >
                            <div className="truncate text-xs font-medium">{reference.title}</div>
                            <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                {reference.kind} | {reference.componentId}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                                {new Date(reference.createdAt).toLocaleDateString()}
                            </div>
                        </button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive"
                            disabled={deleteReference.isPending}
                            onClick={() => handleDelete(reference.id)}
                        >
                            Delete
                        </Button>
                    </div>
                ))}
                {!references.isLoading && references.data?.length === 0 && (
                    <div className="text-xs text-muted-foreground">No references yet.</div>
                )}
            </div>

            {selectedReference && (
                <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                    <div className="min-w-0 space-y-1">
                        <div className="font-medium">Component</div>
                        {selectedComponent ? (
                            <>
                                <div className="truncate">{selectedComponent.name}</div>
                                <div className="truncate font-mono text-[11px] text-muted-foreground">
                                    {selectedComponent.id}
                                </div>
                                <div className="truncate font-mono text-[11px] text-muted-foreground">
                                    {selectedComponent.filePath}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    {selectedComponent.propTypeName ?? 'No typed props'}
                                </div>
                            </>
                        ) : (
                            <div className="font-mono text-[11px] text-muted-foreground">
                                {selectedReference.componentId}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 space-y-1">
                        <div className="font-medium">Reference</div>
                        {selectedReference.notes && (
                            <div className="whitespace-pre-wrap text-muted-foreground">
                                {selectedReference.notes}
                            </div>
                        )}
                        <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words border bg-muted/30 p-2 font-mono text-[11px]">
                            {selectedReference.content || 'No content'}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}
