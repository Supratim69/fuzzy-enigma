import express from "express";
import {
    getRecipeById,
    getRecipeByUuid,
} from "../controllers/recipesController.js";
const router = express.Router();

// Get recipe by UUID from database
router.get("/recipe/:id", getRecipeByUuid);

// Get recipe by parentId from cache (legacy)
router.get("/recipes/:parentId", getRecipeById);

export default router;
