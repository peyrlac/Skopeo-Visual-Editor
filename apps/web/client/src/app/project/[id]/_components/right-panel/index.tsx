'use client';

import { useEditorEngine } from '@/components/store/editor';
import { Icons } from '@onlook/ui/icons/index';
import { ResizablePanel } from '@onlook/ui/resizable';
import { cn } from '@onlook/ui/utils';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { ChatTab } from './chat-tab';
import { ChatControls } from './chat-tab/controls';
import { ChatHistory } from './chat-tab/history';
import { ChatPanelDropdown } from './chat-tab/panel-dropdown';
import { StudioTab } from './studio-tab';
import type { StudioPanelMode } from './studio-tab/types';

export const RightPanel = observer(() => {
    const editorEngine = useEditorEngine();
    const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
    const [panelMode, setPanelMode] = useState<StudioPanelMode>('studio');
    const currentConversation = editorEngine.chat.conversation.current;
    const editPanelWidth = 352

    return (
        <div
            className='flex h-full w-full transition-width duration-300 bg-background/95 group/panel border-[0.5px] backdrop-blur-xl shadow rounded-tl-xl'
        >
            <ResizablePanel
                side="right"
                defaultWidth={editPanelWidth}
                forceWidth={editPanelWidth}
                minWidth={240}
                maxWidth={500}
            >
                <div className='flex flex-col h-full'>
                    <div className="flex flex-row p-1 w-full h-10 border-b border-border ">
                        <div className="flex items-center gap-1 p-1">
                            <button
                                className={cn(
                                    'rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground',
                                    panelMode === 'studio' && 'bg-muted text-foreground',
                                )}
                                onClick={() => {
                                    setPanelMode('studio');
                                    setIsChatHistoryOpen(false);
                                }}
                            >
                                Studio
                            </button>
                            <ChatPanelDropdown
                                isChatHistoryOpen={panelMode === 'chat' && isChatHistoryOpen}
                                setIsChatHistoryOpen={setIsChatHistoryOpen}
                            >
                                <button
                                    className={cn(
                                        'flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground',
                                        panelMode === 'chat' && 'bg-muted text-foreground',
                                    )}
                                    onClick={() => setPanelMode('chat')}
                                >
                                    <Icons.Sparkles className="h-3.5 w-3.5" />
                                    Chat
                                    <Icons.ChevronDown className="h-3 w-3 text-muted-foreground" />
                                </button>
                            </ChatPanelDropdown>
                        </div>
                        {panelMode === 'chat' && (
                            <div className='ml-auto'>
                                <ChatControls />
                            </div>
                        )}
                    </div>
                    {panelMode === 'chat' && (
                        <ChatHistory isOpen={isChatHistoryOpen} onOpenChange={setIsChatHistoryOpen} />
                    )}

                    <div className='flex-1 overflow-y-auto'>
                        {panelMode === 'studio' ? (
                            <StudioTab />
                        ) : currentConversation ? (
                            <ChatTab
                                conversationId={currentConversation.id}
                                projectId={editorEngine.projectId}
                            />
                        ) : null}
                    </div>
                </div>
            </ResizablePanel >
        </div >
    );
});
