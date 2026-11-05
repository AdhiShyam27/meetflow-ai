// Dashboard stat test (PLAN.md section 4, test 2)
//
// Given three completed meetings of 30, 60 and 90 minutes,
// when the analytics stats are computed,
// then totalMeetings is 3, totalHours is 3.0 and avgDuration is 60 minutes.
//
// Runner: Node's built-in test runner (`node --test`).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeBasicStats } from "../lib/analytics/stats.ts";

const minutes = (m: number) => m * 60; // durations are stored in seconds

describe("dashboard stats: totals and average duration", () => {
  it("computes 3 meetings, 3.0 hours and a 60 minute average for 30/60/90 minute meetings", () => {
    const meetings = [
      { duration: minutes(30) },
      { duration: minutes(60) },
      { duration: minutes(90) },
    ];

    const stats = computeBasicStats(meetings);

    assert.equal(stats.totalMeetings, 3);
    assert.equal(stats.totalHours, 3.0);
    assert.equal(stats.avgDuration, 60);
  });

  it("returns zeros for an empty list", () => {
    const stats = computeBasicStats([]);

    assert.deepEqual(stats, { totalMeetings: 0, totalHours: 0, avgDuration: 0 });
  });

  it("treats a null duration as zero seconds", () => {
    const stats = computeBasicStats([{ duration: minutes(60) }, { duration: null }]);

    assert.equal(stats.totalMeetings, 2);
    assert.equal(stats.totalHours, 1.0);
    assert.equal(stats.avgDuration, 30);
  });
});
