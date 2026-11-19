import 'dotenv/config';
import connectDB from './config/mongodb.js';
import mongoose from 'mongoose';
import { cleanHistoricalDatabase } from './controllers/dataCleaningController.js';

async function runCleaner() {
  console.log('--- Connecting to SOMNiA MongoDB Cluster ---');
  await connectDB();

  // Mock req, res to call the controller directly
  const req = { body: {} };
  const res = {
    status: (statusCode) => ({
      json: (data) => {
        console.log(`\n=== DATABASE CLEANING REPORT (HTTP ${statusCode}) ===`);
        console.log(JSON.stringify(data, null, 2));
        mongoose.connection.close();
        process.exit(0);
      }
    })
  };

  console.log('--- Running Retroactive Data Cleaning & Audit on Historical Records ---');
  await cleanHistoricalDatabase(req, res);
}

runCleaner().catch((err) => {
  console.error('Error running cleaner:', err);
  process.exit(1);
});
