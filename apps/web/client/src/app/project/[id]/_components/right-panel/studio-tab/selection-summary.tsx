import { Badge } from '@onlook/ui/badge';

export function SelectionSummary({
    oid,
    tagName,
    filePath,
    componentName,
    classNameValue,
    unsupportedReason,
}: {
    oid: string | null;
    tagName: string | null;
    filePath?: string;
    componentName?: string | null;
    classNameValue?: string | null;
    unsupportedReason?: string;
}) {
    if (!oid) {
        return (
            <div className="rounded-md border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                Select an element in the preview to inspect its Skopeo source.
            </div>
        );
    }

    return (
        <div className="space-y-3 rounded-md border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                        {componentName ?? tagName ?? 'Element'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                        {filePath ?? 'Source not found'}
                    </p>
                </div>
                <Badge variant="secondary">{oid}</Badge>
            </div>
            {classNameValue !== undefined && (
                <pre className="max-h-28 overflow-auto rounded border border-border bg-muted/40 p-2 text-xs">
                    {classNameValue || 'No className'}
                </pre>
            )}
            {unsupportedReason && (
                <p className="text-xs text-amber-500">{unsupportedReason}</p>
            )}
        </div>
    );
}
