import type { DigestElement } from "./types";

/** A hit: the chosen element id and how sure we are (0..1). */
export interface ResolveHit {
  id: string;
  confidence: number;
}

/** No element matched the phrase well enough to act on. */
export interface ResolveMiss {
  miss: true;
}

export type ResolveResult = ResolveHit | ResolveMiss;

/**
 * Below this confidence a match is too weak to act on — one incidental shared word
 * ("account" in "delete my account") is a miss, not a target. AgentRunner routes a
 * miss to the vision fallback rather than clicking the wrong thing.
 */
export const MIN_CONFIDENCE = 0.5;

/**
 * Map a natural-language phrase to a single digest element id.
 *
 * Deterministic and pure (no LLM call): scores each element's visible text against
 * the phrase and returns the best match with a confidence, or an explicit miss when
 * nothing is close enough. See PRD "Resolver".
 */
export function resolve(
  phrase: string,
  digest: DigestElement[],
): ResolveResult {
  const target = normalize(phrase);

  let best: ResolveHit | null = null;
  for (const el of digest) {
    const confidence = score(target, normalize(el.text));
    if (confidence > 0 && (best === null || confidence > best.confidence)) {
      best = { id: el.id, confidence };
    }
  }

  if (best === null || best.confidence < MIN_CONFIDENCE) {
    return { miss: true };
  }
  return best;
}

/**
 * Score how well a normalized element text matches the normalized phrase, 0..1.
 *  - 1 for an exact match.
 *  - A fraction for a containment/word-overlap match (always < 1).
 *  - 0 when nothing overlaps.
 */
function score(target: string, text: string): number {
  if (text === target) return 1;

  const phraseWords = target.split(" ").filter(Boolean);
  const textWords = new Set(text.split(" ").filter(Boolean));
  if (phraseWords.length === 0) return 0;

  const overlap = phraseWords.filter((w) => textWords.has(w)).length;
  if (overlap === 0) return 0;

  // Fraction of the phrase's words found in the element, capped below 1.
  return Math.min(0.99, overlap / phraseWords.length);
}

/** Lowercase, collapse whitespace, drop surrounding punctuation for comparison. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
