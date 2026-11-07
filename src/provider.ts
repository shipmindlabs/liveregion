/**
 * One pair of regions per page.
 *
 * Two components that each call `useAnnouncer` render two pairs of regions fed
 * by two independent queues, so two messages can change regions in the same
 * frame and whether both of them are read is up to the screen reader. The
 * one-at-a-time guarantee holds within one queue, not across two. So the
 * provider owns the queue and renders the regions once, and everything below
 * it only announces.
 */

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Announcer, type Politeness, type QueueOptions } from "./announcer.ts";
import { Driver } from "./driver.ts";
import { VISUALLY_HIDDEN, type RegionProps } from "./useAnnouncer.ts";

export type UseAnnounce = {
  announce(message: string, politeness?: Politeness): void;
  clear(): void;
};

export type AnnouncerProviderProps = QueueOptions & {
  readonly children?: ReactNode;
};

const AnnouncerContext = createContext<UseAnnounce | null>(null);

function regionProps(politeness: Politeness, text: string): RegionProps {
  return {
    "aria-live": politeness,
    "aria-atomic": "true",
    role: politeness === "polite" ? "status" : "alert",
    style: VISUALLY_HIDDEN,
    children: text,
  };
}

/**
 * Own the queue, render the two regions after `children`, and let anything
 * below announce through `useAnnounce`.
 *
 * A provider inside another renders only its children: its consumers share the
 * outer queue, and the options passed to the inner one are ignored. Nesting is
 * how a page ends up with two queues by accident — a layout that provides and
 * a route that provides again — and the point of this component is that there
 * is one.
 */
export function AnnouncerProvider({
  children,
  ...options
}: AnnouncerProviderProps): ReactNode {
  const outer = useContext(AnnouncerContext);
  const { clearAfterMs, deduplicate } = options;
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");

  // One driver for the life of the provider, not one per options object: a
  // parent that re-renders with a fresh `{ clearAfterMs }` must not drop what
  // is queued.
  const [driver] = useState(
    () =>
      new Driver(
        new Announcer({ clearAfterMs, deduplicate }),
        (nextPolite, nextAssertive) => {
          setPolite(nextPolite);
          setAssertive(nextAssertive);
        },
      ),
  );

  const nested = outer !== null;

  // As in the hook: the effect can run more than once for the same driver, so
  // the cleanup cancels the pending drain and the next run resumes from it.
  useEffect(() => {
    if (nested) return;
    driver.start();
    return () => {
      driver.stop();
    };
  }, [driver, nested]);

  const value = useMemo<UseAnnounce>(
    () => ({
      announce: (message, politeness) => {
        driver.announce(message, politeness);
      },
      clear: () => {
        driver.clear();
      },
    }),
    [driver],
  );

  if (outer) return children;

  return createElement(
    AnnouncerContext.Provider,
    { value },
    children,
    createElement("div", regionProps("polite", polite)),
    createElement("div", regionProps("assertive", assertive)),
  );
}

/** Announce into the queue of the nearest `AnnouncerProvider` above. */
export function useAnnounce(): UseAnnounce {
  const value = useContext(AnnouncerContext);
  if (!value) {
    throw new Error(
      "useAnnounce must be called below an AnnouncerProvider, which owns the queue and renders the two live regions.",
    );
  }
  return value;
}
