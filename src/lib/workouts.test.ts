import { afterEach, describe, expect, it, vi } from 'vitest';
import { adjustWatchCalories, estimateBurn, estimated1RM, groupSets, liftHistory, liftRecords, newRecords, readWatchScreenshots, weeklyTotals } from '@/lib/workouts';
import type { Workout } from '@/types';

const gym = (id: string, date: string, sets: Workout['sets'], createdAt = 0): Workout => ({
  id, date, kind: 'strength', name: 'Gym', minutes: 45, calories: 200, sets, createdAt,
});

const workouts = [
  gym('a', '2026-10-01', [{ exercise: 'Bench press', reps: 8, weight: 60 }, { exercise: 'Pull-up', reps: 8, weight: 0 }]),
  gym('b', '2026-10-05', [{ exercise: 'bench press ', reps: 5, weight: 70 }, { exercise: 'Pull-up', reps: 10, weight: 0 }]),
  gym('c', '2026-10-09', [{ exercise: 'Bench press', reps: 8, weight: 65 }, { exercise: 'Back squat', reps: 5, weight: 100 }]),
];

describe('strength progress', () => {
  it('estimates a one-rep max', () => {
    expect(estimated1RM(100, 1)).toBe(100);
    expect(estimated1RM(60, 10)).toBeCloseTo(80);
    expect(estimated1RM(0, 12)).toBe(0);
  });

  it('keeps records per lift, however the name was typed', () => {
    const recs = liftRecords(workouts);
    const bench = recs.find((r) => r.key === 'bench press')!;
    expect(bench.best).toEqual({ weight: 70, reps: 5, date: '2026-10-05' });
    expect(bench.best1RM).toBeCloseTo(82.33, 1); // 65 kg × 8 beats 70 kg × 5
    expect(bench.sessions).toBe(3);
    expect(recs.find((r) => r.key === 'pull-up')!.mostReps).toBe(10);
    // Most recently done first.
    expect(recs[0].lastDate).toBe('2026-10-09');
  });

  it('charts the best set per session', () => {
    expect(liftHistory(workouts, 'bench press').map((h) => h.weight)).toEqual([60, 70, 65]);
  });

  it('flags new records, but not a first time', () => {
    const next = gym('d', '2026-10-12', [
      { exercise: 'Bench press', reps: 6, weight: 72.5 },
      { exercise: 'Pull-up', reps: 12, weight: 0 },
      { exercise: 'Deadlift', reps: 5, weight: 120 },
    ], 5);
    expect(newRecords([...workouts, next], next)).toEqual(['Bench press', 'Pull-up']);
    const weaker = gym('e', '2026-10-12', [{ exercise: 'Bench press', reps: 5, weight: 60 }], 6);
    expect(newRecords(workouts, weaker)).toEqual([]);
  });

  it('groups sets by exercise in order', () => {
    expect(groupSets(workouts[0].sets!).map((g) => [g.exercise, g.sets.length])).toEqual([['Bench press', 1], ['Pull-up', 1]]);
  });
});

describe('totals and estimates', () => {
  it('estimates burn from type, duration and weight', () => {
    expect(estimateBurn('cardio', 30, 80)).toBe(280);
    expect(estimateBurn('other', 60, null)).toBe(263);
  });

  it('adds up weeks (Sunday start), oldest first', () => {
    const weeks = weeklyTotals(workouts, new Date(2026, 9, 10), 3);
    expect(weeks.map((w) => w.start)).toEqual(['2026-09-20', '2026-09-27', '2026-10-04']);
    expect(weeks[1]).toMatchObject({ workouts: 1, minutes: 45 });
    expect(weeks[2]).toMatchObject({ workouts: 2, minutes: 90, calories: 400 });
  });
});

describe('watch screenshots', () => {
  afterEach(() => vi.unstubAllGlobals());
  const answer = (o: Record<string, unknown>) => vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] }), { status: 200 }));

  it('knows the old two-thirds lifting cut (to recognise workouts saved with it)', () => {
    expect(adjustWatchCalories('strength', 416)).toBe(277);
    expect(adjustWatchCalories('cardio', 416)).toBe(416);
  });

  it('reads the summary off the screenshots and sends them all along', async () => {
    const fetchMock = answer({ kind: 'strength', name: 'Strength training', minutes: 44, calories: 416, avgHeartRate: 124, maxHeartRate: 142 });
    vi.stubGlobal('fetch', fetchMock);
    const w = await readWatchScreenshots('k', [{ data: 'AAA', mimeType: 'image/jpeg' }, { data: 'BBB', mimeType: 'image/jpeg' }]);
    expect(w).toMatchObject({ kind: 'strength', name: 'Strength training', minutes: 44, watchCalories: 416, calories: 416, avgHeartRate: 124, maxHeartRate: 142 });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.contents[0].parts.filter((p: { inlineData?: unknown }) => p.inlineData)).toHaveLength(2);
  });

  it('ignores heart rates that make no sense and refuses screenshots without a workout', async () => {
    vi.stubGlobal('fetch', answer({ kind: 'cardio', name: 'Outdoor run', minutes: 30, calories: 300, avgHeartRate: 0, maxHeartRate: 999 }));
    const w = await readWatchScreenshots('k', [{ data: 'AAA', mimeType: 'image/jpeg' }]);
    expect(w.avgHeartRate).toBeUndefined();
    expect(w.maxHeartRate).toBeUndefined();
    vi.stubGlobal('fetch', answer({ kind: 'other', name: '', minutes: 0, calories: 0 }));
    await expect(readWatchScreenshots('k', [{ data: 'AAA', mimeType: 'image/jpeg' }])).rejects.toThrow();
  });
});
