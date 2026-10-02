import { useMemo } from 'react';
import { useStore } from '@/store';
import { goalForecast, type GoalForecast } from '@/lib/forecast';

/** Shared so Home can show the short version of the Stats forecast. */
export function useGoalForecast(): GoalForecast {
  const { weights, settings } = useStore();
  return useMemo(() => goalForecast(weights, settings.goalWeight), [weights, settings.goalWeight]);
}
