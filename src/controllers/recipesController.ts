import { type Request, type Response } from "express";
import fs from "fs-extra";
import path from "path";
import { prisma } from "../database/connection.js";

const CACHE_DIR = path.join(process.cwd(), "ingest-cache");
const FULL_RECIPES_FILE = path.join(CACHE_DIR, "full_recipes.json");

export async function getRecipeById(req: Request, res: Response) {
    try {
        const parentId = req.params.parentId;
        if (!parentId)
            return res.status(400).json({ error: "parentId required" });
        if (!fs.existsSync(FULL_RECIPES_FILE))
            return res
                .status(404)
                .json({ error: "no full recipes cache found" });
        const full = fs.readJSONSync(FULL_RECIPES_FILE);
        const recipe = full[parentId];
        if (!recipe) return res.status(404).json({ error: "recipe not found" });
        return res.json(recipe);
    } catch (err) {
        console.error("recipesController error:", err);
        return res
            .status(500)
            .json({ error: "internal_error", detail: String(err) });
    }
}

/**
 * Get recipe details by UUID from PostgreSQL database
 * GET /api/recipe/:id
 */
export async function getRecipeByUuid(req: Request, res: Response) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: "Recipe ID is required" });
        }

        // Validate UUID format
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({ error: "Invalid recipe ID format" });
        }

        const recipe = await prisma.recipe.findUnique({
            where: {
                id: id,
            },
        });

        if (!recipe) {
            return res.status(404).json({ error: "Recipe not found" });
        }

        // Transform the data to match the expected frontend format
        const transformedRecipe = {
            id: recipe.id,
            title: recipe.title,
            description: recipe.instructions
                ? recipe.instructions.length > 150
                    ? recipe.instructions.substring(0, 150) + "..."
                    : recipe.instructions
                : "A delicious recipe",
            imageUrl:
                recipe.imageUrl ||
                `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=400&fit=crop`,
            ingredients: recipe.ingredients
                ? recipe.ingredients.split("\n").filter((ing) => ing.trim())
                : [],
            instructions: recipe.instructions || "",
            prepTimeMins: recipe.prepTimeMins,
            cookTimeMins: recipe.cookTimeMins,
            servings: recipe.servings,
            cuisine: recipe.cuisine,
            course: recipe.course,
            diet: recipe.diet,
            tags: recipe.tags
                ? recipe.tags.split(",").map((tag) => tag.trim())
                : [],
            recipeUrl: recipe.recipeUrl,
            createdAt: recipe.createdAt,
            updatedAt: recipe.updatedAt,
        };

        return res.json(transformedRecipe);
    } catch (err) {
        console.error("getRecipeByUuid error:", err);
        return res.status(500).json({
            error: "internal_error",
            detail: String(err),
        });
    }
}
