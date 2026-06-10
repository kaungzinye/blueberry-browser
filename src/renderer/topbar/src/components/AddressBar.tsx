import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw, Loader2, Search, Globe, ArrowLeftRight, Sprout } from 'lucide-react'
import { useBrowser } from '../contexts/BrowserContext'
import { ToolBarButton } from '../components/ToolBarButton'
import { Favicon } from '../components/Favicon'
import { DarkModeToggle } from '../components/DarkModeToggle'
import { cn } from '@common/lib/utils'
import {
    buildSuggestions,
    gardenAddress,
    resolveAddressInput,
    type AddressIntent,
    type Slot,
    type Suggestion,
} from '../domain/addressBar'

/** Suggestion row height (px) — used to size the overlay panel in the main process. */
const SUGGESTION_ROW_HEIGHT = 40
const SUGGESTION_PANEL_PADDING = 8

export const AddressBar: React.FC = () => {
    const {
        tabs,
        activeTab,
        isGardenActive,
        navigateToUrl,
        createTab,
        switchTab,
        showGarden,
        goBack,
        goForward,
        reload,
        isLoading,
    } = useBrowser()
    const [url, setUrl] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)

    // What the bar shows: the garden address when the Garden holds the slot,
    // otherwise the active tab's URL.
    const displayAddress = isGardenActive ? gardenAddress() : activeTab?.url || ''

    // The current content-slot occupant, used to route submitted input.
    const slot: Slot =
        isGardenActive || !activeTab
            ? { kind: 'garden' }
            : { kind: 'tab', tabId: activeTab.id }

    // Omnibox suggestions for the current input (live sources only).
    const suggestions = useMemo<Suggestion[]>(() => {
        if (!isEditing) return []
        return buildSuggestions(url, {
            slot,
            tabs: tabs.map((t) => ({ id: t.id, title: t.title, url: t.url })),
        })
    }, [isEditing, url, isGardenActive, activeTab?.id, tabs])

    const showSuggestions = isFocused && suggestions.length > 0

    // Update displayed URL when the slot occupant changes (unless mid-edit).
    useEffect(() => {
        if (!isEditing) {
            setUrl(displayAddress)
        }
    }, [displayAddress, isEditing])

    const collapse = () => {
        setIsEditing(false)
        setIsFocused(false)
        setHighlightedIndex(-1)
    }

    // Grow/shrink the top bar so the suggestion panel isn't clipped by the slim
    // top-bar view (it's a fixed-height WebContentsView). 0 restores the bar.
    useEffect(() => {
        const panelHeight = showSuggestions
            ? suggestions.length * SUGGESTION_ROW_HEIGHT + SUGGESTION_PANEL_PADDING
            : 0
        window.topBarAPI.setAddressExpanded(panelHeight)
        return () => {
            window.topBarAPI.setAddressExpanded(0)
        }
    }, [showSuggestions, suggestions.length])

    // Collapse when another view takes focus — DOM blur doesn't cross
    // WebContentsView boundaries, so the main process signals us instead.
    useEffect(() => {
        return window.topBarAPI.onCollapseAddressBar(() => {
            collapse()
            setUrl(displayAddress)
            ; (document.activeElement as HTMLElement)?.blur()
        })
    }, [displayAddress])

    const dispatchIntent = (intent: AddressIntent) => {
        switch (intent.kind) {
            case 'garden':
                // Multi-garden: route the address's garden name to main (it
                // creates the garden on first use), then show the canvas.
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
        collapse()
            ; (document.activeElement as HTMLElement)?.blur()
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // A highlighted suggestion wins; otherwise route the raw text.
        const chosen =
            highlightedIndex >= 0 ? suggestions[highlightedIndex] : undefined
        dispatchIntent(chosen ? chosen.intent : resolveAddressInput(url, slot))
    }

    const handleFocus = () => {
        setIsEditing(true)
        setIsFocused(true)
        setHighlightedIndex(-1)
    }

    const handleBlur = () => {
        collapse()
        // Reset to the current slot's address if editing was cancelled.
        setUrl(displayAddress)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            collapse()
            setUrl(displayAddress)
            ; (e.target as HTMLInputElement).blur()
        } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
            e.preventDefault()
            setHighlightedIndex((i) => (i + 1) % suggestions.length)
        } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
            e.preventDefault()
            setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
        }
    }

    const canGoBack = activeTab !== null
    const canGoForward = activeTab !== null

    // Extract domain and title for display
    const getDomain = () => {
        if (!activeTab?.url) return ''
        try {
            const urlObj = new URL(activeTab.url)
            return urlObj.hostname.replace('www.', '')
        } catch {
            return activeTab.url
        }
    }

    const getPath = () => {
        if (!activeTab?.url) return ''
        try {
            const urlObj = new URL(activeTab.url)
            return urlObj.pathname + urlObj.search + urlObj.hash
        } catch {
            return ''
        }
    }

    const getFavicon = () => {
        if (!activeTab?.url) return null
        try {
            const domain = new URL(activeTab.url).hostname
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        } catch {
            return null
        }
    }

    return (
        <>
            {/* Navigation Controls */}
            <div className="flex gap-1.5 app-region-no-drag">
                <ToolBarButton
                    Icon={ArrowLeft}
                    onClick={goBack}
                    active={canGoBack && !isLoading}
                />
                <ToolBarButton
                    Icon={ArrowRight}
                    onClick={goForward}
                    active={canGoForward && !isLoading}
                />
                <ToolBarButton
                    onClick={reload}
                    active={activeTab !== null && !isLoading}
                >
                    {isLoading ? (
                        <Loader2 className="size-4.5 animate-spin" />
                    ) : (
                        <RefreshCw className="size-4.5" />
                    )}
                </ToolBarButton>
            </div>

            {/* Address Bar */}
            {isFocused ? (
                // Expanded State
                <form onSubmit={handleSubmit} className="relative flex-1 min-w-0 max-w-full app-region-no-drag">
                    <div className="rounded-lg p-1 bg-[#1f2c4d] ring-1 ring-[#5b8cff]/40">
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => {
                                setUrl(e.target.value)
                                setHighlightedIndex(-1)
                            }}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            className="w-full px-1 py-0.5 text-xs outline-none bg-transparent text-[#e7ecf6] truncate placeholder:text-[#64718f]"
                            placeholder="Enter a URL, search term, or blueberry://garden/…"
                            spellCheck={false}
                            autoFocus
                        />
                    </div>

                    {/* Suggestions panel — overflows below the bar into the grown view area. */}
                    {showSuggestions && (
                        <ul className="omnibox-drop absolute left-0 right-0 top-full mt-1 z-50 overflow-hidden rounded-lg bg-[#0a1124] ring-1 ring-white/10 shadow-2xl">
                            {suggestions.map((s, i) => {
                                const Icon =
                                    s.kind === 'garden'
                                        ? Sprout
                                        : s.kind === 'switch-tab'
                                            ? ArrowLeftRight
                                            : s.subtitle === 'Google Search'
                                                ? Search
                                                : Globe
                                return (
                                    <li key={s.id}>
                                        <button
                                            type="button"
                                            // mouseDown (not click) so we act before the input blur collapses the panel.
                                            onMouseDown={(e) => {
                                                e.preventDefault()
                                                dispatchIntent(s.intent)
                                            }}
                                            onMouseEnter={() => setHighlightedIndex(i)}
                                            style={{ height: SUGGESTION_ROW_HEIGHT }}
                                            className={cn(
                                                'flex w-full items-center gap-2.5 px-3 text-left transition-colors',
                                                i === highlightedIndex
                                                    ? 'bg-[#1f2c4d]'
                                                    : 'hover:bg-white/[0.04]'
                                            )}
                                        >
                                            <Icon className="size-4 shrink-0 text-[#5b8cff]" />
                                            <span className="truncate text-[0.8rem] text-[#e7ecf6]">
                                                {s.title}
                                            </span>
                                            {s.subtitle && (
                                                <span className="ml-auto max-w-[45%] truncate text-[0.7rem] text-[#64718f]">
                                                    {s.subtitle}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </form>
            ) : (
                // Collapsed State
                <div
                    onClick={handleFocus}
                    className={cn(
                        "flex-1 px-3 h-8 rounded-md cursor-text group/address-bar",
                        "hover:bg-white/[0.06] text-[#94a3c2] app-region-no-drag",
                        "transition-colors duration-200"
                    )}
                >
                    <div className="flex h-full items-center">
                        {/* Favicon */}
                        <div className="size-4 mr-2">
                            <Favicon src={getFavicon()} />
                        </div>

                        {/* URL Display */}
                        <div className="text-[0.8rem] leading-normal truncate flex-1">
                            {isGardenActive ? (
                                <span className="text-[#e7ecf6]">{gardenAddress()}</span>
                            ) : activeTab ? (
                                <>
                                    <span className="text-[#e7ecf6]">{getDomain()}</span>
                                    <span className="group-hover/address-bar:hidden text-[#64718f]">
                                        {activeTab.title && ` / ${activeTab.title}`}
                                    </span>
                                    <span className="group-hover/address-bar:inline hidden text-[#64718f]">
                                        {getPath()}
                                    </span>
                                </>
                            ) : (
                                <span className="text-[#64718f]">No active tab</span>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {/* Actions Menu */}
            <div className="flex items-center gap-1 app-region-no-drag">
                <DarkModeToggle />
            </div>
        </>
    )
}