import { type Metadata } from 'next';
import { ProjectCreationProvider } from './_context';

export const metadata: Metadata = {
    title: 'Onlook',
    description: 'Onlook – Import Local Project',
};

export default async function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
    return <ProjectCreationProvider totalSteps={2}>{children} </ProjectCreationProvider>;
}
