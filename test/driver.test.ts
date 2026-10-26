import { test } from "node:test";
import assert from "node:assert/strict";

import { Announcer, type QueueOptions } from "../src/announcer.ts";
import { Driver } from "../src/driver.ts";

function driverUnderTest(options: QueueOptions = {}) {
  const painted: Array<[string, string]> = [];
  const driver = new Driver(new Announcer(options), (polite, assertive) => {
    painted.push([polite, assertive]);
  });
  return {
    driver,
    painted,
    regions: (): readonly [string, string] => painted.at(-1) ?? ["", ""],
  };
}

test("each message holds its region for a full clearAfterMs", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { driver, regions } = driverUnderTest();

  driver.announce("A");
  driver.announce("B", "assertive");
  assert.deepEqual(regions(), ["A", ""]);

  t.mock.timers.tick(999);
  assert.deepEqual(regions(), ["A", ""], "the hold is not cut short");

  t.mock.timers.tick(1);
  assert.deepEqual(regions(), ["", "B"], "and the queue moves on exactly then");

  t.mock.timers.tick(999);
  assert.deepEqual(regions(), ["", "B"]);

  t.mock.timers.tick(1);
  assert.deepEqual(regions(), ["", ""], "a drained queue leaves both regions blank");
});

// Resetting the timer on every announce would let a steady stream of messages
// keep the current one on screen for ever while the queue starves behind it.
test("a stream of announces cannot extend the hold on what is showing", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { driver, painted, regions } = driverUnderTest();

  driver.announce("m0");
  t.mock.timers.tick(500);
  driver.announce("m1");
  assert.deepEqual(regions(), ["m0", ""], "a new message does not replace what is showing");

  t.mock.timers.tick(499);
  assert.deepEqual(regions(), ["m0", ""]);
  t.mock.timers.tick(1);
  assert.deepEqual(regions(), ["m1", ""], "replaced at 1000 ms, not at 1500");

  driver.announce("m2");
  for (let i = 3; i < 10; i++) {
    t.mock.timers.tick(500);
    driver.announce(`m${i}`);
  }
  for (let i = 0; i < 12; i++) t.mock.timers.tick(1000);

  const shown = painted
    .map(([polite]) => polite)
    .filter((text, index, all) => text !== all[index - 1]);
  assert.deepEqual(
    shown,
    [...Array.from({ length: 10 }, (_, i) => `m${i}`), ""],
    "ten announces at half the hold are still read once each, in order",
  );
});

test("clear blanks both regions and cancels the armed drain", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { driver, painted, regions } = driverUnderTest();

  driver.announce("A");
  driver.announce("B", "assertive");
  t.mock.timers.tick(500);
  driver.clear();
  assert.deepEqual(regions(), ["", ""]);

  const paints = painted.length;
  t.mock.timers.tick(5000);
  assert.equal(painted.length, paints, "a cancelled drain paints nothing later");
});
