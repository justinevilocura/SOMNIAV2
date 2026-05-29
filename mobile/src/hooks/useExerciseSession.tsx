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

      AppleHealthKit.getSamples(options, (err, results) => {
        if (err) {
          console.warn('Error fetching workouts from HealthKit:', err);
          resolve([]);
        } else {
          // Map Apple Health workouts to Health Connect ExerciseSession format
          const workoutResults = results as any[];
          const mapped = workoutResults.map(w => ({
            metadata: {
              id: w.id || `workout_${w.startDate}`,
              lastModifiedTime: w.endDate || w.startDate,
            },
            startTime: w.startDate,
            endTime: w.endDate,
            exerciseType: mapAppleWorkoutTypeToHC(w.workoutActivityType || w.activityName || 'other'),
          }));
          resolve(mapped);
        }
      });
    });
  }, [startDate, endDate]);

  return {
    readExerciseSession,
  };
};
