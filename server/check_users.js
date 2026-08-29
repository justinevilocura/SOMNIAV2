import mongoose from 'mongoose';
import 'dotenv/config';
import User from './models/userModel.js';
import Step from './models/stepsModel.js';

async function checkUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const users = await User.find({});
  console.log("=== USERS ===");
  users.forEach(u => console.log(u.id || u._id, u.name, u.email, u.username));

  const allSteps = await Step.find().sort({ startTime: -1 }).limit(20);
  console.log("\n=== LATEST 20 STEPS (ALL USERS) ===");
  allSteps.forEach(s => console.log("User:", s.user, "Time:", s.startTime, "Count:", s.count));

  process.exit(0);
}

checkUsers();
