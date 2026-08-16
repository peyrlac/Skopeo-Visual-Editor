import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
    CodeProvider,
    createCodeProviderClient,
    getStaticCodeProvider,
} from '@onlook/code-provider';
import { NodeFsProvider } from '@onlook/code-provider/providers/nodefs';
import { getSandboxPreviewUrl, SandboxTemplates, Templates } from '@onlook/constants';
import { shortenUuid } from '@onlook/utility/src/id';

import { env } from '@/env';
import { createTRPCRouter, protectedProcedure } from '../../trpc';
import { listAccessibleSandboxIds, verifySandboxAccess } from './helper';

function getProvider({
    sandboxId,
    userId,
    provider = CodeProvider.CodeSandbox,
    initClient = false,
}: {
    sandboxId: string;
    provider?: CodeProvider;
    userId?: undefined | string;
    initClient?: boolean;
}) {
    if (provider === CodeProvider.CodeSandbox) {
        return createCodeProviderClient(CodeProvider.CodeSandbox, {
            providerOptions: {
                codesandbox: {
                    sandboxId,
                    userId,
                    initClient,
                },
            },
        });
    } else {
        const provider = new NodeFsProvider({
            rootDir: env.ONLOOK_LOCAL_PROJECT_ROOT,
            tasks: {
                dev: { name: 'dev', command: 'npm run dev -- -p 3001' },
            },
        });
        return provider.initialize({}).then(() => provider);
    }
}

async function getLocalProvider() {
    const provider = new NodeFsProvider({
        rootDir: env.ONLOOK_LOCAL_PROJECT_ROOT,
        tasks: {
            dev: { name: 'dev', command: 'npm run dev -- -p 3001' },
        },
    });
    await provider.initialize({});
    return provider;
}

export const sandboxRouter = createTRPCRouter({
    create: protectedProcedure
        .input(
            z.object({
                title: z.string().optional(),
            }),
        )
        .mutation(async ({ input }) => {
            // Create a new sandbox using the static provider
            const CodesandboxProvider = await getStaticCodeProvider(CodeProvider.CodeSandbox);

            // Use the empty Next.js template
            const template = SandboxTemplates[Templates.EMPTY_NEXTJS];

            const newSandbox = await CodesandboxProvider.createProject({
                source: 'template',
                id: template.id,
                title: input.title || 'Onlook Test Sandbox',
                description: 'Test sandbox for Onlook sync engine',
                tags: ['onlook-test'],
            });

            return {
                sandboxId: newSandbox.id,
                previewUrl: getSandboxPreviewUrl(newSandbox.id, template.port),
            };
        }),

    start: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            if (input.sandboxId.startsWith('local:')) {
                const provider = await getLocalProvider();
                try {
                    return await provider.createSession({
                        args: {
                            id: shortenUuid(ctx.user.id, 20),
                        },
                    });
                } finally {
                    await provider.destroy().catch(() => {});
                }
            }

            const userId = ctx.user.id;
            await verifySandboxAccess(ctx.db, userId, input.sandboxId);
            const provider = await getProvider({
                sandboxId: input.sandboxId,
                userId,
            });
            const session = await provider.createSession({
                args: {
                    id: shortenUuid(userId, 20),
                },
            });
            await provider.destroy();
            return session;
        }),
    localListFiles: protectedProcedure
        .input(z.object({ sandboxId: z.string(), path: z.string() }))
        .query(async ({ input }) => {
            if (!input.sandboxId.startsWith('local:')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expected a local sandbox id' });
            }
            const provider = await getLocalProvider();
            try {
                return await provider.listFiles({ args: { path: input.path } });
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    localReadFile: protectedProcedure
        .input(z.object({ sandboxId: z.string(), path: z.string() }))
        .query(async ({ input }) => {
            if (!input.sandboxId.startsWith('local:')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expected a local sandbox id' });
            }
            const provider = await getLocalProvider();
            try {
                return await provider.readFile({ args: { path: input.path } });
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    localStatFile: protectedProcedure
        .input(z.object({ sandboxId: z.string(), path: z.string() }))
        .query(async ({ input }) => {
            if (!input.sandboxId.startsWith('local:')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expected a local sandbox id' });
            }
            const provider = await getLocalProvider();
            try {
                return await provider.statFile({ args: { path: input.path } });
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    localWriteFile: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
                path: z.string(),
                content: z.any(),
                overwrite: z.boolean().optional(),
            }),
        )
        .mutation(async ({ input }) => {
            if (!input.sandboxId.startsWith('local:')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expected a local sandbox id' });
            }
            const provider = await getLocalProvider();
            try {
                return await provider.writeFile({
                    args: {
                        path: input.path,
                        content: input.content,
                        overwrite: input.overwrite,
                    },
                });
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    localDeleteFiles: protectedProcedure
        .input(z.object({ sandboxId: z.string(), path: z.string(), recursive: z.boolean().optional() }))
        .mutation(async ({ input }) => {
            if (!input.sandboxId.startsWith('local:')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expected a local sandbox id' });
            }
            const provider = await getLocalProvider();
            try {
                return await provider.deleteFiles({ args: { path: input.path, recursive: input.recursive } });
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    localRenameFile: protectedProcedure
        .input(z.object({ sandboxId: z.string(), oldPath: z.string(), newPath: z.string() }))
        .mutation(async ({ input }) => {
            if (!input.sandboxId.startsWith('local:')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expected a local sandbox id' });
            }
            const provider = await getLocalProvider();
            try {
                return await provider.renameFile({ args: { oldPath: input.oldPath, newPath: input.newPath } });
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    localCreateDirectory: protectedProcedure
        .input(z.object({ sandboxId: z.string(), path: z.string() }))
        .mutation(async ({ input }) => {
            if (!input.sandboxId.startsWith('local:')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expected a local sandbox id' });
            }
            const provider = await getLocalProvider();
            try {
                return await provider.createDirectory({ args: { path: input.path } });
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    localRunCommand: protectedProcedure
        .input(z.object({ sandboxId: z.string(), command: z.string() }))
        .mutation(async ({ input }) => {
            if (!input.sandboxId.startsWith('local:')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expected a local sandbox id' });
            }
            const provider = await getLocalProvider();
            try {
                return await provider.runCommand({ args: { command: input.command } });
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    localGitStatus: protectedProcedure
        .input(z.object({ sandboxId: z.string() }))
        .query(async ({ input }) => {
            if (!input.sandboxId.startsWith('local:')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expected a local sandbox id' });
            }
            const provider = await getLocalProvider();
            try {
                return await provider.gitStatus({});
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    hibernate: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            await verifySandboxAccess(ctx.db, ctx.user.id, input.sandboxId);
            const provider = await getProvider({ sandboxId: input.sandboxId });
            try {
                await provider.pauseProject({});
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    list: protectedProcedure.input(z.object({ sandboxId: z.string() })).query(async ({ input, ctx }) => {
        await verifySandboxAccess(ctx.db, ctx.user.id, input.sandboxId);
        const provider = await getProvider({ sandboxId: input.sandboxId });
        const res = await provider.listProjects({});
        // TODO future iteration of code provider abstraction will need this code to be refactored
        if ('projects' in res) {
            // `listProjects` returns the entire account's sandboxes. Scope the
            // result to the caller's own so this can't enumerate other tenants'
            // sandboxes (the input id doesn't constrain the provider output).
            const accessible = await listAccessibleSandboxIds(ctx.db, ctx.user.id);
            const projectList = res.projects as Array<{ id: string }>;
            return projectList.filter((project) => accessible.has(project.id));
        }
        return [];
    }),
    fork: protectedProcedure
        .input(
            z.object({
                sandbox: z.object({
                    id: z.string(),
                    port: z.number(),
                }),
                config: z
                    .object({
                        title: z.string().optional(),
                        tags: z.array(z.string()).optional(),
                    })
                    .optional(),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            // Forking a sandbox tied to another user's project would clone their
            // source tree. Templates / fresh sandboxes resolve to no project and
            // are allowed (blank-project + local-import flows fork a template).
            await verifySandboxAccess(ctx.db, ctx.user.id, input.sandbox.id);
            const MAX_RETRY_ATTEMPTS = 3;
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
                try {
                    const CodesandboxProvider = await getStaticCodeProvider(
                        CodeProvider.CodeSandbox,
                    );
                    const sandbox = await CodesandboxProvider.createProject({
                        source: 'template',
                        id: input.sandbox.id,

                        // Metadata
                        title: input.config?.title,
                        tags: input.config?.tags,
                    });

                    const previewUrl = getSandboxPreviewUrl(sandbox.id, input.sandbox.port);

                    return {
                        sandboxId: sandbox.id,
                        previewUrl,
                    };
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));

                    if (attempt < MAX_RETRY_ATTEMPTS) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, Math.pow(2, attempt) * 1000),
                        );
                    }
                }
            }

            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to create sandbox after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message}`,
                cause: lastError,
            });
        }),
    uploadFilesAndSetup: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
                files: z.array(
                    z.object({
                        path: z.string(),
                        content: z.string(),
                        type: z.enum(['text', 'binary']),
                    }),
                ),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            await verifySandboxAccess(ctx.db, ctx.user.id, input.sandboxId);
            const provider = await getProvider({
                sandboxId: input.sandboxId,
                userId: ctx.user.id,
                initClient: true,
            });

            try {
                for (const file of input.files) {
                    const result = await provider.writeFile({
                        args: {
                            path: file.path,
                            content:
                                file.type === 'binary'
                                    ? Uint8Array.from(Buffer.from(file.content, 'base64'))
                                    : file.content,
                            overwrite: true,
                        },
                    });

                    if (!result.success) {
                        throw new Error(`Remote write failed for ${file.path}`);
                    }
                }

                await provider.setup({});
            } finally {
                await provider.destroy();
            }
        }),
    delete: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            await verifySandboxAccess(ctx.db, ctx.user.id, input.sandboxId);
            const provider = await getProvider({ sandboxId: input.sandboxId });
            try {
                await provider.stopProject({});
            } finally {
                await provider.destroy().catch(() => {});
            }
        }),
    createFromGitHub: protectedProcedure
        .input(
            z.object({
                repoUrl: z.string(),
                branch: z.string(),
            }),
        )
        .mutation(async ({ input }) => {
            const MAX_RETRY_ATTEMPTS = 3;
            const DEFAULT_PORT = 3000;
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
                try {
                    const CodesandboxProvider = await getStaticCodeProvider(
                        CodeProvider.CodeSandbox,
                    );
                    const sandbox = await CodesandboxProvider.createProjectFromGit({
                        repoUrl: input.repoUrl,
                        branch: input.branch,
                    });

                    const previewUrl = getSandboxPreviewUrl(sandbox.id, DEFAULT_PORT);

                    return {
                        sandboxId: sandbox.id,
                        previewUrl,
                    };
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));

                    if (attempt < MAX_RETRY_ATTEMPTS) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, Math.pow(2, attempt) * 1000),
                        );
                    }
                }
            }

            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to create GitHub sandbox after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message}`,
                cause: lastError,
            });
        }),
});
