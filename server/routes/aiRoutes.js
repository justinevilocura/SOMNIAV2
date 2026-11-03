// server/routes/aiRoutes.js

import express from "express";
import userAuth from "../middleware/userAuth.js";

import {
  calculateInsomniaRisk,
  getInsomniaRiskHistory,
} from "../controllers/insomniaScoreController.js";

const aiRouter = express.Router();

// POST → call AI and save a new risk score
aiRouter.post("/insomnia-risk", userAuth, calculateInsomniaRisk);

// GET → fetch historical risk scores
aiRouter.get("/insomnia-risk/history", userAuth, getInsomniaRiskHistory);

export default aiRouter;
