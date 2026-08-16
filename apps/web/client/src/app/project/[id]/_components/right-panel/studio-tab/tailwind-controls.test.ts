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

    test('preserves shadow color tokens when replacing shadow size', () => {
        expect(replaceTailwindGroup('shadow-sm shadow-black/30 bg-card', 'shadow', 'shadow-lg')).toBe(
            'shadow-black/30 bg-card shadow-lg',
        );
    });

    test('preserves font family tokens when replacing font weight', () => {
        expect(replaceTailwindGroup('font-sans font-medium text-sm', 'fontWeight', 'font-bold')).toBe(
            'font-sans text-sm font-bold',
        );
    });

    test('preserves background image layout tokens when replacing background color', () => {
        expect(replaceTailwindGroup('bg-cover bg-center bg-card', 'background', 'bg-primary')).toBe(
            'bg-cover bg-center bg-primary',
        );
    });
});
