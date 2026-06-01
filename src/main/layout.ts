/**
 * Browser chrome layout constants (single source of truth for view bounds).
 *
 * Layout: a full-height left tab rail, a slim top URL/toolbar to the right of
 * the rail, the active tab filling the middle, and a slim Command Bar at the
 * bottom. Chat is the Command Bar — there is no right chat sidebar.
 */
export const LEFT_RAIL_WIDTH = 240;
export const TOPBAR_HEIGHT = 48;
/** Slim bottom Command Bar (collapsed). */
export const COMMAND_BAR_HEIGHT = 56;
/** Command Bar when expanded to show full chat history. */
export const COMMAND_BAR_EXPANDED_HEIGHT = 400;
/** @deprecated Right sidebar is phased out. Width kept for zero-size hide. */
export const CHAT_SIDEBAR_WIDTH = 400;
