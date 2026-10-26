/**
 * The React binding: a hook that owns the queue and a description of the two
 * regions a page needs.
 *
 * Two, not one. A region's politeness is read when the page loads, not when the
 * text changes, so switching a single region between polite and assertive does
 * not work in several screen readers. Both regions exist from the start and the
 * message goes to the right one.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Announcer, type Politeness, type QueueOptions } from "./announcer.ts";
import { Driver } from "./driver.ts";

export type RegionProps = {
  readonly "aria-live": Politeness;
  /** Read the region's whole contents, not just what changed. */
  readonly "aria-atomic": "true";
  readonly role: "status" | "alert";
  readonly style: Readonly<Record<string, string | number>>;
  readonly children: string;
};

/**
 * The way to hide a live region visually while leaving it available to a screen
 * reader. `display: none` and `visibility: hidden` remove it from the
 * accessibility tree entirely, which is the most common reason an announcement
 * is never heard.
 */
export const VISUALLY_HIDDEN: Readonly<Record<string, string | number>> = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

export type UseAnnouncer = {
  announce(message: string, politeness?: Politeness): void;
  clear(): void;
  /** Spread onto the polite region element. */
  readonly politeProps: RegionProps;
  /** Spread onto the assertive region element. */
  readonly assertiveProps: RegionProps;
};

export function useAnnouncer(options: QueueOptions = {}): UseAnnouncer {
  const { clearAfterMs, deduplicate } = options;
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");

  const driver = useMemo(
    () =>
      new Driver(
        new Announcer({ clearAfterMs, deduplicate }),
        (nextPolite, nextAssertive) => {
          setPolite(nextPolite);
          setAssertive(nextAssertive);
        },
      ),
    [clearAfterMs, deduplicate],
  );

  const announce = useCallback(
    (message: string, politeness: Politeness = "polite") => {
      driver.announce(message, politeness);
    },
    [driver],
  );

  const clear = useCallback(() => {
    driver.clear();
  }, [driver]);

  useEffect(() => {
    return () => {
      driver.clear();
    };
  }, [driver]);

  return {
    announce,
    clear,
    politeProps: {
      "aria-live": "polite",
      "aria-atomic": "true",
      role: "status",
      style: VISUALLY_HIDDEN,
      children: polite,
    },
    assertiveProps: {
      "aria-live": "assertive",
      "aria-atomic": "true",
      role: "alert",
      style: VISUALLY_HIDDEN,
      children: assertive,
    },
  };
}
