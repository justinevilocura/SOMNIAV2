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

    // Find the most recent heart rate sample
    let latestHeartRate = 0;
    let latestTimestamp = null;
    let previousHeartRate = 0;
    let foundLatest = false;
    let foundPrevious = false;

    // Look through records starting from most recent
    for (const record of heartRateData) {
      if (record.samples && record.samples.length > 0) {
        // Sort samples by timestamp (most recent first)
        const sortedSamples = record.samples.sort((a, b) => 
          new Date(b.time || b.timestamp) - new Date(a.time || a.timestamp)
        );

        for (const sample of sortedSamples) {
          if (sample.beatsPerMinute) {
            if (!foundLatest) {
              latestHeartRate = sample.beatsPerMinute;
              latestTimestamp = new Date(sample.time || sample.timestamp || record.endTime);
              foundLatest = true;
            } else if (!foundPrevious) {
              previousHeartRate = sample.beatsPerMinute;
              foundPrevious = true;
              break;
            }
          }
        }
        
        if (foundLatest && foundPrevious) break;
      }
    }

    console.log(`Latest heart rate: ${latestHeartRate}, Previous: ${previousHeartRate}`);

    // Calculate trend
    let trend = 'neutral';
    let trendValue = '0 bpm';
    let trendLabel = 'No trend data';

    if (foundPrevious && latestHeartRate !== previousHeartRate) {
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
    } else if (foundLatest) {
      trendLabel = 'Latest reading available';
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