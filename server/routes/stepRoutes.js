import express from 'express';
import { addStepData, getStepStats} from '../controllers/stepsController.js';
import userAuth from '../middleware/userAuth.js';

const stepRouter = express.Router();
stepRouter.post('/addStep', userAuth, addStepData)
stepRouter.get('/stats', userAuth, getStepStats)
export default stepRouter;