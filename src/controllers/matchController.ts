// src/controllers/matchController.ts
import { type Request, type Response } from "express";
import fs from "fs-extra";
import path from "path";
import { ensureClients } from "../utils/clients.js";
import { aggregateMatches } from "../utils/aggregate.js";

const CACHE_DIR = path.join(process.cwd(), "ingest-cache");
const FULL_RECIPES_FILE = path.join(CACHE_DIR, "full_recipes.json");

function normalizeIngredientToken(s: string) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export async function postMatchByIngredients(req: Request, res: Response) {
    try {
        const body = req.body || {};
        const ingredients: string[] = (body.ingredients || []).map(
            (i: string) => normalizeIngredientToken(i)
        );
        if (!ingredients.length)
            return res.status(400).json({ error: "ingredients required" });

        // load recipes metadata cache (full recipes)
        if (!fs.existsSync(FULL_RECIPES_FILE))
            return res
                .status(500)
                .json({ error: "full recipes cache not found" });
        const full = fs.readJSONSync(FULL_RECIPES_FILE);

        const providedSet = new Set(ingredients);

        // exact subset match scan (cheap)
        const exactMatches: any[] = [];
        for (const [parentId, r] of Object.entries(full)) {
            const reqIngRaw = (r as any).ingredients || "";
            const reqTokens = reqIngRaw
                .split(/[,;|\n]/)
                .map((x: string) => normalizeIngredientToken(x))
                .filter(Boolean);
            const missing = reqTokens.filter(
                (t: string) => !providedSet.has(t)
            );
            const matchedCount = reqTokens.length - missing.length;
            const matchScore = reqTokens.length
                ? matchedCount / reqTokens.length
                : 0;
            if (matchScore === 1) {
                exactMatches.push({
                    parentId,
                    score: 1,
                    missingIngredients: [],
                    recipe: r,
                });
            } else if (matchScore >= 0.6) {
                exactMatches.push({
                    parentId,
                    score: matchScore,
                    missingIngredients: missing,
                    recipe: r,
                });
            }
        }

        // if we have enough strict matches, return them sorted
        exactMatches.sort((a, b) => b.score - a.score);
        if (exactMatches.length >= 10) {
            return res.json({ results: exactMatches.slice(0, 50) });
        }

        // fallback: vector search for fuzzy matches
        const { embeddingsClient, pineconeIndex, namespace } =
            await ensureClients();
        const qText = ingredients.join(" ");
        const qVecs = await embeddingsClient!.embedDocuments([qText]);
        const qVec = qVecs[0];
        const reply = await pineconeIndex.query({
            queryRequest: {
                vector: qVec,
                topK: 50,
                includeMetadata: true,
                namespace,
            },
        });
        const matches = reply.matches || [];
        const parents = aggregateMatches(matches, 50);

        // compute missing ingredients for top parents (best-effort)
        const results = parents.map((p) => {
            const r = full[p.parentId];
            const reqIngRaw = r?.ingredients || "";
            const reqTokens = reqIngRaw
                .split(/[,;|\n]/)
                .map((x: string) => normalizeIngredientToken(x))
                .filter(Boolean);
            const missing = reqTokens.filter(
                (t: string) => !providedSet.has(t)
            );
            const matchScore = reqTokens.length
                ? (reqTokens.length - missing.length) / reqTokens.length
                : 0;
            return {
                parentId: p.parentId,
                matchScore,
                missingIngredients: missing,
                fullRecipeSnippet: r && r.title ? r.title : undefined,
                metadata: r?.metadata || {},
            };
        });

        results.sort((a, b) => b.matchScore - a.matchScore);
        return res.json({ results: results.slice(0, 50) });
    } catch (err) {
        console.error("matchController error:", err);
        return res
            .status(500)
            .json({ error: "internal_error", detail: String(err) });
    }
}
