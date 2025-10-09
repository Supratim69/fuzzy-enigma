import { Router } from "express";
const router = Router();

router.post("/search", async (req, res) => {
    // placeholder: query params: { ingredients: ["tomato","onion"], filters: {...} }
    return res.json({ ok: true, msg: "search not implemented yet" });
});

router.post("/suggest", async (req, res) => {
    // placeholder for RAG suggest endpoint (will call Pinecone + Gemini)
    return res.json({ ok: true, msg: "suggest not implemented yet" });
});

export default router;
