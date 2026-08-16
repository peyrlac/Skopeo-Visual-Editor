/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { env } from '@/env';
import { createLocalSkopeoUser, isLocalSkopeoMode } from '@/utils/local-mode';
import { createAdminClient } from '@/utils/supabase/admin';
import { db } from '@onlook/db/src/client';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { SetRequiredDeep } from 'type-fest';
import { ZodError } from 'zod';

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
    const supabase = createSupabaseClientFromHeaders(opts.headers);
    if (isLocalSkopeoMode()) {
        return {
            db,
            supabase,
            user: createLocalSkopeoUser(),
            ...opts,
        };
    }

    const authHeader = opts.headers.get('authorization');
    const accessToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
    const cookieAccessToken = accessToken ?? getAccessTokenFromCookieHeader(opts.headers.get('cookie') ?? '');
    const { user, error } = cookieAccessToken
        ? await getUserFromBearer(cookieAccessToken)
        : await getUserFromCookies(supabase);

    if (error) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: error.message });
    }

    return {
        db,
        supabase,
        user,
        ...opts,
    };
};

function createSupabaseAuthClient() {
    return createSupabaseJsClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        },
    );
}

async function getUserFromBearer(accessToken: string): Promise<AuthResult> {
    const fetchedUser = await getUserFromBearerFetch(accessToken);
    if (fetchedUser.user || !isEmptyJsonAuthError(fetchedUser.error)) {
        return fetchedUser;
    }

    const authSupabase = createSupabaseAuthClient();

    try {
        const {
            data: { user },
            error,
        } = await authSupabase.auth.getUser(accessToken);

        if (user || !isEmptyJsonAuthError(error)) {
            return { user, error };
        }
    } catch (error) {
        if (!isEmptyJsonAuthError(error)) {
            return { user: null, error: toError(error) };
        }
    }

    return fetchedUser;
}

async function getUserFromCookies(supabase: ReturnType<typeof createSupabaseClientFromHeaders>) {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();
    return { user, error };
}

async function getUserFromBearerFetch(accessToken: string): Promise<AuthResult> {
    const response = await getRuntimeFetch()(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        return {
            user: null,
            error: new Error(await response.text()),
        };
    }

    const body = await response.text();
    try {
        return {
            user: JSON.parse(body) as User,
            error: null,
        };
    } catch {
        return {
            user: null,
            error: new Error('Supabase Auth returned an empty or invalid user response'),
        };
    }
}

function getRuntimeFetch() {
    const globalWithBun = globalThis as typeof globalThis & {
        Bun?: { fetch?: typeof fetch };
    };
    return globalWithBun.Bun?.fetch ?? fetch;
}

function isEmptyJsonAuthError(error: unknown) {
    return toError(error)?.message === 'JSON Parse error: Unexpected EOF';
}

function toError(error: unknown) {
    if (!error) {
        return null;
    }

    return error instanceof Error ? error : new Error(String(error));
}

function createSupabaseClientFromHeaders(headers: Headers) {
    return createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return parseCookieHeader(headers.get('cookie') ?? '');
                },
                setAll() {
                    // tRPC request handlers authenticate from incoming cookies only.
                },
            },
        },
    );
}

function parseCookieHeader(cookieHeader: string) {
    if (!cookieHeader) {
        return [];
    }

    return cookieHeader.split(';').map((cookie) => {
        const [rawName, ...rawValue] = cookie.trim().split('=');
        return {
            name: rawName ?? '',
            value: decodeURIComponent(rawValue.join('=')),
        };
    }).filter((cookie) => cookie.name);
}

function getAccessTokenFromCookieHeader(cookieHeader: string) {
    const authCookie = parseCookieHeader(cookieHeader).find(
        (cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token'),
    );
    if (!authCookie) {
        return null;
    }

    return getAccessTokenFromSupabaseCookie(authCookie.value);
}

function getAccessTokenFromSupabaseCookie(value: string): string | null {
    const payload = value.startsWith('base64-') ? decodeBase64Url(value.slice('base64-'.length)) : value;
    if (!payload) {
        return null;
    }

    try {
        const parsed = JSON.parse(payload) as unknown;
        if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
            return parsed[0];
        }
        if (parsed && typeof parsed === 'object') {
            const record = parsed as Record<string, unknown>;
            if (typeof record.access_token === 'string') {
                return record.access_token;
            }
            if (typeof record.accessToken === 'string') {
                return record.accessToken;
            }
        }
    } catch {
        return null;
    }

    return null;
}

function decodeBase64Url(value: string) {
    try {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
        return Buffer.from(padded, 'base64').toString('utf8');
    } catch {
        return null;
    }
}

type AuthResult = {
    user: User | null;
    error: Error | null;
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            data: {
                ...shape.data,
                zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
            },
        };
    },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
    const start = Date.now();

    if (t._config.isDev) {
        // artificial delay in dev
        const waitMs = Math.floor(Math.random() * 400) + 100;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const result = await next();

    const end = Date.now();
    console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

    return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
    if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!ctx.user.email) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User must have an email address to access this resource',
        });
    }

    return next({
        ctx: {
            // infers the `session` as non-nullable
            user: ctx.user as SetRequiredDeep<User, 'email'>,
            db: ctx.db,
        },
    });
});

/**
 * Admin procedure with service role access
 *
 * This procedure provides access to Supabase admin operations using the service role key.
 * Use with extreme caution as it bypasses RLS policies.
 *
 * @see https://trpc.io/docs/procedures
 */
export const adminProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
    if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!ctx.user.email) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User must have an email address to access this resource',
        });
    }

    const adminSupabase = createAdminClient();

    return next({
        ctx: {
            // infers the `session` as non-nullable
            user: ctx.user as SetRequiredDeep<User, 'email'>,
            db: ctx.db,
            supabase: adminSupabase, // Override with admin client
        },
    });
});

