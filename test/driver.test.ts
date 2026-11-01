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

// The queue ignores a blank message, so there is nothing for a drain to clear.
test("a blank announce arms no drain", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { driver, painted, regions } = driverUnderTest();

  driver.announce("  ");
  const paints = painted.length;

  t.mock.timers.tick(5000);
  assert.equal(painted.length, paints, "nothing was queued, so nothing fires later");
  assert.deepEqual(regions(), ["", ""]);
});

test("a message after a blank announce still gets its full hold", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { driver, regions } = driverUnderTest();

  driver.announce("  ");
  t.mock.timers.tick(900);
  driver.announce("Saved");
  assert.deepEqual(regions(), ["Saved", ""]);

  t.mock.timers.tick(999);
  assert.deepEqual(
    regions(),
    ["Saved", ""],
    "still painted at 1899 ms: no drain was armed at 0",
  );

  t.mock.timers.tick(1);
  assert.deepEqual(regions(), ["", ""], "cleared at 1900 ms, a full hold after it arrived");
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

// An effect that cleared the timeout but kept the handle left pump() believing
// a drain was armed, so the region held its text until someone called clear().
test("a stopped drain is forgotten, so start arms a new one", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { driver, regions } = driverUnderTest();

  driver.announce("A");
  driver.announce("B", "assertive");
  driver.stop();
  driver.start();

  t.mock.timers.tick(1000);
  assert.deepEqual(regions(), ["", "B"], "the queue moves on after an effect re-run");
});

test("a stopped driver queues without arming a drain", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { driver, regions } = driverUnderTest();

  driver.announce("A");
  driver.stop();
  driver.announce("C");

  t.mock.timers.tick(10000);
  assert.deepEqual(regions(), ["A", ""], "nothing drains while there is no host");

  driver.start();
  t.mock.timers.tick(1000);
  assert.deepEqual(regions(), ["C", ""], "and what arrived in between is not lost");
});

test("start arms nothing when no message is showing", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { driver, painted, regions } = driverUnderTest();

  driver.start();
  const paints = painted.length;
  t.mock.timers.tick(5000);
  assert.equal(painted.length, paints, "an empty queue needs no drain");

  driver.announce("Saved");
  t.mock.timers.tick(999);
  assert.deepEqual(regions(), ["Saved", ""], "so the first message gets its full hold");
  t.mock.timers.tick(1);
  assert.deepEqual(regions(), ["", ""]);
});
