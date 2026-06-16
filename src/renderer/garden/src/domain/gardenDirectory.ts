/**
 * Garden directory (PRD stories 18–22): multiple Gardens, a default project
 * Garden, and a Scratch garden for casual browsing. Pure helpers — main owns
 * the per-garden stores; this module only knows how Berries move between
 * garden states.
 */
import type { GardenState } from "./gardenDomain";

/** Casual-browsing garden — pages live here until promoted to a project. */
export const SCRATCH_GARDEN = "Scratch";

/** Gardens that always exist (story 19/20/21). */
export const DEFAULT_GARDENS = [SCRATCH_GARDEN, "Default"];

/**
 * Promote a Berry (usually a Scratch tab) into another garden (story 22):
 * removed from `from`, pinned onto `to`'s map. No-op if the Berry is missing.
 */
export const promoteBerry = (
  from: GardenState,
  to: GardenState,
  berryId: string,
): { from: GardenState; to: GardenState } => {
  const berry = from.berries.find((candidate) => candidate.id === berryId);
  if (!berry) return { from, to };

  return {
    from: {
      ...from,
      berries: from.berries.filter((candidate) => candidate.id !== berryId),
    },
    to: {
      ...to,
      berries: [...to.berries, { ...berry, onMap: true }],
    },
  };
};
