# liveregion

Screen-reader announcements for React, with the three parts everyone gets wrong
handled once.

An ARIA live region looks like a one-liner and behaves like a queue with
hardware quirks.

```console
$ npm run demo
queued, in order:

  1. [polite   ] "Filtering"
  2. [polite   ] "3 results"
  3. [polite   ] "3 results"  (made distinct so it is read again)
  4. [assertive] "Payment declined"

  region cleared

without queueing, a screen reader would have announced:
  "Payment declined"   — the last write wins, the rest are lost
```

**Two messages in one frame become one.** The region's text is replaced, and the
screen reader announces what it finds when it looks — the second message, never
the first. So messages are queued and delivered with a gap, in order.

**The same text twice is silence.** Setting a node's text to what it already
says is not a change. "3 results" after "3 results" announces nothing, and the
user concludes the filter did not run. A repeat is made distinct with a trailing
zero-width space: not read out, no effect on layout, and the change is real.

**`assertive` interrupts whatever is being read.** It is for something that has
gone wrong right now. Using it for *saved successfully* makes an application
exhausting to use, so politeness is per message and the default is polite.

## Use

```tsx
function App() {
  const { announce, politeProps, assertiveProps } = useAnnouncer();

  return (
    <>
      <button onClick={() => announce(`${count} results`)}>Filter</button>
      <button onClick={() => announce("Payment declined", "assertive")}>Pay</button>

      <div {...politeProps} />
      <div {...assertiveProps} />
    </>
  );
}
```

Both regions are rendered from the start. A region's politeness is read when the
page loads, not when its text changes, so a single region that switches between
polite and assertive does not work in several screen readers.

## The hiding style

`VISUALLY_HIDDEN` is exported because this is the other common reason an
announcement is never heard: `display: none` and `visibility: hidden` remove the
element from the accessibility tree entirely. The clip-based technique keeps it
there.

## What it is not

**Not a toast component.** No markup for anything a sighted user sees. If a
message needs to be visible too, render it yourself and announce it here.

**Not a router announcer.** Announcing page changes on navigation is a related
job with its own timing problems, and it is not in here yet.

**Not a substitute for testing with a screen reader.** The behaviours above come
from how the specification and real readers work, and this library gets them
consistent — it cannot tell you whether the message you wrote is the one someone
needs to hear.

## Status

| | |
|---|---|
| Core | ordered queue, no merging, repeated messages made distinct, per-message politeness, trimming, clearing |
| React | `useAnnouncer` with both regions, a timer that drains the queue, cleanup on unmount |
| Not yet | route-change announcements, per-message timing, a debug mode that logs what was announced |

The queue is a plain class with no timers of its own, which is why the awkward
cases are testable without waiting for anything.

## Development

```bash
npm test        # node --test, including a real React render
npm run demo
npm run typecheck
```

## License

MIT
