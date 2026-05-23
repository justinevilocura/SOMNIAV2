import express from 'express';
import { addBloodPressureData, deleteBloodPressureData, getLatestBloodPressure, updateBloodPressureData } from '../controllers/bloodPressureController.js';
import userAuth from '../middleware/userAuth.js';

const bpRouter = express.Router();

bpRouter.post('/addBloodPressure', userAuth, addBloodPressureData);
bpRouter.get('/get/:userId', userAuth, getLatestBloodPressure);
bpRouter.patch('/update/:id', userAuth, updateBloodPressureData);
bpRouter.delete('/delete/:id',userAuth, deleteBloodPressureData);
export default bpRouter;
