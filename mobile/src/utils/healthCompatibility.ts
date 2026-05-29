export const SleepStageType = {
  UNKNOWN: 0,
  AWAKE: 1,
  SLEEPING: 2,
  OUT_OF_BED: 3,
  LIGHT: 4,
  DEEP: 5,
  REM: 6,
};

export const ExerciseType = {
  OTHER: 0,
  WALKING: 1,
  RUNNING: 2,
  CYCLING: 3,
  SWIMMING: 4,
};

export const mapAppleSleepStageToHC = (value: string): number => {
  switch (value) {
    case 'AWAKE':
      return SleepStageType.AWAKE;
    case 'ASLEEP':
      return SleepStageType.SLEEPING;
    case 'CORE':
      return SleepStageType.LIGHT;
    case 'DEEP':
      return SleepStageType.DEEP;
    case 'REM':
      return SleepStageType.REM;
    default:
      return SleepStageType.UNKNOWN;
  }
};

export const mapAppleWorkoutTypeToHC = (type: string): number => {
  const upper = type.toUpperCase();
  if (upper.includes('WALK')) return ExerciseType.WALKING;
  if (upper.includes('RUN')) return ExerciseType.RUNNING;
  if (upper.includes('CYCLE') || upper.includes('BIKE')) return ExerciseType.CYCLING;
  if (upper.includes('SWIM')) return ExerciseType.SWIMMING;
  return ExerciseType.OTHER;
};
