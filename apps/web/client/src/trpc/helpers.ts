import { httpBatchStreamLink, loggerLink } from '@trpc/client';
import SuperJSON from 'superjson';

export function getBaseUrl() {
    if (typeof window !== 'undefined') return window.location.origin;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const links = [
    loggerLink({
        enabled: (op) =>
            process.env.NODE_ENV === 'development' ||
            (op.direction === 'down' && op.result instanceof Error),
    }),
    httpBatchStreamLink({
        transformer: SuperJSON,
        url: getBaseUrl() + '/api/trpc',
        headers: async () => {
            const headers = new Headers();
            headers.set('x-trpc-source', 'vanilla-client');
            if (typeof window !== 'undefined') {
                const { createClient } = await import('@/utils/supabase/client');
                const supabase = createClient();
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                if (session?.access_token) {
                    headers.set('authorization', `Bearer ${session.access_token}`);
                }
            }
            return headers;
        },
    }),
];
