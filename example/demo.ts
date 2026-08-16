/**
 * What a screen reader would be given, message by message.
 *
 *   npm run demo
 */

import { Announcer } from "../src/index.ts";

const announcer = new Announcer();

// A filter runs twice and returns the same count both times.
announcer.announce("Filtering");
announcer.announce("3 results");
announcer.announce("3 results");
announcer.announce("Payment declined", "assertive");

console.log("queued, in order:\n");
let step = 1;
let current = announcer.current;
while (current) {
  const repeated = current.text !== current.message ? "  (made distinct so it is read again)" : "";
  console.log(
    `  ${step++}. [${current.politeness.padEnd(9)}] "${current.message}"${repeated}`,
  );
  current = announcer.advance();
}
console.log("\n  region cleared\n");

console.log("without queueing, a screen reader would have announced:");
console.log('  "Payment declined"   — the last write wins, the rest are lost');
