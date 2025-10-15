import type { Request, Response } from "express";
import { ensureClients } from "../utils/clients.js";
import { aggregateMatches } from "../utils/aggregate.js";

export async function postSearch(req: Request, res: Response) {
    try {
        console.log("[Search] Received search request:", req.body);

        const body = req.body || {};
        const query = (body.query || "").toString().trim();
        if (!query) {
            console.log("[Search] Error: No query provided");
            return res.status(400).json({ error: "query is required" });
        }

        const filters = body.filters;
        const topK = Math.min(Number(body.topK || 10), 10); // Ensure max 10 results
        const namespace = body.namespace || undefined;

        console.log("[Search] Processing query:", {
            query,
            topK,
            filters,
            namespace,
        });

        const {
            embeddingsClient,
            pineconeIndex,
            namespace: defaultNs,
        } = await ensureClients();
        if (!embeddingsClient || !pineconeIndex)
            return res.status(500).json({ error: "clients not ready" });

        const qVecs = await embeddingsClient.embedDocuments([query]);
        const qVec = qVecs?.[0];
        if (!qVec || qVec.length === 0)
            return res.status(500).json({ error: "failed to embed query" });

        const CHUNK_FACTOR = 3;
        const queryTopK = Math.max(topK * CHUNK_FACTOR, topK * 2);

        const pineconeFilter =
            filters && Object.keys(filters).length ? filters : undefined;

        const queryRequest = {
            vector: qVec,
            topK: queryTopK,
            includeMetadata: true,
            includeValues: false,
            filter: pineconeFilter,
        };

        const reply = await pineconeIndex
            .namespace(namespace || defaultNs)
            .query(queryRequest);
        const matches = reply.matches || [];

        const parents = aggregateMatches(matches, topK);
        const out = parents.map((p) => ({
            parentId: p.parentId,
            score: Number(p.score.toFixed(6)),
            title: p.title,
            snippet: p.snippet,
            instructions: p.instructions, // Include instructions from metadata
            matchedChunks: p.matchedChunks.slice(0, 5).map((m) => ({
                id: m.id,
                score: m.score,
                metadata: m.metadata,
            })),
        }));

        console.log("[Search] Returning results:", {
            count: out.length,
            query,
        });
        return res.json({ results: out });
    } catch (err) {
        console.error("searchController error:", err);
        return res
            .status(500)
            .json({ error: "internal_error", detail: String(err) });
    }
}
