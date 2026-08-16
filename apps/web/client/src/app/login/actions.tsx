'use server';

import { env } from '@/env';
import { Routes } from '@/utils/constants';
import { createClient } from '@/utils/supabase/server';
import { SEED_USER, users } from '@onlook/db';
import { db } from '@onlook/db/src/client';
import { SignInMethod } from '@onlook/models';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(provider: SignInMethod.GITHUB | SignInMethod.GOOGLE) {
    const supabase = await createClient();
    const origin = (await headers()).get('origin') ?? env.NEXT_PUBLIC_SITE_URL;
    const redirectTo = `${origin}${Routes.AUTH_CALLBACK}`;

    // If already session, redirect
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (user) {
        redirect(Routes.AUTH_REDIRECT);
    }

    // Start OAuth flow
    // Note: User object will be created in the auth callback route if it doesn't exist
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo,
        },
    });

    if (error) {
        redirect('/error');
    }

    redirect(data.url);
}

export async function devLogin() {
    if (env.NODE_ENV !== 'development' && !env.NEXT_PUBLIC_DEV_LOGIN_ENABLED) {
        throw new Error('Dev login is only available in development mode');
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        await upsertDemoUser(user.id, user.email);
        redirect(Routes.AUTH_REDIRECT);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: SEED_USER.EMAIL,
        password: SEED_USER.PASSWORD,
    });

    if (error) {
        console.error('Error signing in with password:', error);
        throw new Error(error.message);
    }

    if (data.user) {
        await upsertDemoUser(data.user.id, data.user.email);
    }

    redirect(Routes.AUTH_REDIRECT);
}

async function upsertDemoUser(id: string, email: string | undefined) {
    await db
        .insert(users)
        .values({
            id,
            firstName: SEED_USER.FIRST_NAME,
            lastName: SEED_USER.LAST_NAME,
            displayName: SEED_USER.DISPLAY_NAME,
            email: email ?? SEED_USER.EMAIL,
            avatarUrl: SEED_USER.AVATAR_URL,
        })
        .onConflictDoUpdate({
            target: users.id,
            set: {
                firstName: SEED_USER.FIRST_NAME,
                lastName: SEED_USER.LAST_NAME,
                displayName: SEED_USER.DISPLAY_NAME,
                email: email ?? SEED_USER.EMAIL,
                avatarUrl: SEED_USER.AVATAR_URL,
                updatedAt: new Date(),
            },
        });
}
