// Data isolation test (PLAN.md section 4, test 1)
//
// Given User A has one saved meeting and User B has none,
// when User B requests the meetings list,
// then the result is empty and contains none of User A's meeting ids.
//
// Runner: Node's built-in test runner (`node --test`). Node 22 strips
// TypeScript types natively, so no extra dependency is needed.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { listMeetingsForUser } from "../lib/meetings/list.ts";

type Meeting = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Minimal in-memory fake of the Supabase query-builder chain used by
// listMeetingsForUser: from(...).select(...).eq(...).order(...)
// ---------------------------------------------------------------------------
function makeBuilder(rows: Meeting[]) {
  const asRecord = (r: Meeting) => r as unknown as Record<string, unknown>;
  const builder = {
    eq(column: string, value: string) {
      return makeBuilder(rows.filter((r) => asRecord(r)[column] === value));
    },
    order(column: string, { ascending }: { ascending: boolean }) {
      const sorted = [...rows].sort((a, b) => {
        const av = String(asRecord(a)[column]);
        const bv = String(asRecord(b)[column]);
        return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      return Promise.resolve({ data: sorted, error: null });
    },
  };
  return builder;
}

function makeFakeSupabase(tables: Record<string, Meeting[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      return {
        select(_columns: string) {
          return makeBuilder(rows);
        },
      };
    },
  };
}

const USER_A = "user-a-1111";
const USER_B = "user-b-2222";

const meetingsOfA: Meeting[] = [
  {
    id: "meeting-a-001",
    user_id: USER_A,
    title: "A's weekly sync",
    created_at: "2026-11-01T10:00:00Z",
  },
];

describe("data isolation: User B cannot see User A's meetings", () => {
  it("returns an empty list for User B and none of A's ids", async () => {
    const supabase = makeFakeSupabase({ meetings: [...meetingsOfA] });

    const { data, error } = await listMeetingsForUser(supabase, USER_B);

    assert.equal(error, null);

    const rows: Meeting[] = data ?? [];
    const idsOfA = new Set(meetingsOfA.map((m) => m.id));
    for (const row of rows) {
      assert.ok(!idsOfA.has(row.id), `User B received User A's meeting ${row.id}`);
    }
    assert.deepEqual(rows, []);
  });

  it("returns exactly User A's meetings for User A", async () => {
    const supabase = makeFakeSupabase({ meetings: [...meetingsOfA] });

    const { data, error } = await listMeetingsForUser(supabase, USER_A);

    assert.equal(error, null);
    assert.deepEqual(
      (data ?? []).map((m) => m.id).sort(),
      meetingsOfA.map((m) => m.id).sort()
    );
    for (const row of data ?? []) {
      assert.equal(row.user_id, USER_A);
    }
  });

  it("keeps the two users apart when both have meetings", async () => {
    const meetingsOfB: Meeting[] = [
      {
        id: "meeting-b-001",
        user_id: USER_B,
        title: "B's standup",
        created_at: "2026-11-02T09:00:00Z",
      },
    ];
    const supabase = makeFakeSupabase({
      meetings: [...meetingsOfA, ...meetingsOfB],
    });

    const forB = await listMeetingsForUser(supabase, USER_B);
    const forA = await listMeetingsForUser(supabase, USER_A);

    assert.deepEqual((forB.data ?? []).map((m) => m.id), ["meeting-b-001"]);
    assert.deepEqual((forA.data ?? []).map((m) => m.id), ["meeting-a-001"]);
  });
});
