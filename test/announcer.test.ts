import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Announcer, useAnnouncer, VISUALLY_HIDDEN } from "../src/index.ts";

// Two messages written in the same frame become one: the region's text is
// replaced, and the reader announces what it finds, which is the second.
test("messages are queued rather than overwriting each other", () => {
  const announcer = new Announcer();
  announcer.announce("Saving").announce("Saved").announce("Sent");

  assert.equal(announcer.current?.message, "Saving");
  assert.deepEqual(
    announcer.waiting.map((a) => a.message),
    ["Saved", "Sent"],
  );

  assert.equal(announcer.advance()?.message, "Saved");
  assert.equal(announcer.advance()?.message, "Sent");
  assert.equal(announcer.advance(), null, "the region is cleared once the queue drains");
});

// Setting a node's text to what it already says is not a change, so a screen
// reader stays silent - and the user thinks the filter did not run.
test("the same message twice is made distinct so it is announced twice", () => {
  const announcer = new Announcer();
  announcer.announce("3 results");
  const first = announcer.current!;
  announcer.announce("3 results");
  const second = announcer.waiting[0]!;

  assert.equal(first.message, second.message, "the message a user hears is the same");
  assert.notEqual(first.text, second.text, "the text written to the DOM must differ");
  // The distinguishing character is not read out and does not affect layout.
  assert.equal(second.text.replace(/​/g, ""), "3 results");
});

test("deduplication can be switched off for a caller who handles it", () => {
  const announcer = new Announcer({ deduplicate: false });
  announcer.announce("3 results");
  announcer.announce("3 results");
  assert.equal(announcer.current?.text, announcer.waiting[0]?.text);
});

test("politeness levels do not interfere with each other's repeats", () => {
  const announcer = new Announcer();
  announcer.announce("Busy", "polite");
  announcer.announce("Busy", "assertive");

  // Different regions, so neither needs distinguishing from the other.
  assert.equal(announcer.current?.text, "Busy");
  assert.equal(announcer.waiting[0]?.text, "Busy");
});

test("an empty message is ignored rather than queued", () => {
  const announcer = new Announcer();
  announcer.announce("").announce("   ").announce("\n");
  assert.equal(announcer.current, null);
  assert.equal(announcer.waiting.length, 0);
});

test("messages are trimmed, because a stray newline is not content", () => {
  const announcer = new Announcer();
  announcer.announce("  Saved  ");
  assert.equal(announcer.current?.message, "Saved");
});

test("clearing drops everything, including what is showing", () => {
  const announcer = new Announcer();
  announcer.announce("one").announce("two");
  announcer.clear();
  assert.equal(announcer.current, null);
  assert.equal(announcer.waiting.length, 0);
});

test("each announcement carries its own politeness", () => {
  const announcer = new Announcer();
  announcer.announce("Loading", "polite");
  announcer.announce("Payment failed", "assertive");

  assert.equal(announcer.current?.politeness, "polite");
  assert.equal(announcer.waiting[0]?.politeness, "assertive");
});

// A region's politeness is read when the page loads, not when its text changes,
// so one region that switches modes does not work in several screen readers.
test("the hook renders both regions from the start", () => {
  function Announcements() {
    const { politeProps, assertiveProps } = useAnnouncer();
    return createElement("div", null, [
      createElement("div", { ...politeProps, key: "polite" }),
      createElement("div", { ...assertiveProps, key: "assertive" }),
    ]);
  }

  const html = renderToStaticMarkup(createElement(Announcements));
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /role="status"/);
  assert.match(html, /role="alert"/);
  // Whole contents read, not just the changed part.
  assert.equal(html.match(/aria-atomic="true"/g)?.length, 2);
});

// display:none and visibility:hidden remove the region from the accessibility
// tree, which is the most common reason an announcement is never heard.
test("the hiding style keeps the region in the accessibility tree", () => {
  assert.equal(VISUALLY_HIDDEN.display, undefined);
  assert.equal(VISUALLY_HIDDEN.visibility, undefined);
  assert.equal(VISUALLY_HIDDEN.position, "absolute");
  assert.equal(VISUALLY_HIDDEN.width, 1);
  assert.equal(VISUALLY_HIDDEN.clipPath, "inset(50%)");
});
