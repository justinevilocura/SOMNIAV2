import { useCallback } from 'react';
import AppleHealthKit, { HealthInputOptions } from 'react-native-health';

export const useSteps = (date: Date) => {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const readSteps = useCallback(async () => {
    return new Promise<any[]>((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      AppleHealthKit.getDailyStepCountSamples(options, (err, results) => {
        if (err) {
          console.warn('Error fetching steps from HealthKit:', err);
          // Return empty array on error instead of throwing to avoid crashing the app
          resolve([]);
        } else {
          // Map Apple Health steps format to Health Connect format to keep syncToDB/UI working seamlessly
          const mapped = results.map(s => ({
            metadata: {
              id: s.id || `step_${s.startDate}`,
              lastModifiedTime: s.endDate || s.startDate,
            },
            count: s.value,
            startTime: s.startDate,
            endTime: s.endDate,
          }));
          resolve(mapped);
        }
      });
    });
  }, [startDate, endDate]);

  return {
    readSteps,
  };
};
