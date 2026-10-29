/**
 * The part of the React binding that is not React: the queue plus the timer
 * that drains it.
 *
 * It lives here, and not in a ref inside the hook, because the timing rules are
 * the awkward part — a hold that lasts a full `clearAfterMs`, a drain that a new
 * message cannot push back, a blank announce that arms nothing — and they can be
 * tested with mock timers and a recording `paint` instead of a renderer.
 */

import type { Announcer, Politeness } from "./announcer.ts";

/** Called with what each region should contain; empty string means blank. */
export type Paint = (polite: string, assertive: string) => void;

export class Driver {
  #queue: Announcer;
  #paint: Paint;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(queue: Announcer, paint: Paint) {
    this.#queue = queue;
    this.#paint = paint;
  }

  announce(message: string, politeness: Politeness = "polite"): void {
    this.#queue.announce(message, politeness);
    this.#repaint();
    this.#pump();
  }

  /** Drop everything and blank both regions, e.g. on unmount mid-flow. */
  clear(): void {
    this.#queue.clear();
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#repaint();
  }

  #repaint(): void {
    const current = this.#queue.current;
    this.#paint(
      current?.politeness === "polite" ? current.text : "",
      current?.politeness === "assertive" ? current.text : "",
    );
  }

  #pump(): void {
    // Nothing is showing, so there is nothing for a drain to clear. The queue
    // ignores a blank message, and arming a drain for it anyway would cut the
    // next real message short: it would be cleared when that earlier timer
    // fires, after a fraction of its own hold.
    if (!this.#queue.current) return;
    // A drain is already armed: leave it alone. Resetting the timer on every
    // announce would let a steady stream of messages keep the current one on
    // screen for ever while the queue starves behind it.
    if (this.#timer !== null) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#queue.advance();
      this.#repaint();
      this.#pump();
    }, this.#queue.clearAfterMs);
  }
}
