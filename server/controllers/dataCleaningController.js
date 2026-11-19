import SleepSession from '../models/sleepSessionModel.js';
import HeartRate from '../models/heartRateModel.js';
import Step from '../models/stepsModel.js';
import ExerciseSession from '../models/exerciseModel.js';
import {
  cleanSleepSessionBatch,
  cleanHeartRateBatch,
  cleanStepsBatch,
  cleanExerciseBatch
} from '../services/dataCleaningService.js';

/**
 * Retroactive Database Cleaning & Audit Endpoint
 * Scans existing records in MongoDB, applies outlier isolation and stage imputation,
 * and standardizes the entire historical dataset.
 */
export const cleanHistoricalDatabase = async (req, res) => {
  try {
    const { userId } = req.body;
    const filter = userId ? { user: userId } : {};

    const report = {
      timestamp: new Date().toISOString(),
      sleepSessions: {
        totalFound: 0,
        cleanedAndKept: 0,
        prunedOutliers: 0,
        imputedStagesCount: 0,
        passRate: '100%'
      },
      heartRate: {
        totalSessionsFound: 0,
        cleanedAndKept: 0,
        samplesAudited: 0,
        passRate: '100%'
      },
      steps: {
        totalFound: 0,
        cleanedAndKept: 0,
        prunedOutliers: 0,
        passRate: '100%'
      },
      exercise: {
        totalFound: 0,
        cleanedAndKept: 0,
        prunedOutliers: 0,
        imputedTitlesCount: 0,
        passRate: '100%'
      }
    };

    // 1. Process Historical Sleep Sessions
    const existingSleeps = await SleepSession.find(filter).lean();
    report.sleepSessions.totalFound = existingSleeps.length;

    if (existingSleeps.length > 0) {
      // Map to plain objects
      const rawFormatted = existingSleeps.map((s) => ({
        ...s,
        userId: s.user?.toString() || s.user,
        stages: s.stages || [],
        startTime: s.startTime,
        endTime: s.endTime,
        lastModifiedTime: s.lastModifiedTime || s.updatedAt || s.createdAt || new Date()
      }));

      const { cleanedSessions, passRate, audit } = cleanSleepSessionBatch(rawFormatted);
      report.sleepSessions.passRate = `${passRate}%`;
      report.sleepSessions.prunedOutliers = audit.droppedCount;

      const keptIds = new Set(cleanedSessions.map((c) => c.id));

      // Remove corrupt sessions from DB
      for (const s of existingSleeps) {
        if (!keptIds.has(s.id)) {
          await SleepSession.deleteOne({ _id: s._id });
        }
      }

      // Update remaining sessions with imputed stages if needed
      for (const cs of cleanedSessions) {
        const wasImputed = cs.cleaningMetadata?.imputedStages;
        if (wasImputed) {
          report.sleepSessions.imputedStagesCount++;
        }

        await SleepSession.updateOne(
          { id: cs.id },
          {
            $set: {
              stages: cs.stages,
              startTime: cs.startTime,
              endTime: cs.endTime,
              lastModifiedTime: cs.lastModifiedTime
            }
          }
        );
      }

      report.sleepSessions.cleanedAndKept = cleanedSessions.length;
    }

    // 2. Process Historical Heart Rate Records
    const existingHR = await HeartRate.find(filter).lean();
    report.heartRate.totalSessionsFound = existingHR.length;

    if (existingHR.length > 0) {
      const rawHRFormatted = existingHR.map((hr) => ({
        ...hr,
        userId: hr.user?.toString() || hr.user
      }));

      const { cleanedRecords, passRate, audit } = cleanHeartRateBatch(rawHRFormatted);
      report.heartRate.passRate = `${passRate}%`;
      report.heartRate.samplesAudited = audit.totalSamplesReceived;

      for (const cr of cleanedRecords) {
        await HeartRate.updateOne(
          { id: cr.id },
          {
            $set: {
              samples: cr.samples,
              startTime: cr.startTime,
              endTime: cr.endTime
            }
          }
        );
      }
      report.heartRate.cleanedAndKept = cleanedRecords.length;
    }

    // 3. Process Historical Step Records
    const existingSteps = await Step.find(filter).lean();
    report.steps.totalFound = existingSteps.length;

    if (existingSteps.length > 0) {
      const rawStepsFormatted = existingSteps.map((st) => ({
        ...st,
        userId: st.user?.toString() || st.user
      }));

      const { cleanedSteps, passRate } = cleanStepsBatch(rawStepsFormatted);
      report.steps.passRate = `${passRate}%`;
      report.steps.prunedOutliers = existingSteps.length - cleanedSteps.length;

      const keptStepIds = new Set(cleanedSteps.map((cs) => cs.id));
      for (const st of existingSteps) {
        if (!keptStepIds.has(st.id)) {
          await Step.deleteOne({ _id: st._id });
        }
      }
      report.steps.cleanedAndKept = cleanedSteps.length;
    }

    // 4. Process Historical Exercise Records
    const existingExercises = await ExerciseSession.find(filter).lean();
    report.exercise.totalFound = existingExercises.length;

    if (existingExercises.length > 0) {
      const rawExFormatted = existingExercises.map((ex) => ({
        ...ex,
        userId: ex.user?.toString() || ex.user
      }));

      const { cleanedExercises, passRate, audit } = cleanExerciseBatch(rawExFormatted);
      report.exercise.passRate = `${passRate}%`;
      report.exercise.prunedOutliers = audit.droppedCount;

      const keptExIds = new Set(cleanedExercises.map((ce) => ce.id));
      for (const ex of existingExercises) {
        if (!keptExIds.has(ex.id)) {
          await ExerciseSession.deleteOne({ _id: ex._id });
        }
      }

      for (const ce of cleanedExercises) {
        if (ce.cleaningMetadata?.imputedTitle) {
          report.exercise.imputedTitlesCount++;
        }
        await ExerciseSession.updateOne(
          { id: ce.id },
          {
            $set: {
              title: ce.title,
              startTime: ce.startTime,
              endTime: ce.endTime,
              lastModifiedTime: ce.lastModifiedTime
            }
          }
        );
      }
      report.exercise.cleanedAndKept = cleanedExercises.length;
    }

    return res.status(200).json({
      success: true,
      message: 'Historical database cleaned and validated successfully.',
      auditReport: report
    });
  } catch (error) {
    console.error('cleanHistoricalDatabase error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
