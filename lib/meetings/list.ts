// Shared query for "list this user's meetings".
// Extracted from GET /api/meetings so the data-isolation test can run the
// exact same query against an in-memory fake Supabase client.

export type MeetingsQueryResult<T = Record<string, unknown>> = {
  data: T[] | null;
  error: unknown | null;
};

// The minimal slice of the Supabase client surface this function uses.
// Both the real `SupabaseClient` and the test fake satisfy it.
export interface MeetingsQueryClient<T = Record<string, unknown>> {
  from(table: string): {
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
}

export async function listMeetingsForUser<T = Record<string, unknown>>(
  supabase: MeetingsQueryClient<T>,
  userId: string
): Promise<MeetingsQueryResult<T>> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return { data, error };
}
