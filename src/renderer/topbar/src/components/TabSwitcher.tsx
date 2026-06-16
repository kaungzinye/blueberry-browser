import React, { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'

interface SwitcherItem {
    id: string
    title: string
    url: string
    preview?: string
}

interface SwitcherState {
    open: boolean
    index: number
    items: SwitcherItem[]
}

const faviconFor = (url: string): string | null => {
    try {
        return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`
    } catch {
        return null
    }
}

const labelFor = (item: SwitcherItem): string => {
    if (item.title) return item.title
    try {
        const host = new URL(item.url).hostname.replace('www.', '')
        return host || 'New Tab'
    } catch {
        return 'New Tab'
    }
}

/**
 * Arc-style hold-Ctrl tab switcher: a centered grid of tab previews over a
 * dimmed backdrop. The top-bar view is grown to cover the content area and
 * focused, so the live keys are reliable DOM events here — Tab/Shift+Tab step
 * the selection, releasing Ctrl (or Enter / click) commits, Esc cancels. Main
 * owns the MRU order + selection (the tested model) and pushes state in.
 */
export const TabSwitcher: React.FC = () => {
    const [state, setState] = useState<SwitcherState>({
        open: false,
        index: 0,
        items: [],
    })

    useEffect(() => window.topBarAPI.onTabSwitcher(setState), [])

    // Live keys while the switcher is open. The overlay holds focus, so these
    // DOM events fire reliably (unlike modifier keyup via before-input-event).
    useEffect(() => {
        if (!state.open) return
        const onKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Tab') {
                e.preventDefault()
                window.topBarAPI.switcherCycle(e.shiftKey ? -1 : 1)
            } else if (e.key === 'Enter') {
                e.preventDefault()
                window.topBarAPI.switcherCommit()
            } else if (e.key === 'Escape') {
                e.preventDefault()
                window.topBarAPI.switcherCancel()
            }
        }
        const onKeyUp = (e: KeyboardEvent): void => {
            if (e.key === 'Control' || e.key === 'Meta') {
                window.topBarAPI.switcherCommit()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
        }
    }, [state.open])

    if (!state.open || state.items.length === 0) return null

    return (
        <div className="app-region-no-drag fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-sm">
            <div className="w-full max-w-3xl px-8">
                <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[#94a3c2]">
                    Switch tabs
                </p>
                <div className="grid grid-cols-3 gap-3">
                    {state.items.map((item, i) => {
                        const selected = i === state.index
                        const favicon = faviconFor(item.url)
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => window.topBarAPI.switcherPick(item.id)}
                                className={`flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
                                    selected
                                        ? 'border-[#5b8cff] ring-2 ring-[#5b8cff]/50 bg-[#1f2c4d]'
                                        : 'border-white/10 bg-[#0c1630] hover:border-white/25'
                                }`}
                            >
                                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0a1124]">
                                    {item.preview ? (
                                        <img
                                            src={item.preview}
                                            alt=""
                                            className="h-full w-full object-cover object-top"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[#64718f]">
                                            <Globe className="size-6 opacity-50" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 px-2.5 py-2">
                                    {favicon ? (
                                        <img
                                            src={favicon}
                                            alt=""
                                            className="size-3.5 shrink-0 rounded-sm"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none'
                                            }}
                                        />
                                    ) : (
                                        <Globe className="size-3.5 shrink-0 text-[#64718f]" />
                                    )}
                                    <span
                                        className={`min-w-0 flex-1 truncate text-xs ${
                                            selected ? 'text-[#e7ecf6]' : 'text-[#94a3c2]'
                                        }`}
                                    >
                                        {labelFor(item)}
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </div>
                <p className="mt-4 text-center font-mono text-[10px] text-[#64718f]">
                    hold Ctrl · Tab to advance · release to open
                </p>
            </div>
        </div>
    )
}
