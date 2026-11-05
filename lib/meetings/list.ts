// Shared query for "list this user's meetings".
// Extracted from GET /api/meetings so the data-isolation test can run the
// exact same query against an in-memory fake Supabase client.

export type MeetingsQueryResult<T = Record<string, unknown>> = {
  data: T[] | null;
  error: unknown | null;
};

// The public parameter type is deliberately shallow. Checking the real
// `SupabaseClient` against a fully typed builder chain made the TypeScript
// compiler fail with "Type instantiation is excessively deep" during the
// Vercel build (see PR #23). Both the real client and the test fake only need
// to expose `from()`.
export interface MeetingsQueryClient {
  from(table: string): unknown;
}

// The chain shape we actually call, used internally only.
type QueryChain<T> = {
  select(columns: string): {
    eq(
      column: string,
      value: string
    ): {
      order(
        column: string,
        options: { ascending: boolean }
      ): PromiseLike<MeetingsQueryResult<T>>;
    };
  };
};

export async function listMeetingsForUser<T = Record<string, unknown>>(
  supabase: MeetingsQueryClient,
  userId: string
): Promise<MeetingsQueryResult<T>> {
  const chain = supabase.from("meetings") as unknown as QueryChain<T>;
  const { data, error } = await chain
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return { data, error };
}
