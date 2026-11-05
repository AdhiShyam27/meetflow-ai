// Basic dashboard stats, extracted from GET /api/analytics so the
// dashboard-stat test can check the arithmetic without a database.
//
// `duration` is stored in seconds. totalHours is rounded to one decimal,
// avgDuration is whole minutes (0 when there are no meetings).

export type BasicStats = {
  totalMeetings: number;
  totalHours: number;
  avgDuration: number;
};

export function computeBasicStats(
  meetings: Array<{ duration: number | null }>
): BasicStats {
  const totalMeetings = meetings.length;
  const totalSeconds = meetings.reduce((s, m) => s + (m.duration ?? 0), 0);
  const totalHours = +(totalSeconds / 3600).toFixed(1);
  const avgDuration =
    totalMeetings > 0 ? Math.round(totalSeconds / totalMeetings / 60) : 0;

  return { totalMeetings, totalHours, avgDuration };
}
