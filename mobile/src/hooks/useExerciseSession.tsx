import { useCallback } from 'react';
import AppleHealthKit, { HealthInputOptions, HealthObserver } from 'react-native-health';
import { mapAppleWorkoutTypeToHC } from '../utils/healthCompatibility';

export const useExerciseSession = (date: Date) => {
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 7); // Look back 7 days
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date); // Clone for end
  endDate.setHours(23, 59, 59, 999);

  const readExerciseSession = useCallback(async () => {
    return new Promise<any[]>((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        type: 'Workout' as HealthObserver,
      };

      AppleHealthKit.getAnchoredWorkouts(options, (err, results: any) => {
        if (err || !results) {
          // Fallback to getSamples if getAnchoredWorkouts fails
          AppleHealthKit.getSamples(options, (samplesErr, samplesResults) => {
            if (samplesErr) {
              console.warn('Error fetching workouts from HealthKit:', samplesErr);
              resolve([]);
            } else {
              const workoutResults = (samplesResults || []) as any[];
              const mapped = workoutResults.map(w => ({
                metadata: {
                  id: w.id || `workout_${w.start || w.startDate}`,
                  lastModifiedTime: w.end || w.endDate || w.start || w.startDate,
                },
                startTime: w.start || w.startDate,
                endTime: w.end || w.endDate,
                exerciseType: mapAppleWorkoutTypeToHC(w.workoutActivityType || w.activityName || 'other'),
                activityName: w.workoutActivityType || w.activityName || 'Other',
              }));
              resolve(mapped);
            }
          });
        } else {
          // getAnchoredWorkouts returns { data: [...] } or array directly
          const workoutList = (Array.isArray(results) ? results : (results.data || [])) as any[];
          const mapped = workoutList.map(w => {
            let avgHr = 0;
            if (w.metadata) {
              const metaVal = w.metadata.HKAverageHeartRate || w.metadata.HKMetadataKeyAverageHeartRate;
              if (metaVal) {
                const match = String(metaVal).match(/(\d+(\.\d+)?)/);
                if (match) avgHr = Math.round(parseFloat(match[1]));
              }
            }
            if (!avgHr && w.averageHeartRate) {
              avgHr = Math.round(w.averageHeartRate);
            }

            return {
              metadata: {
                id: w.id || `workout_${w.start || w.startDate}`,
                lastModifiedTime: w.end || w.endDate || w.start || w.startDate,
              },
              startTime: w.start || w.startDate,
              endTime: w.end || w.endDate,
              exerciseType: mapAppleWorkoutTypeToHC(w.workoutActivityType || w.activityName || 'other'),
              activityName: w.workoutActivityType || w.activityName || 'Other',
              averageHeartRate: avgHr > 0 ? avgHr : undefined,
            };
          });
          resolve(mapped);
        }
      });
    });
  }, [startDate, endDate]);

  return {
    readExerciseSession,
  };
};
