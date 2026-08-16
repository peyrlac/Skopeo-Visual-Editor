import { Routes } from '@/utils/constants';
import { isLocalSkopeoMode } from '@/utils/local-mode';
import { createClient } from '@/utils/supabase/server';
import { type Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
    title: 'Onlook',
    description: 'Onlook – Create Project',
};

export default async function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
    if (isLocalSkopeoMode()) {
        return <>{children}</>;
    }

    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
        redirect(Routes.LOGIN);
    }
    return <>{children}</>;
}
