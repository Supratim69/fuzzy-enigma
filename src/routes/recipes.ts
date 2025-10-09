import express from "express";
import { getRecipeById } from "../controllers/recipesController.js";
const router = express.Router();

router.get("/recipes/:parentId", getRecipeById);

export default router;
