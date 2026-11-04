import mongoose from 'mongoose';
import HeartRate from '../models/heartRateModel.js';

export const addHeartRate = async (req, res) => {
  const records = req.body; // assuming array of heart rate records

  try {
    for (const record of records) {
      const { id, lastModifiedTime, startTime, endTime, samples, userId } = record;

      if (!id || !lastModifiedTime || !startTime || !endTime || !samples || !userId) {
        return res.status(400).json({ success: false, message: 'Missing required details' });
      }

      // Upsert: update if exists, else create
      await HeartRate.findOneAndUpdate(
        { id },
        { user: userId, lastModifiedTime: new Date(lastModifiedTime), startTime: new Date(startTime), endTime: new Date(endTime), samples },
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({ success: true, message: 'Heart rate data synced successfully' });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getHeartRateStats = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    console.log('Fetching heart rate data for user:', userId);

    // Get all heart rate records for the user
    const heartRateData = await HeartRate.find({ user: userId }).sort({ startTime: -1 });

    console.log('Found ' + heartRateData.length + ' heart rate records');

    if (!heartRateData.length) {
      return res.status(200).json({
        success: true,
        data: {
          latestHeartRate: 0,
          latestTimestamp: null,
          trend: 'neutral',
          trendValue: '0 bpm',
          trendLabel: 'No heart rate data found'
        }
      });
    }

    // Get the most recent sleep/exercise session (matches mobile: latest session avg BPM)
    const latestSleep = await mongoose.model('SleepSession').findOne({ user: userId }).sort({ endTime: -1 });
    const latestExercise = await mongoose.model('ExerciseSession').findOne({ user: userId }).sort({ endTime: -1 });

    // Pick the most recent session between sleep and exercise
    let mostRecentSession = null;
    if (latestSleep && latestExercise) {
      mostRecentSession = new Date(latestExercise.endTime) > new Date(latestSleep.endTime)
        ? latestExercise : latestSleep;
    } else {
      mostRecentSession = latestSleep || latestExercise;
    }

    // Flatten all samples from all records
    const allSamples = heartRateData.flatMap(record =>
      (record.samples || []).map(s => ({ ...s.toObject(), recordStart: record.startTime, recordEnd: record.endTime }))
    );

    let latestHeartRate = 0;
    let latestTimestamp = null;

    if (mostRecentSession) {
      const sessionStart = new Date(mostRecentSession.startTime).getTime();
      const sessionEnd = new Date(mostRecentSession.endTime).getTime();

      // Get samples within the most recent session window
      const sessionSamples = allSamples.filter(sample => {
        const t = new Date(sample.time || sample.timestamp).getTime();
        return t >= sessionStart && t <= sessionEnd;
      });

      if (sessionSamples.length > 0) {
        // Average BPM across all samples in the session (matches mobile)
        const sum = sessionSamples.reduce((acc, s) => acc + (s.beatsPerMinute || 0), 0);
        latestHeartRate = Math.round(sum / sessionSamples.length);
        latestTimestamp = mostRecentSession.endTime;
        console.log('Session avg BPM: ' + latestHeartRate + ' from ' + sessionSamples.length + ' samples');
      }
    }

    // Fallback: use the most recent single sample if no session match
    if (latestHeartRate === 0 && allSamples.length > 0) {
      const sorted = allSamples.sort((a, b) =>
        new Date(b.time || b.timestamp) - new Date(a.time || a.timestamp)
      );
      latestHeartRate = sorted[0].beatsPerMinute || 0;
      latestTimestamp = sorted[0].time || sorted[0].timestamp;
    }

    // Trend label based on BPM value
    const trendLabel = latestHeartRate > 0 ? 'Latest session avg BPM' : 'No heart rate recorded';

    return res.status(200).json({
      success: true,
      data: {
        latestHeartRate,
        latestTimestamp,
        trend: 'neutral',
        trendValue: latestHeartRate > 0 ? latestHeartRate + ' bpm' : '0 bpm',
        trendLabel,
        recordCount: heartRateData.length
      }
    });

  } catch (error) {
    console.error('Error in getHeartRateStats:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.toString()
    });
  }
};
