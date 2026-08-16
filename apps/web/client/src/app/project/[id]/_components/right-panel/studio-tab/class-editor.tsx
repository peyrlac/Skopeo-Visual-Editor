import { Button } from '@onlook/ui/button';
import { Textarea } from '@onlook/ui/textarea';
import { useEffect, useState } from 'react';
import { replaceTailwindGroup } from './tailwind-controls';

const presets = [
    { group: 'padding', label: 'P4', token: 'p-4' },
    { group: 'padding', label: 'P6', token: 'p-6' },
    { group: 'gap', label: 'Gap 3', token: 'gap-3' },
    { group: 'radius', label: 'R lg', token: 'rounded-lg' },
    { group: 'radius', label: 'R xl', token: 'rounded-xl' },
    { group: 'shadow', label: 'Shadow', token: 'shadow-lg' },
] as const;

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
            <div className="flex flex-wrap gap-1">
                {presets.map((preset) => (
                    <Button
                        key={`${preset.group}-${preset.token}`}
                        size="sm"
                        variant="outline"
                        disabled={disabled}
                        onClick={() =>
                            setDraft((current) =>
                                replaceTailwindGroup(current, preset.group, preset.token),
                            )
                        }
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
