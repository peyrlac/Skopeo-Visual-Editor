import { Button } from '@onlook/ui/button';
import { Textarea } from '@onlook/ui/textarea';
import { useEffect, useState } from 'react';

export function ClassEditor({
    value,
    disabled,
    onPreview,
}: {
    value: string;
    disabled?: boolean;
    onPreview: (nextClassName: string) => void;
}) {
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Tailwind classes</p>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled || draft === value}
                    onClick={() => onPreview(draft)}
                >
                    Preview patch
                </Button>
            </div>
            <Textarea
                value={draft}
                disabled={disabled}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-28 resize-y font-mono text-xs"
            />
        </div>
    );
}
