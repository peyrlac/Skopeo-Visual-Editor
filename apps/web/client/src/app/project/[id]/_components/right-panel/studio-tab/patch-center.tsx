import { Button } from '@onlook/ui/button';

export type StudioPendingPatch = {
    filePath: string;
    oid: string;
    before: string;
    after: string;
    diff: string;
    nextClassName: string;
};

export function PatchCenter({
    patch,
    isApplying,
    onApply,
    onDiscard,
}: {
    patch: StudioPendingPatch | null;
    isApplying: boolean;
    onApply: () => void;
    onDiscard: () => void;
}) {
    if (!patch) {
        return (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No pending patch. Edit a class list and preview it here.
            </div>
        );
    }

    return (
        <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{patch.filePath}</p>
                    <p className="text-xs text-muted-foreground">oid {patch.oid}</p>
                </div>
                <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={isApplying} onClick={onDiscard}>
                        Discard
                    </Button>
                    <Button size="sm" disabled={isApplying} onClick={onApply}>
                        Apply
                    </Button>
                </div>
            </div>
            <pre className="max-h-64 overflow-auto rounded border border-border bg-muted/40 p-2 text-xs">
                {patch.diff || 'No textual diff'}
            </pre>
        </div>
    );
}
