import SleepSession from '../models/sleepSessionModel.js';

export const addSleepSession = async (req, res) => {
  const sleepSessions = req.body; // expecting an array of sleep session objects

  if (!Array.isArray(sleepSessions)) {
    return res.status(400).json({ success: false, message: 'Request body must be an array' });
  }
 
  try {
    for (const session of sleepSessions) {
      const { stages, lastModifiedTime, id, title, startTime, endTime, userId } = session;

      if (
        !Array.isArray(stages) ||
        !lastModifiedTime ||
        !id ||
        !startTime ||
        !endTime ||
        !userId
      ) {
        return res.status(400).json({ success: false, message: 'Missing required details in one or more sessions' });
      }

      await SleepSession.findOneAndUpdate(
        { id },
        {
          user: userId,
          stages,
          lastModifiedTime: new Date(lastModifiedTime),
          id,
          title: title || null,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    return res.status(200).json({ success: true, message: 'Sleep Session data synced successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// NEW FUNCTION: Get only the latest sleep session
export const getLatestSleepSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    console.log('Fetching latest sleep session for user:', userId);

    // Get the most recent sleep sessions sorted by wake-up time (endTime descending)
    const sessions = await SleepSession.find({
      user: userId
    }).sort({ endTime: -1, startTime: -1 }).limit(10);

    if (!sessions || sessions.length === 0) {
      console.log('No sleep session found for user');
      return res.status(200).json({
        success: true,
        data: {
          latestSessionMinutes: 0,
          latestSessionHours: 0,
          sessionStartTime: null,
          sessionEndTime: null,
          message: 'No sleep session found'
        }
      });
    }

    // The most recent session is the one with the latest endTime (when the user actually woke up)
    // If there are duplicate/partial sync records around the same time, pick the complete/longest one
    const latestEndTime = new Date(sessions[0].endTime).getTime();
    const candidates = sessions.filter(s => {
      const diff = Math.abs(latestEndTime - new Date(s.endTime).getTime());
      return diff <= 2 * 60 * 60 * 1000; // within 2 hours of latest wake-up
    });

    const latestSession = candidates.reduce((best, curr) => {
      const bestDur = new Date(best.endTime) - new Date(best.startTime);
      const currDur = new Date(curr.endTime) - new Date(curr.startTime);
      return currDur > bestDur ? curr : best;
    }, sessions[0]);

    console.log('Latest session found:', {
      id: latestSession.id,
      startTime: latestSession.startTime,
      endTime: latestSession.endTime,
      stagesCount: latestSession.stages?.length || 0
    });

    // Calculate duration using wall-clock time (endTime - startTime) to match mobile app
    const sessionMs = Math.max(0, new Date(latestSession.endTime) - new Date(latestSession.startTime));

    const totalDurationMinutes = sessionMs / (1000 * 60);
    const totalDurationHours = Math.round((totalDurationMinutes / 60) * 100) / 100;

    console.log(`Single latest sleep session: ${Math.round(totalDurationMinutes)} minutes (${totalDurationHours} hours)`);

    return res.status(200).json({
      success: true,
      data: {
        latestSessionMinutes: Math.round(totalDurationMinutes),
        latestSessionHours: totalDurationHours,
        sessionStartTime: latestSession.startTime,
        sessionEndTime: latestSession.endTime,
        sessionId: latestSession.id,
        sessionTitle: latestSession.title,
        lastModified: latestSession.lastModifiedTime,
        sessionCount: 1
      }
    });

  } catch (error) {
    console.error('Error in getLatestSleepSession:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message,
      error: error.toString()
    });
  }
};

export const getSleepSessions = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    console.log('Fetching sleep session data for user:', userId);

    // Get all sleep session data for the user
    const sleepSessions = await SleepSession.find({
      user: userId
    }).sort({ startTime: -1 });

    console.log(`Found ${sleepSessions.length} sleep session records`);

    if (!sleepSessions.length) {
      console.log('No sleep session data found for user');
      return res.status(200).json({
        success: true,
        data: {
          totalSleepMinutes: 0,
          totalSleepHours: 0,
          sessionCount: 0,
          message: 'No sleep session data found'
        }
      });
    }

    // Calculate total sleep time from all sessions (excluding AWAKE (1) and OUT_OF_BED (3) stages)
    let totalSleepMinutes = 0;
    let validSessionCount = 0;

    sleepSessions.forEach(session => {
      if (session.stages && session.stages.length > 0) {
        // Calculate sleep time from stages
        session.stages.forEach(stage => {
          if (stage.startTime && stage.endTime && stage.stage !== 1 && stage.stage !== 3) {
            const stageStartTime = new Date(stage.startTime);
            const stageEndTime = new Date(stage.endTime);
            const stageDurationMs = stageEndTime - stageStartTime;
            const stageDurationMinutes = stageDurationMs / (1000 * 60);
            
            totalSleepMinutes += stageDurationMinutes;
          }
        });
        validSessionCount++;
      } else {
        // Fallback: use session start/end time if no stages
        const sessionStartTime = new Date(session.startTime);
        const sessionEndTime = new Date(session.endTime);
        const sessionDurationMs = sessionEndTime - sessionStartTime;
        const sessionDurationMinutes = sessionDurationMs / (1000 * 60);
        
        totalSleepMinutes += sessionDurationMinutes;
        validSessionCount++;
      }
    });

    const roundedTotalMinutes = Math.ceil(totalSleepMinutes);
    console.log(`Total sleep time calculated: ${roundedTotalMinutes} minutes across ${validSessionCount} sessions`);

    const totalSleepHours = Math.round((roundedTotalMinutes / 60) * 100) / 100; // Round to 2 decimal places

    return res.status(200).json({
      success: true,
      data: {
        totalSleepMinutes: roundedTotalMinutes,
        totalSleepHours,
        sessionCount: validSessionCount,
        recordCount: sleepSessions.length
      }
    });

  } catch (error) {
    console.error('Error in getSleepSessions:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message,
      error: error.toString()
    });
  }
};

export const getDetailedSleepStats = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    const sleepSessions = await SleepSession.find({
      user: userId
    }).sort({ startTime: -1 });

    return res.status(200).json({
      success: true,
      data: {
        sessions: sleepSessions
      }
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getSleepHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    console.log('Fetching sleep history data for user:', userId);

    // Get sleep sessions from the last 60 days for comprehensive history
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const sleepSessions = await SleepSession.find({
      user: userId,
      startTime: { $gte: sixtyDaysAgo }
    }).sort({ startTime: -1 });

    console.log(`Found ${sleepSessions.length} sleep sessions in last 60 days`);

    if (!sleepSessions.length) {
      console.log('No sleep history data found for user');
      return res.status(200).json({
        success: true,
        data: {
          sessions: [],
          summary: {
            totalSessions: 0,
            averageDuration: 0,
            totalSleepHours: 0
          }
        }
      });
    }

    // Calculate summary statistics
    let totalSleepMinutes = 0;
    let validSessionCount = 0;

    const processedSessions = sleepSessions.map(session => {
      let sessionDurationMinutes = 0;

      if (session.stages && session.stages.length > 0) {
        // Calculate from stages (excluding AWAKE (1) and OUT_OF_BED (3))
        session.stages.forEach(stage => {
          if (stage.startTime && stage.endTime && stage.stage !== 1 && stage.stage !== 3) {
            const stageStartTime = new Date(stage.startTime);
            const stageEndTime = new Date(stage.endTime);
            const stageDurationMs = stageEndTime - stageStartTime;
            const stageDurationMinutes = stageDurationMs / (1000 * 60);
            sessionDurationMinutes += stageDurationMinutes;
          }
        });
      } else {
        // Fallback: use session start/end time
        const sessionStartTime = new Date(session.startTime);
        const sessionEndTime = new Date(session.endTime);
        const sessionDurationMs = sessionEndTime - sessionStartTime;
        sessionDurationMinutes = sessionDurationMs / (1000 * 60);
      }

      const roundedSessionMinutes = Math.ceil(sessionDurationMinutes);
      totalSleepMinutes += roundedSessionMinutes;
      validSessionCount++;

      return {
        id: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        stages: session.stages || [],
        title: session.title,
        lastModifiedTime: session.lastModifiedTime,
        durationMinutes: roundedSessionMinutes,
        durationHours: Math.round((roundedSessionMinutes / 60) * 100) / 100
      };
    });

    const averageDurationMinutes = validSessionCount > 0 ? totalSleepMinutes / validSessionCount : 0;
    const totalSleepHours = Math.round((totalSleepMinutes / 60) * 100) / 100;

    console.log(`Processed ${validSessionCount} sessions, total sleep: ${totalSleepHours} hours`);

    return res.status(200).json({
      success: true,
      data: {
        sessions: processedSessions,
        summary: {
          totalSessions: validSessionCount,
          averageDuration: Math.round(averageDurationMinutes),
          averageDurationHours: Math.round((averageDurationMinutes / 60) * 100) / 100,
          totalSleepHours: totalSleepHours,
          totalSleepMinutes: totalSleepMinutes,
          dateRange: {
            from: sixtyDaysAgo.toISOString(),
            to: new Date().toISOString()
          }
        }
      }
    });

  } catch (error) {
    console.error('Error in getSleepHistory:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message,
      error: error.toString()
    });
  }
};