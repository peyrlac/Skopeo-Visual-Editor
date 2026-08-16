import { customTwMerge } from '@onlook/utility';

export type TailwindGroup =
    | 'padding'
    | 'gap'
    | 'radius'
    | 'shadow'
    | 'textSize'
    | 'fontWeight'
    | 'background';

const GROUP_PATTERNS: Record<TailwindGroup, RegExp> = {
    padding: /^(p|px|py|pt|pr|pb|pl)-/,
    gap: /^gap-/,
    radius: /^rounded/,
    shadow: /^shadow/,
    textSize: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,
    fontWeight: /^font-/,
    background: /^bg-/,
};

export function replaceTailwindGroup(
    className: string,
    group: TailwindGroup,
    nextToken: string,
): string {
    const pattern = GROUP_PATTERNS[group];
    const kept = className
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => !pattern.test(token));

    return customTwMerge([...kept, nextToken].join(' '));
}
