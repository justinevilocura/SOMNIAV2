/**
 * SOMNiA Specialized Data Cleaning Module
 * 
 * Fulfills Proposal Objectives:
 * 1. Data Cleansing: Isolates and drops physiological tracking artifacts and extreme input anomalies.
 * 2. Biometric Accuracy Validation: Audits raw payloads and validates that >= 90% pass quality criteria.
 * 3. Version Synchronization & Imputation: Deduplicates and prunes stale data blocks, while imputing missing stage/sample gaps.
 */

// Clinical boundaries based on AASM (American Academy of Sleep Medicine) & WHO standards
export const PHYSIOLOGICAL_BOUNDS = {
  SLEEP: {
    MIN_DURATION_MINUTES: 30,       // Sessions < 30m discarded as sensor noise / false starts
    MAX_DURATION_MINUTES: 960,      // Sessions > 16h flagged as forgotten tracker placement
  },
  HEART_RATE: {
    MIN_BPM: 35,                    // Severe bradycardia / sensor detachment
    MAX_BPM: 220,                   // Supra-physiological maximum
    MAX_INTERPOLATION_GAP_MS: 300000 // 5 minutes max gap for linear interpolation
  },
  STEPS: {
    MIN_STEPS: 0,
    MAX_HOURLY_STEPS: 15000         // Biomechanical limit of human movement per hour
  },
  SPO2: {
    MIN_PERCENT: 70,                // Below 70% is sensor detachment artifact
    MAX_PERCENT: 100
  },
  EXERCISE: {
    MIN_DURATION_MINUTES: 1,        // Discard < 1m sensor noise / accidental bumps
    MAX_DURATION_MINUTES: 480       // Max 8 hours for a single continuous workout
  }
};

export const CLINICAL_STAGE_IMPUTATION = {
  LIGHT_RATIO: 0.55, // 55% Light (stage 4)
  DEEP_RATIO: 0.20,  // 20% Deep (stage 5)
  REM_RATIO: 0.25,   // 25% REM (stage 6)
};

/**
 * 1. SLEEP DATA CLEANING PIPELINE
 */
export const cleanSleepSessionBatch = (rawSessions) => {
  if (!Array.isArray(rawSessions)) {
    return {
      cleanedSessions: [],
      passRate: 0,
      isValid: false,
      audit: { total: 0, accepted: 0, dropped: 0, passRate: 0, reasons: ['Payload is not an array'] }
    };
  }

  const totalReceived = rawSessions.length;
  if (totalReceived === 0) {
    return {
      cleanedSessions: [],
      passRate: 100,
      isValid: true,
      audit: { total: 0, accepted: 0, dropped: 0, passRate: 100, reasons: [] }
    };
  }

  const validSessions = [];
  const droppedReasons = [];

  for (let i = 0; i < rawSessions.length; i++) {
    const s = rawSessions[i];
    const identifier = s.id || `index_${i}`;

    // Required fields check
    if (!s.startTime || !s.endTime || !s.id || !s.lastModifiedTime) {
      droppedReasons.push(`Session ${identifier}: Missing required timestamp or ID fields.`);
      continue;
    }

    const start = new Date(s.startTime).getTime();
    const end = new Date(s.endTime).getTime();

    // Check 1: Inverted or invalid timestamps
    if (isNaN(start) || isNaN(end) || start >= end) {
      droppedReasons.push(`Session ${identifier}: Corrupt timestamp interval (startTime >= endTime).`);
      continue;
    }

    const durationMinutes = (end - start) / 60000;

    // Check 2: Physiological duration boundaries
    if (durationMinutes < PHYSIOLOGICAL_BOUNDS.SLEEP.MIN_DURATION_MINUTES) {
      droppedReasons.push(
        `Session ${identifier}: Micro-sleep / sensor noise (< ${PHYSIOLOGICAL_BOUNDS.SLEEP.MIN_DURATION_MINUTES}m: ${Math.round(durationMinutes)}m).`
      );
      continue;
    }

    if (durationMinutes > PHYSIOLOGICAL_BOUNDS.SLEEP.MAX_DURATION_MINUTES) {
      droppedReasons.push(
        `Session ${identifier}: Extreme outlier duration (> 16h: ${(durationMinutes / 60).toFixed(1)}h).`
      );
      continue;
    }

    // Check 3: Sleep Stage Sanitization & Imputation
    let processedStages = [];
    if (Array.isArray(s.stages) && s.stages.length > 0) {
      // Validate and clean existing stages
      processedStages = s.stages.filter((st) => {
        if (!st.startTime || !st.endTime) return false;
        const sTime = new Date(st.startTime).getTime();
        const eTime = new Date(st.endTime).getTime();
        // Discard inverted stages or stages outside session window
        if (isNaN(sTime) || isNaN(eTime) || sTime >= eTime) return false;
        if (sTime < start - 300000 || eTime > end + 300000) return false; // allow 5m clock jitter
        return true;
      });
    }

    // Imputation Algorithm: If stages array is empty or stripped, impute using clinical gold standard
    if (processedStages.length === 0) {
      const deepDurationMs = (end - start) * CLINICAL_STAGE_IMPUTATION.DEEP_RATIO;
      const lightDurationMs = (end - start) * CLINICAL_STAGE_IMPUTATION.LIGHT_RATIO;
      
      const deepEnd = new Date(start + deepDurationMs);
      const lightEnd = new Date(start + deepDurationMs + lightDurationMs);

      processedStages = [
        {
          stage: 5, // DEEP
          startTime: new Date(start),
          endTime: deepEnd
        },
        {
          stage: 4, // LIGHT
          startTime: deepEnd,
          endTime: lightEnd
        },
        {
          stage: 6, // REM
          startTime: lightEnd,
          endTime: new Date(end)
        }
      ];
    }

    validSessions.push({
      ...s,
      startTime: new Date(start),
      endTime: new Date(end),
      lastModifiedTime: new Date(s.lastModifiedTime),
      stages: processedStages,
      cleaningMetadata: {
        isCleaned: true,
        imputedStages: (!s.stages || s.stages.length === 0),
        durationMinutes: Math.round(durationMinutes),
        cleanedAt: new Date().toISOString()
      }
    });
  }

  // Version Synchronization & Stale Pruning (Objective 3):
  // If sessions overlap in time for the same user, keep only the latest modified version
  const deduplicated = [];
  // Sort descending by lastModifiedTime
  validSessions.sort((a, b) => new Date(b.lastModifiedTime).getTime() - new Date(a.lastModifiedTime).getTime());

  for (const session of validSessions) {
    const sStart = new Date(session.startTime).getTime();
    const sEnd = new Date(session.endTime).getTime();

    // Check if overlaps with an already-accepted newer session
    const overlaps = deduplicated.some((accepted) => {
      const aStart = new Date(accepted.startTime).getTime();
      const aEnd = new Date(accepted.endTime).getTime();
      return Math.max(sStart, aStart) < Math.min(sEnd, aEnd);
    });

    if (!overlaps) {
      deduplicated.push(session);
    } else {
      droppedReasons.push(`Session ${session.id}: Pruned stale/overlapping older version.`);
    }
  }

  // Biometric Accuracy Validation Gate (Objective 2: 90% Pass Rate)
  const acceptedCount = deduplicated.length;
  const passRate = totalReceived > 0 ? Math.round((acceptedCount / totalReceived) * 100) : 100;
  
  // Note: For small single-item syncs, passRate will be 100% or 0%. For batches (>=5), require >= 90%
  const isValid = totalReceived < 5 ? acceptedCount > 0 : passRate >= 90;

  return {
    cleanedSessions: deduplicated,
    passRate,
    isValid,
    audit: {
      totalReceived,
      acceptedCount,
      droppedCount: totalReceived - acceptedCount,
      passRate,
      reasons: droppedReasons
    }
  };
};

/**
 * 2. HEART RATE DATA CLEANING PIPELINE
 */
export const cleanHeartRateBatch = (rawRecords) => {
  if (!Array.isArray(rawRecords)) {
    return { cleanedRecords: [], passRate: 0, isValid: false, audit: { total: 0, accepted: 0 } };
  }

  let totalSamplesCount = 0;
  let validSamplesCount = 0;
  const cleanedRecords = [];

  for (const rec of rawRecords) {
    if (!rec.id || !rec.startTime || !rec.endTime || !Array.isArray(rec.samples)) {
      continue;
    }

    const rawSamples = rec.samples;
    totalSamplesCount += rawSamples.length;

    // Filter impossible physiological outliers (35 - 220 BPM)
    const validSamples = rawSamples
      .filter((samp) => {
        const bpm = samp.beatsPerMinute;
        return (
          typeof bpm === 'number' &&
          bpm >= PHYSIOLOGICAL_BOUNDS.HEART_RATE.MIN_BPM &&
          bpm <= PHYSIOLOGICAL_BOUNDS.HEART_RATE.MAX_BPM &&
          samp.time
        );
      })
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // Imputation Algorithm: Linear interpolation for short dropouts (1 - 3 min gaps)
    const interpolatedSamples = [];
    for (let i = 0; i < validSamples.length; i++) {
      interpolatedSamples.push(validSamples[i]);
      if (i < validSamples.length - 1) {
        const currentT = new Date(validSamples[i].time).getTime();
        const nextT = new Date(validSamples[i + 1].time).getTime();
        const gapMs = nextT - currentT;

        // If gap is between 1 minute and 3 minutes, interpolate midpoint
        if (gapMs >= 60000 && gapMs <= 180000) {
          const midT = new Date(currentT + gapMs / 2);
          const midBpm = Math.round((validSamples[i].beatsPerMinute + validSamples[i + 1].beatsPerMinute) / 2);
          interpolatedSamples.push({
            beatsPerMinute: midBpm,
            time: midT,
            imputed: true
          });
        }
      }
    }

    validSamplesCount += validSamples.length;

    if (interpolatedSamples.length > 0) {
      cleanedRecords.push({
        ...rec,
        samples: interpolatedSamples,
        startTime: new Date(rec.startTime),
        endTime: new Date(rec.endTime),
        lastModifiedTime: new Date(rec.lastModifiedTime || Date.now())
      });
    }
  }

  const passRate = totalSamplesCount > 0 ? Math.round((validSamplesCount / totalSamplesCount) * 100) : 100;
  const isValid = totalSamplesCount < 10 ? validSamplesCount > 0 : passRate >= 90;

  return {
    cleanedRecords,
    passRate,
    isValid,
    audit: {
      totalSamplesReceived: totalSamplesCount,
      validSamplesCount,
      droppedSamplesCount: totalSamplesCount - validSamplesCount,
      passRate
    }
  };
};

/**
 * 3. STEP DATA CLEANING PIPELINE
 */
export const cleanStepsBatch = (rawSteps) => {
  if (!Array.isArray(rawSteps)) return { cleanedSteps: [], passRate: 0 };

  const cleanedSteps = rawSteps.filter((step) => {
    if (!step.id || !step.startTime || !step.endTime || step.count === undefined) return false;
    const start = new Date(step.startTime).getTime();
    const end = new Date(step.endTime).getTime();
    if (isNaN(start) || isNaN(end) || start >= end) return false;
    
    // Check biomechanical bounds
    if (step.count < 0 || step.count > PHYSIOLOGICAL_BOUNDS.STEPS.MAX_HOURLY_STEPS) return false;
    return true;
  });

  const passRate = rawSteps.length > 0 ? Math.round((cleanedSteps.length / rawSteps.length) * 100) : 100;

  return {
    cleanedSteps,
    passRate,
    isValid: passRate >= 90
  };
};

/**
 * Common Health Connect Exercise Type mapping for title imputation
 */
const EXERCISE_TYPE_MAP = {
  0: 'Workout',
  8: 'Biking',
  26: 'Elliptical',
  29: 'Gymnastics',
  37: 'Hiking',
  46: 'Pilates',
  56: 'Running',
  70: 'Stair Climbing',
  74: 'Swimming',
  79: 'Walking',
  80: 'Water Polo',
  82: 'Weightlifting',
  83: 'Wheelchair',
  84: 'Yoga'
};

/**
 * 4. EXERCISE DATA CLEANING PIPELINE
 */
export const cleanExerciseBatch = (rawExercises) => {
  if (!Array.isArray(rawExercises)) {
    return { cleanedExercises: [], passRate: 0, isValid: false, audit: { total: 0, accepted: 0 } };
  }

  const totalReceived = rawExercises.length;
  if (totalReceived === 0) {
    return { cleanedExercises: [], passRate: 100, isValid: true, audit: { total: 0, accepted: 0, passRate: 100, reasons: [] } };
  }

  const validExercises = [];
  const droppedReasons = [];

  for (let i = 0; i < rawExercises.length; i++) {
    const ex = rawExercises[i];
    const identifier = ex.id || `exercise_${i}`;

    if (!ex.id || !ex.startTime || !ex.endTime || !ex.lastModifiedTime) {
      droppedReasons.push(`Exercise ${identifier}: Missing required fields.`);
      continue;
    }

    const start = new Date(ex.startTime).getTime();
    const end = new Date(ex.endTime).getTime();

    // Check 1: Inverted or invalid timestamps
    if (isNaN(start) || isNaN(end) || start >= end) {
      droppedReasons.push(`Exercise ${identifier}: Corrupt timestamp interval (startTime >= endTime).`);
      continue;
    }

    const durationMinutes = (end - start) / 60000;

    // Check 2: Filter < 1 minute accidental bumps / sensor noise
    if (durationMinutes < PHYSIOLOGICAL_BOUNDS.EXERCISE.MIN_DURATION_MINUTES) {
      droppedReasons.push(`Exercise ${identifier}: Micro-activity artifact (< 1m: ${Math.round(durationMinutes * 60)}s).`);
      continue;
    }

    // Check 3: Filter extreme forgotten workouts (> 8 hours)
    if (durationMinutes > PHYSIOLOGICAL_BOUNDS.EXERCISE.MAX_DURATION_MINUTES) {
      droppedReasons.push(`Exercise ${identifier}: Extreme outlier duration (> 8h: ${(durationMinutes / 60).toFixed(1)}h).`);
      continue;
    }

    // Imputation: If title is missing, impute from exerciseType code
    const resolvedTitle = ex.title || EXERCISE_TYPE_MAP[ex.exerciseType] || 'Exercise Session';

    validExercises.push({
      ...ex,
      title: resolvedTitle,
      startTime: new Date(start),
      endTime: new Date(end),
      lastModifiedTime: new Date(ex.lastModifiedTime),
      cleaningMetadata: {
        isCleaned: true,
        imputedTitle: !ex.title,
        durationMinutes: Math.round(durationMinutes),
        cleanedAt: new Date().toISOString()
      }
    });
  }

  // Version Synchronization & Stale Pruning
  validExercises.sort((a, b) => new Date(b.lastModifiedTime).getTime() - new Date(a.lastModifiedTime).getTime());
  const deduplicated = [];

  for (const ex of validExercises) {
    const sStart = new Date(ex.startTime).getTime();
    const sEnd = new Date(ex.endTime).getTime();
    const overlaps = deduplicated.some((accepted) => {
      const aStart = new Date(accepted.startTime).getTime();
      const aEnd = new Date(accepted.endTime).getTime();
      return Math.max(sStart, aStart) < Math.min(sEnd, aEnd);
    });

    if (!overlaps) {
      deduplicated.push(ex);
    } else {
      droppedReasons.push(`Exercise ${ex.id}: Pruned stale/overlapping older workout.`);
    }
  }

  const passRate = totalReceived > 0 ? Math.round((deduplicated.length / totalReceived) * 100) : 100;
  const isValid = totalReceived < 5 ? deduplicated.length > 0 : passRate >= 90;

  return {
    cleanedExercises: deduplicated,
    passRate,
    isValid,
    audit: {
      totalReceived,
      acceptedCount: deduplicated.length,
      droppedCount: totalReceived - deduplicated.length,
      passRate,
      reasons: droppedReasons
    }
  };
};
