import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Globe, Search, Sprout } from 'lucide-react'
import { cn } from '@common/lib/utils'
import { useBrowser } from '../contexts/BrowserContext'
import {
    buildSuggestions,
    type AddressIntent,
    type Suggestion,
} from '../domain/addressBar'
import {
    resolveNewTabSearchInput,
    shouldShowNewTabSearch,
} from '../domain/newTabSearch'

const ROW_HEIGHT = 44

export const NewTabSearch: React.FC = () => {
    const {
        tabs,
        activeTab,
        isGardenActive,
        createTab,
        navigateToUrl,
        showGarden,
        switchTab,
    } = useBrowser()
    const [query, setQuery] = useState('')
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [dismissedTabId, setDismissedTabId] = useState<string | null>(null)

    const visible =
        shouldShowNewTabSearch({ isGardenActive, activeTab }) &&
        activeTab?.id !== dismissedTabId

    useEffect(() => {
        if (!visible) return
        const height = Math.max(window.screen.availHeight, window.outerHeight, 900)
        window.topBarAPI.setAddressExpanded(height)
        return () => {
            window.topBarAPI.setAddressExpanded(0)
        }
    }, [visible])

    useEffect(() => {
        if (visible) {
            setQuery('')
            setHighlightedIndex(-1)
        }
    }, [visible, activeTab?.id])

    const suggestions = useMemo<Suggestion[]>(() => {
        if (!visible) return []
        return buildSuggestions(query, {
            slot: activeTab ? { kind: 'tab', tabId: activeTab.id } : { kind: 'garden' },
            tabs: tabs.map((tab) => ({
                id: tab.id,
                title: tab.title,
                url: tab.url,
            })),
        })
    }, [visible, query, activeTab, tabs])

    const dispatchIntent = (intent: AddressIntent): void => {
        if (activeTab) setDismissedTabId(activeTab.id)

        switch (intent.kind) {
            case 'garden':
                void window.topBarAPI?.switchGarden?.(intent.name)
                showGarden()
                break
            case 'navigate-tab':
                navigateToUrl(intent.url)
                break
            case 'open-tab':
                createTab(intent.url)
                break
            case 'switch-tab':
                switchTab(intent.tabId)
                break
            case 'noop':
                break
        }
    }

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault()
        if (!activeTab) return
        const chosen =
            highlightedIndex >= 0 ? suggestions[highlightedIndex] : undefined
        dispatchIntent(chosen?.intent ?? resolveNewTabSearchInput(query, activeTab.id))
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'Escape') {
            if (activeTab) setDismissedTabId(activeTab.id)
            ; (e.target as HTMLInputElement).blur()
        } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
            e.preventDefault()
            setHighlightedIndex((index) => (index + 1) % suggestions.length)
        } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
            e.preventDefault()
            setHighlightedIndex((index) =>
                index <= 0 ? suggestions.length - 1 : index - 1
            )
        }
    }

    if (!visible) return null

    return (
        <div className="app-region-no-drag fixed inset-0 z-[80] flex items-center justify-center bg-[#060b1a]">
            <div className="w-full max-w-2xl px-8">
                <form onSubmit={handleSubmit} className="relative">
                    <div className="flex h-14 items-center gap-3 rounded-lg border border-white/10 bg-[#0c1630] px-4 shadow-2xl ring-1 ring-[#5b8cff]/25">
                        <Search className="size-5 shrink-0 text-[#5b8cff]" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value)
                                setHighlightedIndex(-1)
                            }}
                            onKeyDown={handleKeyDown}
                            className="h-full min-w-0 flex-1 bg-transparent text-[1rem] text-[#e7ecf6] outline-none placeholder:text-[#64718f]"
                            placeholder="Search or enter address"
                            spellCheck={false}
                            autoFocus
                        />
                    </div>

                    {suggestions.length > 0 && (
                        <ul className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-[#0a1124] shadow-2xl">
                            {suggestions.map((suggestion, index) => {
                                const Icon =
                                    suggestion.kind === 'garden'
                                        ? Sprout
                                        : suggestion.kind === 'switch-tab'
                                            ? ArrowLeftRight
                                            : suggestion.subtitle === 'Google Search'
                                                ? Search
                                                : Globe
                                return (
                                    <li key={suggestion.id}>
                                        <button
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault()
                                                dispatchIntent(suggestion.intent)
                                            }}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                            style={{ height: ROW_HEIGHT }}
                                            className={cn(
                                                'flex w-full items-center gap-3 px-4 text-left transition-colors',
                                                index === highlightedIndex
                                                    ? 'bg-[#1f2c4d]'
                                                    : 'hover:bg-white/[0.05]'
                                            )}
                                        >
                                            <Icon className="size-4 shrink-0 text-[#5b8cff]" />
                                            <span className="min-w-0 flex-1 truncate text-sm text-[#e7ecf6]">
                                                {suggestion.title}
                                            </span>
                                            {suggestion.subtitle && (
                                                <span className="max-w-[45%] truncate text-xs text-[#64718f]">
                                                    {suggestion.subtitle}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </form>
            </div>
        </div>
    )
}
