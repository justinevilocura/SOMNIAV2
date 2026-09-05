import mongoose from 'mongoose';
import 'dotenv/config';
import SleepSession from './models/sleepSessionModel.js';

async function checkAllSleeps() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const sleeps = await SleepSession.find().sort({ endTime: -1 }).limit(10);
  
  console.log("Recent Sleep Sessions:");
  sleeps.forEach((sleep, index) => {
    const startMs = new Date(sleep.startTime).getTime();
    const endMs = new Date(sleep.endTime).getTime();
    const totalMs = endMs - startMs;
    
    const totalMinutes = Math.floor(totalMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    console.log(`[${index}] Start: ${sleep.startTime} | End: ${sleep.endTime}`);
    console.log(`    Duration: ${hours} hrs ${minutes} mins`);
  });
  
  process.exit(0);
}

checkAllSleeps();
