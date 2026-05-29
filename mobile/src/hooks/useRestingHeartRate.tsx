import { useCallback } from 'react';
import AppleHealthKit, { HealthInputOptions } from 'react-native-health';

export const useRestingHeartRate = (date: Date) => {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const readRestingHeartRate = useCallback(async () => {
    return new Promise<any[]>((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      AppleHealthKit.getRestingHeartRateSamples(options, (err, results) => {
        if (err) {
          console.warn('Error fetching resting heart rate from HealthKit:', err);
          resolve([]);
        } else {
          // Map Apple Health resting heart rate samples
          const mapped = results.map(s => ({
            metadata: {
              id: s.id || `rhr_${s.startDate}`,
              lastModifiedTime: s.endDate || s.startDate,
            },
            startTime: s.startDate,
            endTime: s.endDate,
            value: s.value,
          }));
          resolve(mapped);
        }
      });
    });
  }, [startDate, endDate]);

  return {
    readRestingHeartRate,
  };
};
