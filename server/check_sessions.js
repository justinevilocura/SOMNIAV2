import mongoose from 'mongoose';
import 'dotenv/config';
import Exercise from './models/exerciseModel.js';
import SleepSession from './models/sleepSessionModel.js';

async function checkSessions() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const exer = await Exercise.find().sort({ startTime: -1 }).limit(2);
  console.log("=== EXERCISE ===");
  exer.forEach(e => console.log(e.startTime, e.endTime, e.exerciseType));

  const sleep = await SleepSession.find().sort({ startTime: -1 }).limit(2);
  console.log("\n=== SLEEP ===");
  sleep.forEach(s => console.log(s.startTime, s.endTime));
  
  process.exit(0);
}

checkSessions();
