import { useCallback } from 'react';
import AppleHealthKit, { HealthInputOptions } from 'react-native-health';

export const useHeartRate = (date: Date) => {
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 3); // Look back 3 days
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const readHeartRate = useCallback(async () => {
    return new Promise<any[]>((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      AppleHealthKit.getHeartRateSamples(options, (err, results) => {
        if (err) {
          console.warn('Error fetching heart rate from HealthKit:', err);
          resolve([]);
        } else {
          // Map Apple Health flat heart rate samples to Health Connect format.
          // Health Connect HeartRate format has:
          // id, lastModifiedTime, startTime, endTime, samples: Array<{ beatsPerMinute, time }>
          const mapped = results.map(s => ({
            metadata: {
              id: s.id || `hr_${s.startDate}`,
              lastModifiedTime: s.endDate || s.startDate,
            },
            startTime: s.startDate,
            endTime: s.endDate,
            samples: [{ beatsPerMinute: s.value, time: s.startDate }],
          }));
          resolve(mapped);
        }
      });
    });
  }, [startDate, endDate]);

  return {
    readHeartRate,
  };
};
