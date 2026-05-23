import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { 
  addSleepSession, 
  getSleepSessions, 
  getDetailedSleepStats, 
  getSleepHistory,
  getLatestSleepSession  // Add this import
} from '../controllers/sleepSessionController.js';

const sleepSessionRouter = express.Router();

sleepSessionRouter.post('/addSleepSession', userAuth, addSleepSession);
sleepSessionRouter.get('/stats', userAuth, getSleepSessions);
sleepSessionRouter.get('/detailed-stats', userAuth, getDetailedSleepStats);
sleepSessionRouter.get('/history', userAuth, getSleepHistory);
sleepSessionRouter.get('/latest', userAuth, getLatestSleepSession); 

export default sleepSessionRouter;