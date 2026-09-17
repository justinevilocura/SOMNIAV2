import { useCallback } from 'react';
import { readRecords } from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';

export const useSleepSession = (date: Date) => {
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 3); // Look back 3 days
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date); // Clone for end
  endDate.setHours(23, 59, 59, 999);

  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  const readSleepSession = useCallback(async () => {
    try {
      const { records } = await readRecords('SleepSession', {
        timeRangeFilter,
      });
      return records || [];
    } catch (error) {
      console.warn('readSleepSession error (handled gracefully):', error);
      return [];
    }
  }, [timeRangeFilter]);

  return {
    readSleepSession,
  };
};
