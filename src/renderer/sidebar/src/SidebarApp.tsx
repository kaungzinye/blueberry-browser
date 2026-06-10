import React from 'react'
import { ChatProvider } from './contexts/ChatContext'
import { CommandBar } from './components/CommandBar'

/**
 * The sidebar renderer hosts the bottom Command Bar (the tab-view chat
 * surface). It is always loaded with ?mode=commandbar by SideBar.ts; the older
 * full-height Chat sidebar has been removed (Chat is the Command Bar).
 */
export const SidebarApp: React.FC = () => {
    return (
        <ChatProvider>
            <CommandBar />
        </ChatProvider>
    )
}
