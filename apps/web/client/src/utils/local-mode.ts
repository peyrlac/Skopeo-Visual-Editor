import { env } from '@/env';
import type { User } from '@supabase/supabase-js';

export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001';
export const LOCAL_USER_EMAIL = 'local@skopeo.dev';

export function isLocalSkopeoMode() {
    return env.NEXT_PUBLIC_DEV_LOGIN_ENABLED && !!env.ONLOOK_LOCAL_PROJECT_ROOT;
}

export function createLocalSkopeoUser(): User {
    const now = new Date(0).toISOString();

    return {
        id: LOCAL_USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: LOCAL_USER_EMAIL,
        email_confirmed_at: now,
        phone: '',
        confirmed_at: now,
        last_sign_in_at: now,
        app_metadata: {},
        user_metadata: {
            name: 'Skopeo Local',
            full_name: 'Skopeo Local',
        },
        identities: [],
        created_at: now,
        updated_at: now,
        is_anonymous: false,
    };
}
