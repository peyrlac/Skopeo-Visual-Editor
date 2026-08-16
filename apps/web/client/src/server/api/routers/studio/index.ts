import { env } from '@/env';
import { NodeFsProvider } from '@onlook/code-provider/providers/nodefs';
import { previewClassNamePatchInFile, resolveElementSourceFromFiles } from '@onlook/parser';
import { TRPCError } from '@trpc/server';
import path from 'node:path';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '../../trpc';

const TEXT_EXTENSIONS = /\.(tsx|ts|jsx|js)$/;
const SEARCH_DIRS = ['src/components', 'src/views', 'src/app'];

export const studioRouter = createTRPCRouter({
    resolveElementSource: protectedProcedure
        .input(z.object({ sandboxId: z.string(), oid: z.string() }))
        .query(async ({ input }) => {
            ensureLocalSandbox(input.sandboxId);
            const files = await readSearchFiles();
            return resolveElementSourceFromFiles(files, input.oid);
        }),

    previewClassPatch: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
                filePath: z.string(),
                oid: z.string(),
                nextClassName: z.string(),
            }),
        )
        .mutation(async ({ input }) => {
            ensureLocalSandbox(input.sandboxId);
            const filePath = ensurePatchableSourcePath(input.filePath);
            const provider = await getLocalProvider();
            try {
                const { file } = await provider.readFile({ args: { path: filePath } });
                if (typeof file.content !== 'string') {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: `${filePath} is not a text file`,
                    });
                }
                return previewClassNamePatchInFile({
                    filePath,
                    content: file.content,
                    oid: input.oid,
                    nextClassName: input.nextClassName,
                });
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),

    applyClassPatch: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
                filePath: z.string(),
                oid: z.string(),
                nextClassName: z.string(),
            }),
        )
        .mutation(async ({ input }) => {
            ensureLocalSandbox(input.sandboxId);
            const filePath = ensurePatchableSourcePath(input.filePath);
            const provider = await getLocalProvider();
            try {
                const { file } = await provider.readFile({ args: { path: filePath } });
                if (typeof file.content !== 'string') {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: `${filePath} is not a text file`,
                    });
                }
                const patch = previewClassNamePatchInFile({
                    filePath,
                    content: file.content,
                    oid: input.oid,
                    nextClassName: input.nextClassName,
                });
                await provider.writeFile({
                    args: { path: filePath, content: patch.after, overwrite: true },
                });
                return { ...patch, status: 'applied' as const };
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
});

function ensureLocalSandbox(sandboxId: string) {
    if (!sandboxId.startsWith('local:')) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Skopeo Studio V1 only supports local projects',
        });
    }
}

function ensurePatchableSourcePath(filePath: string) {
    const normalized = filePath.replace(/\\/g, '/');
    const cleanPath = path.posix.normalize(normalized);
    const isUnsafePath =
        !normalized ||
        normalized.includes('\0') ||
        normalized.startsWith('/') ||
        /^[A-Za-z]:/.test(normalized) ||
        cleanPath.startsWith('../') ||
        cleanPath === '..';
    const isAllowedRoot = SEARCH_DIRS.some((dir) => cleanPath.startsWith(`${dir}/`));
    const isAllowedExtension = TEXT_EXTENSIONS.test(cleanPath);

    if (isUnsafePath || !isAllowedRoot || !isAllowedExtension) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Skopeo Studio V1 only patches source files under src/components, src/views, or src/app',
        });
    }

    return cleanPath;
}

async function getLocalProvider() {
    const provider = new NodeFsProvider({ rootDir: env.ONLOOK_LOCAL_PROJECT_ROOT });
    await provider.initialize({});
    return provider;
}

async function readSearchFiles() {
    const provider = await getLocalProvider();
    try {
        const files: Array<{ path: string; content: string }> = [];
        for (const dir of SEARCH_DIRS) {
            await collectTextFiles(provider, dir, files);
        }
        return files;
    } finally {
        await provider.destroy().catch(() => {});
    }
}

async function collectTextFiles(
    provider: NodeFsProvider,
    dir: string,
    files: Array<{ path: string; content: string }>,
) {
    let entries;
    try {
        entries = (await provider.listFiles({ args: { path: dir } })).files;
    } catch {
        return;
    }

    for (const entry of entries) {
        const childPath = `${dir}/${entry.name}`;
        if (entry.type === 'directory') {
            await collectTextFiles(provider, childPath, files);
            continue;
        }
        if (!TEXT_EXTENSIONS.test(entry.name)) {
            continue;
        }
        const { file } = await provider.readFile({ args: { path: childPath } });
        if (typeof file.content === 'string') {
            files.push({ path: childPath, content: file.content });
        }
    }
}
