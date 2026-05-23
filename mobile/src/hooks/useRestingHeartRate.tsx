import { useCallback } from 'react';
import { requestPermission, readRecords } from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';

export const useRestingHeartRate = (date: Date) => {
  const startDate = new Date(date); // Clone for start
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date); // Clone for end
  endDate.setHours(23, 59, 59, 999);

  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  const requestRestingHeartRate = useCallback(async () => {
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'RestingHeartRate' },
    ]);

    if (!granted.some((p) => p.recordType === 'RestingHeartRate')) {
      throw new Error('Permission not granted for RestingHeartRate');
    }
  }, []);

  const readRestingHeartRate = useCallback(async () => {
    await requestRestingHeartRate();

    const { records } = await readRecords('RestingHeartRate', {
      timeRangeFilter,
    });

    console.log('RestingHeartRate records:', JSON.stringify(records, null, 2));
    return records;
  }, [requestRestingHeartRate, timeRangeFilter]);

  return {
    readRestingHeartRate,
  };
};
