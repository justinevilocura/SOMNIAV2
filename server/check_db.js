import mongoose from 'mongoose';
import 'dotenv/config';
import Step from './models/stepsModel.js';
import HeartRate from './models/heartRateModel.js';
import SleepSession from './models/sleepSessionModel.js';
import Exercise from './models/exerciseModel.js';

async function checkDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const steps = await Step.find().sort({ startTime: -1 }).limit(10);
  console.log("=== LATEST 10 STEPS ===");
  steps.forEach(s => console.log(s.startTime, s.count));

  const hrs = await HeartRate.find().sort({ startTime: -1 }).limit(2);
  console.log("\n=== LATEST HR RECORDS ===");
  hrs.forEach(h => console.log(h.startTime, h.endTime, "Samples:", h.samples.length));
  
  process.exit(0);
}

checkDB();
