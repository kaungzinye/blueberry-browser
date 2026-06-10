import React, { useState } from 'react'
import { PanelLeft, PanelLeftClose } from 'lucide-react'
import { BrowserProvider } from './contexts/BrowserContext'
import { TabRail } from './components/TabRail'
import { AddressBar } from './components/AddressBar'
import { cn } from '@common/lib/utils'

/**
 * One renderer, two mounts (selected by ?region):
 *   - region=left : the full-height vertical tab rail (left sidebar)
 *   - otherwise   : the slim top URL/toolbar (to the right of the rail)
 * Tabs no longer live above the URL bar.
 */
export const TopBarApp: React.FC = () => {
    const region = new URLSearchParams(window.location.search).get('region')
    const [railCollapsed, setRailCollapsed] = useState(false)

    if (region === 'left') {
        return (
            <BrowserProvider>
                <TabRail />
            </BrowserProvider>
        )
    }

    const toggleRail = () => {
        window.topBarAPI?.toggleRail().then(setRailCollapsed)
    }

    return (
        <BrowserProvider>
            <div
                className={cn(
                    // Fixed-height bar pinned to the top; when the omnibox panel
                    // opens the view grows below this row (overflow stays visible).
                    // NOTE: use pr-2 + an explicit pl-* (never px-2 alongside a
                    // conditional pl-*) — two padding-left utilities collide and
                    // Tailwind's output order decides the winner, which left the
                    // toggle button under the macOS traffic lights and unclickable.
                    'relative flex h-12 shrink-0 items-center gap-1 app-region-drag bg-[#080d1a] text-[#e7ecf6] pr-2',
                    // When the rail is collapsed the bar spans to window x=0, so
                    // push the controls clear of the native traffic-light /
                    // window-control zone at the far left (~x≤88). 8px otherwise.
                    railCollapsed ? 'pl-[96px]' : 'pl-2'
                )}
            >
                <button
                    type="button"
                    onClick={toggleRail}
                    className="app-region-no-drag flex size-7 shrink-0 items-center justify-center rounded-md text-[#94a3c2] transition-colors hover:bg-white/[0.06] hover:text-[#e7ecf6]"
                    title={railCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                    aria-label={railCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                >
                    {railCollapsed ? (
                        <PanelLeft className="size-4" />
                    ) : (
                        <PanelLeftClose className="size-4" />
                    )}
                </button>
                <AddressBar />
            </div>
        </BrowserProvider>
    )
}
