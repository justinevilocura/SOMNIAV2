import { useCallback } from 'react';
import AppleHealthKit, { HealthInputOptions } from 'react-native-health';
import { groupSleepSamplesIntoSessions } from '../utils/sleepHelper';

export const useSleepSession = (date: Date) => {
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 3); // Look back 3 days
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const readSleepSession = useCallback(async () => {
    return new Promise<any[]>((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      AppleHealthKit.getSleepSamples(options, (err, results) => {
        if (err) {
          console.warn('Error fetching sleep data from HealthKit:', err);
          resolve([]);
        } else {
          // results is an array of flat sleep samples.
          // Group them into sleep sessions.
          const sessions = groupSleepSamplesIntoSessions(results);
          // Map to Health Connect SleepSession format.
          const mapped = sessions.map(session => ({
            metadata: {
              id: session.id,
              lastModifiedTime: session.lastModifiedTime,
            },
            startTime: session.startTime,
            endTime: session.endTime,
            title: session.title,
            stages: session.stages,
            asleepMs: session.asleepMs,
          }));
          resolve(mapped);
        }
      });
    });
  }, [startDate, endDate]);

  return {
    readSleepSession,
  };
};
