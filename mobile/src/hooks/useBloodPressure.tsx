import { useCallback } from 'react';
import AppleHealthKit, { HealthInputOptions } from 'react-native-health';

export const useBloodPressure = (date: Date) => {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const readBloodPressure = useCallback(async () => {
    return new Promise<any[]>((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      AppleHealthKit.getBloodPressureSamples(options, (err, results) => {
        if (err) {
          console.warn('Error fetching blood pressure from HealthKit:', err);
          resolve([]);
        } else {
          // Map Apple Health blood pressure samples
          const mapped = results.map(s => ({
            metadata: {
              id: s.id || `bp_${s.startDate}`,
              lastModifiedTime: s.endDate || s.startDate,
            },
            startTime: s.startDate,
            endTime: s.endDate,
            systolic: s.bloodPressureSystolicValue,
            diastolic: s.bloodPressureDiastolicValue,
          }));
          resolve(mapped);
        }
      });
    });
  }, [startDate, endDate]);

  return {
    readBloodPressure,
  };
};
