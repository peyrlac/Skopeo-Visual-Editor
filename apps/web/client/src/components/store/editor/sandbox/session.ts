import { api } from '@/trpc/client';
import {
    CodeProvider,
    Provider,
    ProviderBackgroundCommand,
    ProviderFileWatcher,
    ProviderTask,
    ProviderTerminal,
    createCodeProviderClient,
    type CopyFileOutput,
    type CopyFilesInput,
    type CreateDirectoryInput,
    type CreateDirectoryOutput,
    type CreateSessionInput,
    type CreateSessionOutput,
    type CreateTerminalInput,
    type CreateTerminalOutput,
    type DeleteFilesInput,
    type DeleteFilesOutput,
    type DownloadFilesInput,
    type DownloadFilesOutput,
    type GetTaskInput,
    type GetTaskOutput,
    type GitStatusInput,
    type GitStatusOutput,
    type InitializeInput,
    type InitializeOutput,
    type ListFilesInput,
    type ListFilesOutput,
    type PauseProjectInput,
    type PauseProjectOutput,
    type ReadFileInput,
    type ReadFileOutput,
    type RenameFileInput,
    type RenameFileOutput,
    type SetupInput,
    type SetupOutput,
    type StatFileInput,
    type StatFileOutput,
    type StopProjectInput,
    type StopProjectOutput,
    type TerminalBackgroundCommandInput,
    type TerminalBackgroundCommandOutput,
    type TerminalCommandInput,
    type TerminalCommandOutput,
    type WatchEvent,
    type WatchFilesInput,
    type WatchFilesOutput,
    type WriteFileInput,
    type WriteFileOutput,
} from '@onlook/code-provider';
import type { Branch } from '@onlook/models';
import { makeAutoObservable } from 'mobx';
import type { ErrorManager } from '../error';
import { CLISessionImpl, CLISessionType, type CLISession, type TerminalSession } from './terminal';

export class SessionManager {
    provider: Provider | null = null;
    isConnecting = false;
    terminalSessions = new Map<string, CLISession>();
    activeTerminalSessionId = 'cli';

    constructor(
        private readonly branch: Branch,
        private readonly errorManager: ErrorManager
    ) {
        makeAutoObservable(this);
    }

    async start(sandboxId: string, userId?: string): Promise<void> {
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 2000;

        if (this.isConnecting || this.provider) {
            return;
        }

        this.isConnecting = true;

        const attemptConnection = async () => {
            if (sandboxId.startsWith('local:')) {
                const provider = new LocalTRPCProvider(sandboxId);
                await provider.initialize({});
                this.provider = provider;
                await this.createTerminalSessions(provider);
                return;
            }

            const provider = await createCodeProviderClient(CodeProvider.CodeSandbox, {
                providerOptions: {
                    codesandbox: {
                        sandboxId,
                        userId,
                        initClient: true,
                        getSession: async (sandboxId, userId) => {
                            return api.sandbox.start.mutate({ sandboxId });
                        },
                    },
                },
            });

            this.provider = provider;
            await this.createTerminalSessions(provider);
        };

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                await attemptConnection();
                this.isConnecting = false;
                return;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`Failed to start sandbox session (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, error);

                this.provider = null;

                if (attempt < MAX_RETRIES) {
                    console.log(`Retrying sandbox connection in ${RETRY_DELAY_MS}ms...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                }
            }
        }

        this.isConnecting = false;
        throw lastError;
    }

    async restartDevServer(): Promise<boolean> {
        if (!this.provider) {
            console.error('No provider found in restartDevServer');
            return false;
        }
        const { task } = await this.provider.getTask({
            args: {
                id: 'dev',
            },
        });
        if (task) {
            await task.restart();
            return true;
        }
        return false;
    }

    async readDevServerLogs(): Promise<string> {
        const result = await this.provider?.getTask({ args: { id: 'dev' } });
        if (result) {
            return await result.task.open();
        }
        return 'Dev server not found';
    }

    getTerminalSession(id: string) {
        return this.terminalSessions.get(id) as TerminalSession | undefined;
    }

    async createTerminalSessions(provider: Provider) {
        const task = new CLISessionImpl(
            'server',
            CLISessionType.TASK,
            provider,
            this.errorManager,
        );
        this.terminalSessions.set(task.id, task);
        const terminal = new CLISessionImpl(
            'terminal',
            CLISessionType.TERMINAL,
            provider,
            this.errorManager,
        );

        this.terminalSessions.set(terminal.id, terminal);
        this.activeTerminalSessionId = task.id;

        // Initialize the sessions after creation
        try {
            await Promise.all([
                task.initTask(),
                terminal.initTerminal()
            ]);
        } catch (error) {
            console.error('Failed to initialize terminal sessions:', error);
        }
    }

    async disposeTerminal(id: string) {
        const terminal = this.terminalSessions.get(id) as TerminalSession | undefined;
        if (terminal) {
            if (terminal.type === CLISessionType.TERMINAL) {
                await terminal.terminal?.kill();
                if (terminal.xterm) {
                    terminal.xterm.dispose();
                }
            }
            this.terminalSessions.delete(id);
        }
    }

    async hibernate(sandboxId: string) {
        await api.sandbox.hibernate.mutate({ sandboxId });
    }

    async reconnect(sandboxId: string, userId?: string) {
        try {
            if (!this.provider) {
                console.error('No provider found in reconnect');
                return;
            }

            // Check if the session is still connected
            const isConnected = await this.ping();
            if (isConnected) {
                return;
            }

            // Attempt soft reconnect
            await this.provider?.reconnect();

            const isConnected2 = await this.ping();
            if (isConnected2) {
                return;
            }
            await this.restartProvider(sandboxId, userId);
        } catch (error) {
            console.error('Failed to reconnect to sandbox', error);
            this.isConnecting = false;
        }
    }

    async restartProvider(sandboxId: string, userId?: string) {
        if (!this.provider) {
            return;
        }
        await this.provider.destroy();
        this.provider = null;
        await this.start(sandboxId, userId);
    }

    async ping() {
        if (!this.provider) return false;
        try {
            await this.provider.runCommand({ args: { command: 'echo "ping"' } });
            return true;
        } catch (error) {
            console.error('Failed to connect to sandbox', error);
            return false;
        }
    }

    async runCommand(
        command: string,
        streamCallback?: (output: string) => void,
        ignoreError: boolean = false,
    ): Promise<{
        output: string;
        success: boolean;
        error: string | null;
    }> {
        try {
            if (!this.provider) {
                throw new Error('No provider found in runCommand');
            }

            // Append error suppression if ignoreError is true
            const finalCommand = ignoreError ? `${command} 2>/dev/null || true` : command;

            streamCallback?.(finalCommand + '\n');
            const { output } = await this.provider.runCommand({ args: { command: finalCommand } });
            streamCallback?.(output);
            return {
                output,
                success: true,
                error: null,
            };
        } catch (error) {
            console.error('Error running command:', error);
            return {
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }

    async clear() {
        // probably need to be moved in `Provider.destroy()`
        this.terminalSessions.forEach((terminal) => {
            if (terminal.type === CLISessionType.TERMINAL) {
                terminal.terminal?.kill();
                if (terminal.xterm) {
                    terminal.xterm.dispose();
                }
            }
        });
        if (this.provider) {
            await this.provider.destroy();
        }
        this.provider = null;
        this.isConnecting = false;
        this.terminalSessions.clear();
    }
}

class LocalTRPCProvider extends Provider {
    constructor(private readonly sandboxId: string) {
        super();
    }

    async initialize(_input: InitializeInput): Promise<InitializeOutput> {
        return {};
    }

    async setup(_input: SetupInput): Promise<SetupOutput> {
        return {};
    }

    async createSession(_input: CreateSessionInput): Promise<CreateSessionOutput> {
        return {};
    }

    async writeFile(input: WriteFileInput): Promise<WriteFileOutput> {
        return api.sandbox.localWriteFile.mutate({
            sandboxId: this.sandboxId,
            path: input.args.path,
            content: input.args.content,
            overwrite: input.args.overwrite,
        });
    }

    async renameFile(input: RenameFileInput): Promise<RenameFileOutput> {
        return api.sandbox.localRenameFile.mutate({
            sandboxId: this.sandboxId,
            oldPath: input.args.oldPath,
            newPath: input.args.newPath,
        });
    }

    async statFile(input: StatFileInput): Promise<StatFileOutput> {
        return api.sandbox.localStatFile.query({
            sandboxId: this.sandboxId,
            path: input.args.path,
        });
    }

    async deleteFiles(input: DeleteFilesInput): Promise<DeleteFilesOutput> {
        return api.sandbox.localDeleteFiles.mutate({
            sandboxId: this.sandboxId,
            path: input.args.path,
            recursive: input.args.recursive,
        });
    }

    async listFiles(input: ListFilesInput): Promise<ListFilesOutput> {
        return api.sandbox.localListFiles.query({
            sandboxId: this.sandboxId,
            path: input.args.path,
        });
    }

    async readFile(input: ReadFileInput): Promise<ReadFileOutput> {
        const result = await api.sandbox.localReadFile.query({
            sandboxId: this.sandboxId,
            path: input.args.path,
        });
        return {
            file: {
                ...result.file,
                toString: () => String(result.file.content),
            },
        };
    }

    async downloadFiles(_input: DownloadFilesInput): Promise<DownloadFilesOutput> {
        return {};
    }

    async copyFiles(_input: CopyFilesInput): Promise<CopyFileOutput> {
        throw new Error('Copying files is not implemented for local web mode yet');
    }

    async createDirectory(input: CreateDirectoryInput): Promise<CreateDirectoryOutput> {
        return api.sandbox.localCreateDirectory.mutate({
            sandboxId: this.sandboxId,
            path: input.args.path,
        });
    }

    async watchFiles(input: WatchFilesInput): Promise<WatchFilesOutput> {
        return { watcher: new LocalNoopWatcher(input.onFileChange) };
    }

    async createTerminal(_input: CreateTerminalInput): Promise<CreateTerminalOutput> {
        return { terminal: new LocalNoopTerminal() };
    }

    async getTask(input: GetTaskInput): Promise<GetTaskOutput> {
        return { task: new LocalTask(this.sandboxId, input.args.id) };
    }

    async runCommand(input: TerminalCommandInput): Promise<TerminalCommandOutput> {
        return api.sandbox.localRunCommand.mutate({
            sandboxId: this.sandboxId,
            command: input.args.command,
        });
    }

    async runBackgroundCommand(
        input: TerminalBackgroundCommandInput,
    ): Promise<TerminalBackgroundCommandOutput> {
        return { command: new LocalBackgroundCommand(this.sandboxId, input.args.command) };
    }

    async gitStatus(_input: GitStatusInput): Promise<GitStatusOutput> {
        return api.sandbox.localGitStatus.query({ sandboxId: this.sandboxId });
    }

    async reload(): Promise<boolean> {
        return true;
    }

    async reconnect(): Promise<void> {}

    async ping(): Promise<boolean> {
        return true;
    }

    async pauseProject(_input: PauseProjectInput): Promise<PauseProjectOutput> {
        return {};
    }

    async stopProject(_input: StopProjectInput): Promise<StopProjectOutput> {
        return {};
    }

    async listProjects(): Promise<Record<string, never>> {
        return {};
    }

    async destroy(): Promise<void> {}
}

class LocalNoopWatcher extends ProviderFileWatcher {
    constructor(private readonly callback?: (event: WatchEvent) => Promise<void>) {
        super();
    }

    async start(_input: WatchFilesInput): Promise<void> {}

    async stop(): Promise<void> {}

    registerEventCallback(callback: (event: WatchEvent) => Promise<void>): void {
        void this.callback;
        void callback;
    }
}

class LocalNoopTerminal extends ProviderTerminal {
    get id(): string {
        return 'local-terminal';
    }

    get name(): string {
        return 'Local terminal';
    }

    async open(): Promise<string> {
        return '';
    }

    async write(_input: string): Promise<void> {}

    async run(_input: string): Promise<void> {}

    async kill(): Promise<void> {}

    onOutput(_callback: (data: string) => void): () => void {
        return () => {};
    }
}

class LocalTask extends ProviderTask {
    constructor(
        private readonly sandboxId: string,
        private readonly taskId: string,
    ) {
        super();
    }

    get id(): string {
        return this.taskId;
    }

    get name(): string {
        return this.taskId;
    }

    get command(): string {
        return this.taskId === 'dev' ? 'npm run dev -- -p 3001' : this.taskId;
    }

    async open(): Promise<string> {
        return '';
    }

    async run(): Promise<void> {
        await api.sandbox.localRunCommand.mutate({
            sandboxId: this.sandboxId,
            command: this.command,
        });
    }

    async restart(): Promise<void> {
        await this.run();
    }

    async stop(): Promise<void> {}

    onOutput(_callback: (data: string) => void): () => void {
        return () => {};
    }
}

class LocalBackgroundCommand extends ProviderBackgroundCommand {
    constructor(
        private readonly sandboxId: string,
        private readonly commandValue: string,
    ) {
        super();
    }

    get name(): string | undefined {
        return this.commandValue.split(/\s+/)[0];
    }

    get command(): string {
        return this.commandValue;
    }

    async open(): Promise<string> {
        const result = await api.sandbox.localRunCommand.mutate({
            sandboxId: this.sandboxId,
            command: this.commandValue,
        });
        return result.output;
    }

    async restart(): Promise<void> {
        await this.open();
    }

    async kill(): Promise<void> {}

    onOutput(_callback: (data: string) => void): () => void {
        return () => {};
    }
}
