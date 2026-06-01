import React, { useEffect } from 'react'
import { ChatProvider } from './contexts/ChatContext'
import { Chat } from './components/Chat'
import { CommandBar } from './components/CommandBar'
import { useDarkMode } from '@common/hooks/useDarkMode'

const mode = new URLSearchParams(window.location.search).get('mode')

const SidebarContent: React.FC = () => {
    const { isDarkMode } = useDarkMode()

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [isDarkMode])

    return (
        <div className="h-screen flex flex-col bg-background border-l border-border">
            <Chat />
        </div>
    )
}

export const SidebarApp: React.FC = () => {
    if (mode === 'commandbar') {
        return (
            <ChatProvider>
                <CommandBar />
            </ChatProvider>
        )
    }

    return (
        <ChatProvider>
            <SidebarContent />
        </ChatProvider>
    )
}
