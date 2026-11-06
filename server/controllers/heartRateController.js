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

    // ── MATCH MOBILE APP LOGIC ──────────────────────────────────────────────
    // BPM = avg BPM during TODAY's exercise session only.
    // No exercise today → 0 BPM (identical to mobile home screen).

    // Timezone-aware "today" (default UTC+8 Philippine time)
    const tzOffsetMinutes = req.query.tzOffset !== undefined
      ? parseInt(req.query.tzOffset)
      : (req.headers['x-timezone-offset'] ? parseInt(req.headers['x-timezone-offset']) : -480);

    const now = new Date();
    const clientNow = new Date(now.getTime() - (tzOffsetMinutes * 60 * 1000));
    const clientStartOfDay = new Date(clientNow);
    clientStartOfDay.setUTCHours(0, 0, 0, 0);
    const startOfToday = new Date(clientStartOfDay.getTime() + (tzOffsetMinutes * 60 * 1000));
    const clientEndOfDay = new Date(clientNow);
    clientEndOfDay.setUTCHours(23, 59, 59, 999);
    const endOfToday = new Date(clientEndOfDay.getTime() + (tzOffsetMinutes * 60 * 1000));

    // 1. Find today's exercise session
    const todayExercise = await mongoose.model('ExerciseSession').findOne({
      user: userId,
      startTime: { $gte: startOfToday, $lte: endOfToday }
    }).sort({ endTime: -1 });

    // No exercise today → 0 BPM immediately (matches mobile)
    if (!todayExercise) {
      return res.status(200).json({
        success: true,
        data: {
          latestHeartRate: 0,
          latestTimestamp: null,
          trend: 'neutral',
          trendValue: '0 bpm',
          trendLabel: 'No activity recorded today'
        }
      });
    }

    // 2. Get all heart rate records for the user
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
          trendLabel: 'No activity recorded today'
        }
      });
    }

    // 3. Flatten all samples
    const allSamples = heartRateData.flatMap(record =>
      (record.samples || []).map(s => ({ ...s.toObject(), recordStart: record.startTime, recordEnd: record.endTime }))
    );

    // 4. Filter samples within today's exercise session window
    const sessionStart = new Date(todayExercise.startTime).getTime();
    const sessionEnd = new Date(todayExercise.endTime).getTime();
    const sessionSamples = allSamples.filter(sample => {
      const t = new Date(sample.time || sample.timestamp).getTime();
      return t >= sessionStart && t <= sessionEnd;
    });

    let latestHeartRate = 0;
    let latestTimestamp = null;

    if (sessionSamples.length > 0) {
      const sum = sessionSamples.reduce((acc, s) => acc + (s.beatsPerMinute || 0), 0);
      latestHeartRate = Math.round(sum / sessionSamples.length);
      latestTimestamp = todayExercise.endTime;
      console.log('Session avg BPM: ' + latestHeartRate + ' from ' + sessionSamples.length + ' samples');
    }
    // Exercise exists today but no HR samples in that window → stays 0

    const trendLabel = latestHeartRate > 0 ? 'Latest session avg BPM' : 'No activity recorded today';

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
