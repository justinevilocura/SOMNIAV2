import express from 'express';
import { cleanHistoricalDatabase } from '../controllers/dataCleaningController.js';

const dataCleaningRouter = express.Router();

// Trigger full historical database cleaning and audit
dataCleaningRouter.post('/clean-history', cleanHistoricalDatabase);
dataCleaningRouter.get('/clean-history', cleanHistoricalDatabase);

export default dataCleaningRouter;
