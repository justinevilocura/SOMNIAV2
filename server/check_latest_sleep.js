import mongoose from 'mongoose';
import 'dotenv/config';
import SleepSession from './models/sleepSessionModel.js';

async function checkSleep() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const sleep = await SleepSession.find().sort({ endTime: -1 }).limit(1);
  if (!sleep.length) {
    console.log("No sleep found");
    process.exit(0);
  }
  
  const latestSleep = sleep[0];
  console.log("Latest Sleep Session:");
  console.log("Start:", latestSleep.startTime);
  console.log("End:", latestSleep.endTime);
  
  const startMs = new Date(latestSleep.startTime).getTime();
  const endMs = new Date(latestSleep.endTime).getTime();
  const totalMs = endMs - startMs;
  
  const totalMinutes = Math.floor(totalMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  console.log(`Total duration (End - Start): ${hours} hrs ${minutes} mins`);
  
  let actualSleepMs = 0;
  if (latestSleep.stages && latestSleep.stages.length > 0) {
    latestSleep.stages.forEach(stage => {
      console.log(`Stage ${stage.stage}: ${new Date(stage.startTime).toISOString()} to ${new Date(stage.endTime).toISOString()}`);
      if (stage.stage !== 1) { // 1 is Awake in Health Connect
        const stageStart = new Date(stage.startTime).getTime();
        const stageEnd = new Date(stage.endTime).getTime();
        actualSleepMs += (stageEnd - stageStart);
      }
    });
  }
  
  const actualMinutes = Math.floor(actualSleepMs / (1000 * 60));
  const actualHours = Math.floor(actualMinutes / 60);
  const actualMins = actualMinutes % 60;
  
  console.log(`Actual Sleep duration (excluding Awake): ${actualHours} hrs ${actualMins} mins`);
  
  process.exit(0);
}

checkSleep();
