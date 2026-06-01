import React from 'react'
import { BrowserProvider } from './contexts/BrowserContext'
import { TabRail } from './components/TabRail'
import { AddressBar } from './components/AddressBar'

/**
 * One renderer, two mounts (selected by ?region):
 *   - region=left : the full-height vertical tab rail (left sidebar)
 *   - otherwise   : the slim top URL/toolbar (to the right of the rail)
 * Tabs no longer live above the URL bar.
 */
export const TopBarApp: React.FC = () => {
    const region = new URLSearchParams(window.location.search).get('region')

    if (region === 'left') {
        return (
            <BrowserProvider>
                <TabRail />
            </BrowserProvider>
        )
    }

    return (
        <BrowserProvider>
            <div className="flex h-full items-center app-region-drag bg-background px-2">
                <AddressBar />
            </div>
        </BrowserProvider>
    )
}
