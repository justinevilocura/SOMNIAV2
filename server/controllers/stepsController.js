import Step from "../models/stepsModel.js";

export const addStepData = async (req, res) => {
  const steps = req.body; // expecting an array of step objects

  if (!Array.isArray(steps)) {
    return res.status(400).json({ success: false, message: 'Request body must be an array' });
  }
 
  try {
    for (const step of steps) {
      const { id, lastModifiedTime, count, startTime, endTime, userId } = step;

      if (!id || !lastModifiedTime || !count || !startTime || !endTime || !userId) {
        return res.status(400).json({ success: false, message: 'Missing required details in one or more steps' });
      }

      await Step.findOneAndUpdate(
        { id },
        {
          user: userId,
          id,
          lastModifiedTime: new Date(lastModifiedTime),
          count,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    return res.status(200).json({ success: true, message: "Step data synced successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStepStats = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    console.log("Fetching step data for user:", userId);

    // Get start and end of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    console.log("Filtering for today:", startOfToday, "to", endOfToday);

    // Find step data for today only
    const todayStepData = await Step.find({ 
      user: userId,
      startTime: {
        $gte: startOfToday,
        $lte: endOfToday
      }
    }).sort({ startTime: -1 });

    // Get ALL historical step data for average calculation
    const allStepData = await Step.find({ user: userId })
      .sort({ startTime: -1 });

    console.log(`Found ${todayStepData.length} step records for today`);
    console.log(`Found ${allStepData.length} total step records for average calculation`);

    // Calculate today's total steps
    let totalStepsToday = 0;
    todayStepData.forEach((record) => {
      totalStepsToday += record.count || 0;
    });

    // Calculate overall average from all historical data
    let overallTotalSteps = 0;
    let overallAverageSteps = 0;

    if (allStepData.length > 0) {
      allStepData.forEach((record) => {
        overallTotalSteps += record.count || 0;
      });
      overallAverageSteps = Math.round(overallTotalSteps / allStepData.length);
    }

    // For comparison with previous days, get yesterday's data
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    
    const endOfYesterday = new Date(endOfToday);
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);

    const yesterdayStepData = await Step.find({ 
      user: userId,
      startTime: {
        $gte: startOfYesterday,
        $lte: endOfYesterday
      }
    });

    let totalStepsYesterday = 0;
    yesterdayStepData.forEach((record) => {
      totalStepsYesterday += record.count || 0;
    });

    // Handle case when no data exists
    if (!allStepData.length) {
      return res.status(200).json({
        success: true,
        data: {
          totalSteps: 0,
          averageSteps: 0,
          recordCount: 0,
          message: "No step data found",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalSteps: totalStepsToday, // Today's total only
        averageSteps: overallAverageSteps, // Average from all historical data
        previousAverageSteps: totalStepsYesterday,
        recordCount: allStepData.length, // Total number of records
      },
    });
  } catch (error) {
    console.error("Error in getStepStats:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};