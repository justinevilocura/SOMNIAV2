import { useCallback } from 'react';
import { requestPermission, readRecords } from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';

export const useHeartRate = (date: Date) => {
  const startDate = new Date(date); // Clone for start
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date); // Clone for end
  endDate.setHours(23, 59, 59, 999);

  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  const requestHeartRate = useCallback(async () => {
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'HeartRate' },
    ]);

    if (!granted.some((p) => p.recordType === 'HeartRate')) {
      throw new Error('Permission not granted for HeartRate');
    }
  }, []);

  const readHeartRate = useCallback(async () => {
    await requestHeartRate();

    const { records } = await readRecords('HeartRate', {
      timeRangeFilter,
    });

    //console.log('HeartRate records:', JSON.stringify(records, null, 2));
    return records;
  }, [requestHeartRate, timeRangeFilter]);

  return {
    readHeartRate,
  };
};
