import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Pencil, Plus, Sprout, Trash2, X } from 'lucide-react'

/** Gardens reserved from rename/delete (mirrors main's SCRATCH_GARDEN). */
const SCRATCH_GARDEN = 'Scratch'

const ROW_HEIGHT = 34
const FOOTER_HEIGHT = 40
const PANEL_PADDING = 12

interface GardenSwitcherProps {
    /** Show the Garden canvas after a switch (keeps BrowserContext in sync). */
    onShowGarden: () => void
}

/**
 * Garden directory dropdown — lives in the top bar, right of the URL bar, so
 * it is reachable from both the Garden and any live tab. Gardens are peers
 * (not nested), and this is the full CRUD surface: switch, create, rename,
 * delete. ⌘1–9 on the Garden canvas remain the keyboard equivalent of switch.
 *
 * The top bar is a fixed-height WebContentsView, so — like the omnibox — the
 * open panel grows the bar via setAddressExpanded, otherwise it is clipped.
 */
export const GardenSwitcher: React.FC<GardenSwitcherProps> = ({ onShowGarden }) => {
    const [open, setOpen] = useState(false)
    const [gardens, setGardens] = useState<string[]>([])
    const [active, setActive] = useState('')
    const [creating, setCreating] = useState(false)
    const [renaming, setRenaming] = useState<string | null>(null)
    const [draft, setDraft] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    const sync = (dir: { active: string; gardens: string[] }): void => {
        setActive(dir.active)
        setGardens(dir.gardens)
    }

    // Seed on mount; re-sync when the content slot changes (the active garden
    // may have changed via ⌘1–9 on the canvas while we weren't looking).
    useEffect(() => {
        window.topBarAPI.listGardens().then(sync).catch(() => {})
        return window.topBarAPI.onSlotChanged(() => {
            window.topBarAPI.listGardens().then(sync).catch(() => {})
        })
    }, [])

    // Grow the top bar to fit the open panel (it would otherwise be clipped by
    // the slim top-bar view). Restore to 0 when closed.
    useEffect(() => {
        const rows = gardens.length + (creating ? 1 : 0)
        const height = open ? rows * ROW_HEIGHT + FOOTER_HEIGHT + PANEL_PADDING : 0
        window.topBarAPI.setAddressExpanded(height)
        return () => {
            window.topBarAPI.setAddressExpanded(0)
        }
    }, [open, gardens.length, creating])

    // Reset transient edit state whenever the panel closes.
    useEffect(() => {
        if (!open) {
            setCreating(false)
            setRenaming(null)
            setDraft('')
        }
    }, [open])

    const handleSwitch = async (name: string): Promise<void> => {
        if (name !== active) {
            const dir = await window.topBarAPI.switchGarden(name)
            sync(dir)
        }
        onShowGarden()
        setOpen(false)
    }

    const commitCreate = async (): Promise<void> => {
        const name = draft.trim()
        if (name) sync(await window.topBarAPI.createGarden(name))
        setCreating(false)
        setDraft('')
    }

    const commitRename = async (from: string): Promise<void> => {
        const to = draft.trim()
        if (to && to !== from) sync(await window.topBarAPI.renameGarden(from, to))
        setRenaming(null)
        setDraft('')
    }

    const handleDelete = async (name: string): Promise<void> => {
        sync(await window.topBarAPI.deleteGarden(name))
    }

    const projectCount = gardens.filter((n) => n !== SCRATCH_GARDEN).length

    return (
        <div ref={containerRef} className="relative app-region-no-drag shrink-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-md px-2.5 h-8 text-xs text-[#e7ecf6] hover:bg-white/[0.06] transition-colors"
                title="Switch Garden (⌘1–9)"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <Sprout className="size-4 shrink-0 text-[#5b8cff]" />
                <span className="max-w-[10rem] truncate">{active || 'Gardens'}</span>
                <ChevronDown
                    className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div
                    className="omnibox-drop absolute right-0 top-full mt-1 z-50 w-64 overflow-hidden rounded-lg bg-[#0a1124] ring-1 ring-white/10 shadow-2xl"
                    role="listbox"
                    aria-label="Gardens"
                >
                    <ul className="py-1">
                        {gardens.map((name) => {
                            const isActive = name === active
                            const reserved = name === SCRATCH_GARDEN
                            const lastProject = !reserved && projectCount <= 1
                            if (renaming === name) {
                                return (
                                    <li key={name} className="px-2 py-1">
                                        <NameInput
                                            value={draft}
                                            onChange={setDraft}
                                            onCommit={() => void commitRename(name)}
                                            onCancel={() => {
                                                setRenaming(null)
                                                setDraft('')
                                            }}
                                        />
                                    </li>
                                )
                            }
                            return (
                                <li key={name} className="group/row flex items-center px-1">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isActive}
                                        onClick={() => void handleSwitch(name)}
                                        style={{ height: ROW_HEIGHT }}
                                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-xs transition-colors ${
                                            isActive
                                                ? 'text-[#5b8cff]'
                                                : 'text-[#cdd6ec] hover:bg-white/[0.05]'
                                        }`}
                                    >
                                        <span className="min-w-0 flex-1 truncate">{name}</span>
                                        {isActive && <Check className="size-3.5 shrink-0" />}
                                    </button>
                                    {!reserved && (
                                        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/row:opacity-100">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRenaming(name)
                                                    setDraft(name)
                                                }}
                                                className="rounded p-1 text-[#64718f] hover:text-[#e7ecf6]"
                                                title={`Rename ${name}`}
                                            >
                                                <Pencil className="size-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleDelete(name)}
                                                disabled={lastProject}
                                                className="rounded p-1 text-[#64718f] hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-[#64718f]"
                                                title={
                                                    lastProject
                                                        ? 'Cannot delete the last Garden'
                                                        : `Delete ${name}`
                                                }
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </li>
                            )
                        })}
                    </ul>

                    <div className="border-t border-white/10 p-1">
                        {creating ? (
                            <div className="px-1 py-0.5">
                                <NameInput
                                    value={draft}
                                    onChange={setDraft}
                                    placeholder="New garden name…"
                                    onCommit={() => void commitCreate()}
                                    onCancel={() => {
                                        setCreating(false)
                                        setDraft('')
                                    }}
                                />
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setCreating(true)
                                    setDraft('')
                                }}
                                style={{ height: FOOTER_HEIGHT - 8 }}
                                className="flex w-full items-center gap-2 rounded-md px-2 text-xs text-[#94a3c2] hover:bg-white/[0.05] hover:text-[#e7ecf6] transition-colors"
                            >
                                <Plus className="size-3.5" />
                                New garden
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

/** Inline name editor shared by create + rename — Enter commits, Esc cancels. */
const NameInput: React.FC<{
    value: string
    onChange: (v: string) => void
    onCommit: () => void
    onCancel: () => void
    placeholder?: string
}> = ({ value, onChange, onCommit, onCancel, placeholder }) => (
    <div className="flex items-center gap-1 rounded-md bg-[#1f2c4d] px-1.5 ring-1 ring-[#5b8cff]/40">
        <input
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    onCommit()
                } else if (e.key === 'Escape') {
                    e.preventDefault()
                    onCancel()
                }
            }}
            className="h-7 min-w-0 flex-1 bg-transparent text-xs text-[#e7ecf6] outline-none placeholder:text-[#64718f]"
        />
        <button
            type="button"
            onClick={onCommit}
            className="rounded p-1 text-[#5b8cff] hover:bg-white/[0.06]"
            aria-label="Confirm"
        >
            <Check className="size-3.5" />
        </button>
        <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-[#64718f] hover:bg-white/[0.06] hover:text-[#e7ecf6]"
            aria-label="Cancel"
        >
            <X className="size-3.5" />
        </button>
    </div>
)
