import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import Models
import userModel from '../models/userModel.js';
import Step from '../models/stepsModel.js';
import HeartRate from '../models/heartRateModel.js';
import SleepSession from '../models/sleepSessionModel.js';

// Setup SleepStageTypes from Health Connect docs
const SleepStageType = {
  UNKNOWN: 0,
  AWAKE: 1,
  SLEEPING: 2,
  OUT_OF_BED: 3,
  LIGHT: 4,
  DEEP: 5,
  REM: 6
};

// Generate UUID for records
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const seedData = async () => {
  try {
    // Connect to database
    console.log('Connecting to MongoDB...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    // Find the target user
    const emailToSeed = 'justinevilocura12@gmail.com';
    const user = await userModel.findOne({ email: emailToSeed });
    
    if (!user) {
      throw new Error(`User with email ${emailToSeed} not found in database!`);
    }
    
    const userId = user._id;
    console.log(`Found user: ${user.name} (${userId})`);

    // Clean existing data for this user to prevent duplicates during test
    await Step.deleteMany({ user: userId });
    await HeartRate.deleteMany({ user: userId });
    await SleepSession.deleteMany({ user: userId });
    console.log('Cleared existing health data for this user.');

    // Seed data for the past 7 days
    const today = new Date();
    
    const stepsRecords = [];
    const heartRateRecords = [];
    const sleepRecords = [];

    for (let i = 0; i < 30; i++) {
      // Create a date object for 'i' days ago
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      
      // We will generate the data for the 'targetDate'
      
      // 1. STEPS (Random between 4000 and 12000 steps per day)
      const stepsCount = Math.floor(Math.random() * 8000) + 4000;
      
      // Distribute steps randomly throughout the day (9 AM to 8 PM)
      const startSteps = new Date(targetDate);
      startSteps.setHours(9, 0, 0, 0);
      const endSteps = new Date(targetDate);
      endSteps.setHours(20, 0, 0, 0);

      stepsRecords.push({
        user: userId,
        id: generateId(),
        lastModifiedTime: new Date(),
        count: stepsCount,
        startTime: startSteps,
        endTime: endSteps
      });

      // 2. HEART RATE
      // Generate 5 random heart rate readings throughout the day
      const samples = [];
      for (let j = 0; j < 5; j++) {
        const sampleTime = new Date(targetDate);
        sampleTime.setHours(8 + (j * 3), 0, 0, 0); // roughly every 3 hours starting at 8 AM
        
        samples.push({
          beatsPerMinute: Math.floor(Math.random() * (95 - 65 + 1)) + 65, // 65-95 bpm
          time: sampleTime
        });
      }
      
      heartRateRecords.push({
        user: userId,
        id: generateId(),
        lastModifiedTime: new Date(),
        samples: samples,
        startTime: samples[0].time,
        endTime: samples[samples.length - 1].time
      });

      // 3. SLEEP SESSION
      // Sleep ranges from 10 PM (previous day) to 6-8 AM (current day)
      // Total sleep time: 6.5 to 8.5 hours
      const sleepStart = new Date(targetDate);
      sleepStart.setDate(sleepStart.getDate() - 1);
      sleepStart.setHours(22 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0); // 10 PM to Midnight
      
      const sleepDurationMs = (Math.floor(Math.random() * 2) + 6.5) * 60 * 60 * 1000; // 6.5 - 8.5 hours
      const sleepEnd = new Date(sleepStart.getTime() + sleepDurationMs);

      // Generate realistic sleep stages
      // Typical cycle: Light -> Deep -> Light -> REM, repeating 4-5 times
      const stages = [];
      let currentStageStart = new Date(sleepStart);
      
      while (currentStageStart < sleepEnd) {
        // Light sleep (40-60 mins)
        const lightEnd = new Date(currentStageStart.getTime() + (Math.random() * 20 + 40) * 60000);
        if (lightEnd > sleepEnd) break;
        stages.push({ startTime: new Date(currentStageStart), endTime: lightEnd, stage: SleepStageType.LIGHT });
        currentStageStart = lightEnd;

        // Deep sleep (20-40 mins)
        const deepEnd = new Date(currentStageStart.getTime() + (Math.random() * 20 + 20) * 60000);
        if (deepEnd > sleepEnd) break;
        stages.push({ startTime: new Date(currentStageStart), endTime: deepEnd, stage: SleepStageType.DEEP });
        currentStageStart = deepEnd;

        // REM sleep (20-40 mins)
        const remEnd = new Date(currentStageStart.getTime() + (Math.random() * 20 + 20) * 60000);
        if (remEnd > sleepEnd) break;
        stages.push({ startTime: new Date(currentStageStart), endTime: remEnd, stage: SleepStageType.REM });
        currentStageStart = remEnd;
        
        // Random short awake period occasionally (1-5 mins)
        if (Math.random() > 0.7) {
            const awakeEnd = new Date(currentStageStart.getTime() + (Math.random() * 4 + 1) * 60000);
            if (awakeEnd > sleepEnd) break;
            stages.push({ startTime: new Date(currentStageStart), endTime: awakeEnd, stage: SleepStageType.AWAKE });
            currentStageStart = awakeEnd;
        }
      }
      
      // Ensure the last stage ends exactly at sleepEnd
      if (stages.length > 0) {
          stages[stages.length - 1].endTime = sleepEnd;
      }

      sleepRecords.push({
        user: userId,
        id: generateId(),
        title: "Night Sleep",
        lastModifiedTime: new Date(),
        startTime: sleepStart,
        endTime: sleepEnd,
        stages: stages
      });
    }

    // Insert all records into DB
    await Step.insertMany(stepsRecords);
    console.log(`Inserted ${stepsRecords.length} Step records.`);
    
    await HeartRate.insertMany(heartRateRecords);
    console.log(`Inserted ${heartRateRecords.length} HeartRate records.`);
    
    await SleepSession.insertMany(sleepRecords);
    console.log(`Inserted ${sleepRecords.length} SleepSession records.`);

    console.log('✅ Successfully seeded all dummy data for justinevilocura12@gmail.com!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

seedData();
