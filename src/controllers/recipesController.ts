import { type Request, type Response } from "express";
import fs from "fs-extra";
import path from "path";

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
