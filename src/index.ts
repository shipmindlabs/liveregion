/**
 * liveregion — screen-reader announcements with the queueing, the repeated
 * message and the politeness handled once.
 */

export {
  Announcer,
  DEFAULT_CLEAR_MS,
  type Announcement,
  type Politeness,
  type QueueOptions,
} from "./announcer.ts";

export {
  useAnnouncer,
  VISUALLY_HIDDEN,
  type RegionProps,
  type UseAnnouncer,
} from "./useAnnouncer.ts";

export {
  AnnouncerProvider,
  useAnnounce,
  type AnnouncerProviderProps,
  type UseAnnounce,
} from "./provider.ts";
