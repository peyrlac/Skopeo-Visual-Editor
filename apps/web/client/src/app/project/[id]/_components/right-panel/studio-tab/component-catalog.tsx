'use client';

import { api } from '@/trpc/react';
import { Badge } from '@onlook/ui/badge';
import { Input } from '@onlook/ui/input';
import { useState } from 'react';

export type StudioComponentListItem = {
    id: string;
    name: string;
    filePath: string;
    folder: 'components' | 'views' | 'ui' | 'app' | 'other';
    importPath?: string;
    propTypeName?: string | null;
    usesClassName?: boolean;
};

export function filterStudioComponents(
    components: StudioComponentListItem[],
    query: string,
): StudioComponentListItem[] {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = normalizedQuery
        ? components.filter((component) =>
              [component.name, component.filePath, component.importPath]
                  .filter(Boolean)
                  .some((value) => value?.toLowerCase().includes(normalizedQuery)),
          )
        : components;

    return [...matches].sort((a, b) => {
        if (a.folder === 'ui' && b.folder !== 'ui') {
            return 1;
        }
        if (a.folder !== 'ui' && b.folder === 'ui') {
            return -1;
        }
        return 0;
    });
}

export function ComponentCatalog({ sandboxId }: { sandboxId?: string }) {
    const [query, setQuery] = useState('');
    const components = api.studio.listComponents.useQuery(
        { sandboxId: sandboxId ?? '' },
        { enabled: Boolean(sandboxId) },
    );
    const filteredComponents = filterStudioComponents(components.data ?? [], query);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
            <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search components"
                className="h-8 text-xs"
            />

            <div className="text-xs text-muted-foreground">
                {components.isLoading
                    ? 'Loading components...'
                    : `${filteredComponents.length} component${filteredComponents.length === 1 ? '' : 's'}`}
            </div>

            {components.isError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                    {components.error.message}
                </div>
            )}

            {!sandboxId && (
                <div className="text-xs text-muted-foreground">Select a local project to browse components.</div>
            )}

            <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
                {filteredComponents.map((component) => (
                    <div key={component.id} className="border-b pb-2 last:border-b-0">
                        <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">{component.name}</span>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                                {component.folder}
                            </Badge>
                        </div>
                        <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                            {component.filePath}
                        </div>
                        {component.importPath && (
                            <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                                {component.importPath}
                            </div>
                        )}
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                            <span>{component.propTypeName ?? 'No typed props'}</span>
                            <span aria-hidden="true">|</span>
                            <span>{component.usesClassName ? 'className supported' : 'No className'}</span>
                        </div>
                    </div>
                ))}

                {!components.isLoading && sandboxId && filteredComponents.length === 0 && (
                    <div className="text-xs text-muted-foreground">No matching components.</div>
                )}
            </div>
        </div>
    );
}
