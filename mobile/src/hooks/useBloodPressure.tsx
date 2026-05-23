import { useCallback } from 'react';
import { requestPermission, readRecords } from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';

export const useBloodPressure = (date: Date) => {
  const startDate = new Date(date); // Clone for start
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date); // Clone for end
  endDate.setHours(23, 59, 59, 999);

  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  const requestBloodPressure = useCallback(async () => {
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'BloodPressure' },
    ]);

    if (!granted.some((p) => p.recordType === 'BloodPressure')) {
      throw new Error('Permission not granted for BloodPressure');
    }
  }, []);

  const readBloodPressure = useCallback(async () => {
    await requestBloodPressure();

    const { records } = await readRecords('BloodPressure', {
      timeRangeFilter,
    });

    console.log('BloodPressure records:', JSON.stringify(records, null, 2));
    return records;
  }, [requestBloodPressure, timeRangeFilter]);

  return {
    readBloodPressure,
  };
};
