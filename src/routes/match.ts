// src/routes/match.ts
import express from "express";
import { postMatchByIngredients } from "../controllers/matchController.js";
const router = express.Router();

router.post("/recipes/match", postMatchByIngredients);

export default router;
