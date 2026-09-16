import express from 'express';
import { 
    addExerciseSession, 
    getExerciseSessions, 
    getExerciseSessionById, 
    updateExerciseSession, 
    deleteExerciseSession,
    getExerciseStats,
    bulkAddExerciseSessions
} from '../controllers/exerciseController.js';
import userAuth from '../middleware/userAuth.js';

const exerciseRouter = express.Router();

exerciseRouter.post('/addExercise', userAuth, addExerciseSession);
exerciseRouter.post('/bulkAddExercise', userAuth, bulkAddExerciseSessions);
exerciseRouter.get('/history', userAuth, getExerciseSessions);
exerciseRouter.get('/stats', userAuth, getExerciseStats);
exerciseRouter.get('/:id', userAuth, getExerciseSessionById);
exerciseRouter.put('/:id', userAuth, updateExerciseSession);
exerciseRouter.delete('/:id', userAuth, deleteExerciseSession);

export default exerciseRouter;
