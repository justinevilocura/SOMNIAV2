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
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    console.log('Fetching heart rate data for user:', userId);

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

    // --- REPLICATE MOBILE APP SESSION AVERAGE LOGIC ---
    // 1. Get latest Exercise Session
    const latestExercise = await mongoose.model('ExerciseSession').findOne({ user: userId }).sort({ endTime: -1 });
    
    // 2. Get latest Sleep Session
    const latestSleep = await mongoose.model('SleepSession').findOne({ user: userId }).sort({ endTime: -1 });

    let mostRecentSession = null;
    if (latestExercise && latestSleep) {
      if (new Date(latestExercise.endTime).getTime() > new Date(latestSleep.endTime).getTime()) {
        mostRecentSession = latestExercise;
      } else {
        mostRecentSession = latestSleep;
      }
    } else if (latestExercise) {
      mostRecentSession = latestExercise;
    } else if (latestSleep) {
      mostRecentSession = latestSleep;
    }

    let latestHeartRate = 0;
    let latestTimestamp = null;
    let previousHeartRate = 0;

    const allSamples = heartRateData.flatMap(record => 
      (record.samples || []).map(s => ({ ...s.toObject(), parentEndTime: record.endTime }))
    );

    // Sort all samples descending
    const sortedSamples = allSamples.sort((a, b) => 
      new Date(b.time || b.timestamp).getTime() - new Date(a.time || a.timestamp).getTime()
    );

    if (mostRecentSession && sortedSamples.length > 0) {
      const sessionStart = new Date(mostRecentSession.startTime).getTime();
      const sessionEnd = new Date(mostRecentSession.endTime).getTime();
      
      const sessionSamples = sortedSamples.filter(sample => {
        const time = new Date(sample.time || sample.timestamp).getTime();
        return time >= sessionStart && time <= sessionEnd;
      });

      if (sessionSamples.length > 0) {
        const sum = sessionSamples.reduce((acc, curr) => acc + (curr.beatsPerMinute || 0), 0);
        latestHeartRate = Math.floor(sum / sessionSamples.length);
        latestTimestamp = new Date(sessionSamples[0].time || sessionSamples[0].timestamp);
      } else {
        // Fallback to absolute latest
        latestHeartRate = sortedSamples[0].beatsPerMinute || 0;
        latestTimestamp = new Date(sortedSamples[0].time || sortedSamples[0].timestamp || sortedSamples[0].parentEndTime);
      }
    } else if (sortedSamples.length > 0) {
      // Fallback
      latestHeartRate = sortedSamples[0].beatsPerMinute || 0;
      latestTimestamp = new Date(sortedSamples[0].time || sortedSamples[0].timestamp || sortedSamples[0].parentEndTime);
    }

    // Previous logic for trend (simplified)
    if (sortedSamples.length > 1) {
      previousHeartRate = sortedSamples[1].beatsPerMinute || 0;
    }

    console.log(`Latest heart rate: ${latestHeartRate}, Previous: ${previousHeartRate}`);

    // Calculate trend
    let trend = 'neutral';
    let trendValue = '0 bpm';
    let trendLabel = 'No trend data';

    if (previousHeartRate && latestHeartRate !== previousHeartRate) {
      const difference = latestHeartRate - previousHeartRate;
      if (difference > 0) {
        trend = 'up';
        trendValue = `+${difference} bpm`;
        trendLabel = 'Higher than previous reading';
      } else {
        trend = 'down';
        trendValue = `${Math.abs(difference)} bpm`;
        trendLabel = 'Lower than previous reading';
      }
    } else if (latestHeartRate > 0) {
      trendLabel = 'Latest reading available';
    }

    return res.status(200).json({
      success: true,
      data: {
        latestHeartRate,
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