import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AnnouncerProvider, useAnnounce } from "../src/index.ts";

function Consumer() {
  const { announce } = useAnnounce();
  return createElement("button", { onClick: () => announce("Saved") }, "Save");
}

function occurrences(html: string, pattern: RegExp): number {
  return html.match(pattern)?.length ?? 0;
}

// Two calls to useAnnouncer mean two pairs of regions fed by two queues, and
// two messages can then change regions in the same frame.
test("two consumers under one provider share a single pair of regions", () => {
  const html = renderToStaticMarkup(
    createElement(
      AnnouncerProvider,
      null,
      createElement(Consumer),
      createElement(Consumer),
    ),
  );

  assert.equal(occurrences(html, /aria-live="polite"/g), 1);
  assert.equal(occurrences(html, /aria-live="assertive"/g), 1);
  assert.equal(occurrences(html, /<button/g), 2, "both consumers rendered");
});

// A layout that provides and a route that provides again is how a page ends up
// with two queues by accident.
test("a provider inside another adds no regions of its own", () => {
  const html = renderToStaticMarkup(
    createElement(
      AnnouncerProvider,
      null,
      createElement(
        AnnouncerProvider,
        { clearAfterMs: 50 },
        createElement(Consumer),
      ),
    ),
  );

  assert.equal(occurrences(html, /aria-live="polite"/g), 1);
  assert.equal(occurrences(html, /aria-live="assertive"/g), 1);
  assert.equal(occurrences(html, /<button/g), 1, "the inner children still render");
});

test("announcing without a provider says which one is missing", () => {
  assert.throws(() => renderToStaticMarkup(createElement(Consumer)), /AnnouncerProvider/);
});
