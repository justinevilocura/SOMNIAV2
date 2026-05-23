import { useCallback } from 'react';
import { requestPermission, readRecords } from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';

export const useSleepSession = (date: Date) => {
  const startDate = new Date(date); // Clone for start
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date); // Clone for end
  endDate.setHours(23, 59, 59, 999);

  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  const requestSleepPermission = useCallback(async () => {
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'SleepSession' },
    ]);

    if (!granted.some((p) => p.recordType === 'SleepSession')) {
      throw new Error('Permission not granted for SleepSession');
    }
  }, []);

  const readSleepSession = useCallback(async () => {
    await requestSleepPermission();

    const { records } = await readRecords('SleepSession', {
      timeRangeFilter,
    });

    // console.log('SleepSession records:', JSON.stringify(records, null, 2));
    return records;
  }, [requestSleepPermission, timeRangeFilter]);

  return {
    readSleepSession,
  };
};
