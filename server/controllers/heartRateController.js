import HeartRate from '../models/heartRateModel.js';
import userModel from '../models/userModel.js';

export const addHeartRate = async (req, res) => {
  let records = req.body;
  let sessionAvgBpm = null;

  if (!Array.isArray(req.body) && req.body.records) {
    records = req.body.records;
    sessionAvgBpm = req.body.sessionAvgBpm;
  }

  try {
    const targetUserId = req.body.userId || records[0]?.userId;
    if (sessionAvgBpm && sessionAvgBpm > 0 && targetUserId) {
      await userModel.findByIdAndUpdate(targetUserId, { sessionAvgBpm: Math.round(sessionAvgBpm) });
    }

    for (const record of records) {
      const { id, lastModifiedTime, startTime, endTime, samples, userId } = record;

      if (!id || !lastModifiedTime || !startTime || !endTime || !samples || !userId) {
        continue;
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
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    console.log('Fetching heart rate data for user:', userId);

    const user = await userModel.findById(userId);

    // Get all heart rate data for the user, sorted by most recent
    const heartRateData = await HeartRate.find({
      user: userId
    }).sort({ startTime: -1 });

    console.log(`Found ${heartRateData.length} heart rate records`);

    if (!heartRateData.length) {
      console.log('No heart rate data found for user');
      return res.status(200).json({
        success: true,
        data: {
          latestHeartRate: 0,
          latestTimestamp: null,
          sampleCount: 0,
          trend: 'neutral',
          trendValue: '0 bpm',
          trendLabel: 'No heart rate data found'
        }
      });
    }

    // Find the most recent heart rate sample and calculate average heart rate across latest session
    let latestHeartRate = 0;
    let latestTimestamp = null;
    let previousHeartRate = 0;
    let foundLatest = false;
    let foundPrevious = false;
    let totalHeartRateSum = 0;
    let totalSampleCount = 0;

    const latestDateStr = heartRateData[0]?.startTime 
      ? new Date(heartRateData[0].startTime).toDateString() 
      : null;

    // Look through records starting from most recent
    for (const record of heartRateData) {
      if (record.samples && record.samples.length > 0) {
        const recordDateStr = new Date(record.startTime).toDateString();
        const isLatestSession = !latestDateStr || recordDateStr === latestDateStr;

        // Sort samples by timestamp (most recent first)
        const sortedSamples = [...record.samples].sort((a, b) => 
          new Date(b.time || b.timestamp) - new Date(a.time || a.timestamp)
        );

        for (const sample of sortedSamples) {
          if (sample.beatsPerMinute && sample.beatsPerMinute > 0) {
            // Only include in session average if it belongs to the latest session/date
            if (isLatestSession) {
              totalHeartRateSum += sample.beatsPerMinute;
              totalSampleCount += 1;
            }

            if (!foundLatest) {
              latestHeartRate = sample.beatsPerMinute;
              latestTimestamp = new Date(sample.time || sample.timestamp || record.endTime);
              foundLatest = true;
            } else if (!foundPrevious) {
              previousHeartRate = sample.beatsPerMinute;
              foundPrevious = true;
            }
          }
        }
      }
    }

    // Use user's synced sessionAvgBpm if set, otherwise calculate across latest session samples
    const sessionAvgBpm = (user && user.sessionAvgBpm > 0) 
      ? Math.round(user.sessionAvgBpm) 
      : (totalSampleCount > 0 ? Math.round(totalHeartRateSum / totalSampleCount) : latestHeartRate);

    console.log(`Latest heart rate: ${latestHeartRate}, Session Avg BPM: ${sessionAvgBpm}, Previous: ${previousHeartRate}`);

    // Calculate trend
    let trend = 'neutral';
    let trendValue = '0 bpm';
    let trendLabel = 'No trend data';

    if (foundPrevious && sessionAvgBpm !== previousHeartRate) {
      const difference = sessionAvgBpm - previousHeartRate;
      if (difference > 0) {
        trend = 'up';
        trendValue = `+${difference} bpm`;
        trendLabel = 'Higher than previous reading';
      } else {
        trend = 'down';
        trendValue = `${Math.abs(difference)} bpm`;
        trendLabel = 'Lower than previous reading';
      }
    } else if (foundLatest) {
      trendLabel = 'Session average reading available';
    }

    if (!foundLatest) {
      return res.status(200).json({
        success: true,
        data: {
          latestHeartRate: 0,
          latestTimestamp: null,
          sampleCount: 0,
          trend: 'neutral',
          trendValue: '0 bpm',
          trendLabel: 'No valid heart rate samples found'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        latestHeartRate: sessionAvgBpm,
        latestTimestamp,
        previousHeartRate,
        trend,
        trendValue,
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