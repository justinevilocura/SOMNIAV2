import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { getUserData, updateUserGoals, updateAvatar } from '../controllers/userController.js';


const userRouter = express.Router();

userRouter.get('/data', userAuth, getUserData);
userRouter.post('/update-goals', userAuth, updateUserGoals);
userRouter.post('/update-avatar', userAuth, updateAvatar);

export default userRouter;