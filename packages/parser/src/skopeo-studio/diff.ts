export function createUnifiedDiff(filePath: string, before: string, after: string): string {
    if (before === after) {
        return '';
    }

    const beforeLines = before.split('\n');
    const afterLines = after.split('\n');
    const lines = [`--- ${filePath}`, `+++ ${filePath}`];
    const max = Math.max(beforeLines.length, afterLines.length);

    for (let i = 0; i < max; i++) {
        const beforeLine = beforeLines[i];
        const afterLine = afterLines[i];
        if (beforeLine === afterLine) {
            continue;
        }
        if (beforeLine !== undefined) {
            lines.push(`-${beforeLine}`);
        }
        if (afterLine !== undefined) {
            lines.push(`+${afterLine}`);
        }
    }

    return lines.join('\n');
}
