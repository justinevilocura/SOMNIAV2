import { useCallback } from 'react';
import { requestPermission, readRecords } from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';

export const useExerciseSession = (date: Date) => {
  const startDate = new Date(date); // Clone for start
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date); // Clone for end
  endDate.setHours(23, 59, 59, 999);

  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  const requestExerciseSession = useCallback(async () => {
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'ExerciseSession' },
    ]);
    
    if (!granted.some((p) => p.recordType === 'ExerciseSession')) {
      throw new Error('Permission not granted for ExerciseSession');
    }
  }, []);

  const readExerciseSession = useCallback(async () => {
    await requestExerciseSession();

    const { records } = await readRecords('ExerciseSession', {
      timeRangeFilter,
    });

    // console.log('ExerciseSession records:', JSON.stringify(records, null, 2));
    return records;
  }, [requestExerciseSession, timeRangeFilter]);

  return {
    readExerciseSession,
  };
};
