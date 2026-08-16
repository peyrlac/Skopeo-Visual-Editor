import { describe, expect, test } from 'bun:test';
import { replaceTailwindGroup } from './tailwind-controls';

describe('replaceTailwindGroup', () => {
    test('replaces padding tokens', () => {
        expect(replaceTailwindGroup('rounded-lg p-4 bg-card', 'padding', 'p-6')).toBe(
            'rounded-lg bg-card p-6',
        );
    });

    test('adds missing radius token', () => {
        expect(replaceTailwindGroup('border bg-card', 'radius', 'rounded-xl')).toBe(
            'border bg-card rounded-xl',
        );
    });
});
