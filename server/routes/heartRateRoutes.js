import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { addHeartRate, getHeartRateStats } from '../controllers/heartRateController.js';

const heartRateRouter = express.Router();
heartRateRouter.post('/addHeartRate', userAuth, addHeartRate);
heartRateRouter.get('/stats', userAuth, getHeartRateStats);

export default heartRateRouter;



