/**
 * Announcements for screen readers, with the parts everyone gets wrong handled
 * once.
 *
 * An ARIA live region looks like a one-liner and behaves like a queue with
 * hardware quirks:
 *
 *   * Two messages written in the same frame become one. The region's text is
 *     replaced, and a screen reader announces what it finds when it looks —
 *     which is the second message, and never the first.
 *   * The same text twice is silence. Setting a node's text to what it already
 *     says is not a change, so "3 results" after "3 results" says nothing, and
 *     the user is left thinking the filter did not run.
 *   * `assertive` interrupts whatever the user is reading. It is for something
 *     that has gone wrong right now, and using it for a saved-successfully
 *     message makes an application exhausting to use.
 *
 * This module is the queue and the rules. It touches no DOM, so the awkward
 * parts are testable.
 */

export type Politeness = "polite" | "assertive";

export type Announcement = {
  readonly message: string;
  readonly politeness: Politeness;
  /** Distinct text for a repeated message; see `deduplicate`. */
  readonly text: string;
  readonly id: number;
};

export type QueueOptions = {
  /**
   * How long a message stays in the region before it is cleared. Too short and
   * a slow reader misses it; too long and stale text is read when the user
   * navigates back to the region.
   */
  readonly clearAfterMs?: number;
  /**
   * Make a repeated message distinct so it is announced again. On by default,
   * because a filter that returns "3 results" twice must say so twice.
   */
  readonly deduplicate?: boolean;
};

export const DEFAULT_CLEAR_MS = 1000;

/**
 * A queue that hands out one announcement at a time.
 *
 * Messages are not merged and not dropped: each one is delivered, in order,
 * with a gap between them, because that is the only way a screen reader reads
 * all of them.
 */
export class Announcer {
  #queue: Announcement[] = [];
  #current: Announcement | null = null;
  #counter = 0;
  #lastText = new Map<Politeness, string>();
  #options: Required<QueueOptions>;

  constructor(options: QueueOptions = {}) {
    this.#options = {
      clearAfterMs: options.clearAfterMs ?? DEFAULT_CLEAR_MS,
      deduplicate: options.deduplicate ?? true,
    };
  }

  get clearAfterMs(): number {
    return this.#options.clearAfterMs;
  }

  /** What the region should currently contain, or null for empty. */
  get current(): Announcement | null {
    return this.#current;
  }

  get waiting(): readonly Announcement[] {
    return this.#queue;
  }

  /**
   * Queue a message. An empty or whitespace-only message is ignored rather than
   * queued: clearing the region is what `advance` does, and announcing nothing
   * is not a thing a user can hear.
   */
  announce(message: string, politeness: Politeness = "polite"): this {
    const trimmed = message.trim();
    if (trimmed === "") return this;

    this.#queue.push({
      message: trimmed,
      politeness,
      text: this.#distinct(trimmed, politeness),
      id: ++this.#counter,
    });
    if (!this.#current) this.advance();
    return this;
  }

  /**
   * Move to the next message, or clear the region when none is left.
   *
   * Called by the host on a timer. Keeping it explicit means the queue has no
   * timers of its own, and a test does not have to wait for one.
   */
  advance(): Announcement | null {
    this.#current = this.#queue.shift() ?? null;
    return this.#current;
  }

  /** Drop everything, e.g. when the component unmounts mid-flow. */
  clear(): this {
    this.#queue = [];
    this.#current = null;
    return this;
  }

  /**
   * Setting a node's text to what it already says is not a change, so a
   * screen reader stays silent. A trailing zero-width space makes the text
   * distinct without changing a single thing the user hears — it is not read
   * out, and it does not affect the visual layout of a visually hidden region.
   */
  #distinct(message: string, politeness: Politeness): string {
    if (!this.#options.deduplicate) return message;
    const previous = this.#lastText.get(politeness);
    const text = previous === message ? message + "​" : message;
    this.#lastText.set(politeness, text);
    return text;
  }
}
