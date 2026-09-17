import { useCallback } from 'react';
import { readRecords } from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';

export const useHeartRate = (date: Date) => {
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 1); // Look back 1 day (covers previous 24h and today)
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date); // Clone for end
  endDate.setHours(23, 59, 59, 999);

  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  const readHeartRate = useCallback(async () => {
    try {
      const { records } = await readRecords('HeartRate', {
        timeRangeFilter,
      });
      return records || [];
    } catch (error) {
      console.warn('readHeartRate error (handled gracefully):', error);
      return [];
    }
  }, [timeRangeFilter]);

  return {
    readHeartRate,
  };
};
