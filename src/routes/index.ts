import { Router } from "express";
const router = Router();

router.get("/", (_req, res) =>
    res.json({ name: "smart-recipe-rag-api", version: "0.1.0" })
);

router.use("/recipes", (await import("./recipes.js")).default);

export default router;
