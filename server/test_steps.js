import mongoose from 'mongoose';
import 'dotenv/config';
import Step from './models/stepsModel.js';
import HeartRate from './models/heartRateModel.js';

async function testStats() {
  await mongoose.connect(process.env.MONGODB_URI);
  const userId = "6a0f4c00125006cde73497ae"; // Justine Vilocura
  
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const todayStepData = await Step.find({ 
    user: userId,
    startTime: {
      $gte: startOfToday,
      $lte: endOfToday
    }
  });
  
  let totalStepsToday = 0;
  todayStepData.forEach((record) => {
    totalStepsToday += record.count || 0;
  });
  console.log("TEST STEPS:", totalStepsToday);

  process.exit(0);
}

testStats();
