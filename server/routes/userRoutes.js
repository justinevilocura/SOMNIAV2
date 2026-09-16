import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { getUserData, updateUserGoals } from '../controllers/userController.js';


const userRouter = express.Router();

userRouter.get('/data', userAuth, getUserData);
userRouter.post('/update-goals', userAuth, updateUserGoals);

export default userRouter;