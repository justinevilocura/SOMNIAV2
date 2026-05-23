import { useCallback } from 'react';
import { requestPermission, readRecords } from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';

export const useSteps = (date: Date) => {
  const startDate = new Date(date); // Clone for start
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date); // Clone for end
  endDate.setHours(23, 59, 59, 999);

  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  const requestSteps = useCallback(async () => {
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
    ]);

    if (!granted.some((p) => p.recordType === 'Steps')) {
      throw new Error('Permission not granted for Steps');
    }
  }, []);

  const readSteps = useCallback(async () => {
    await requestSteps();

    const { records } = await readRecords('Steps', {
      timeRangeFilter,
    });

    //console.log('Steps records:', JSON.stringify(records, null, 2));
    return records;
  }, [requestSteps, timeRangeFilter]);

  return {
    readSteps,
  };
};
