import type { Request, Response } from "express";
import { ensureClients } from "../utils/clients.js";
import { aggregateMatches } from "../utils/aggregate.js";
import fs from "fs-extra";
import { GoogleGenAI } from "@google/genai";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "ingest-cache");
fs.ensureDirSync(CACHE_DIR);
const SMART_CACHE = path.join(CACHE_DIR, "smart_cache.json");
let smartCache: Record<string, any> = {};
let geminiClient: GoogleGenAI | null = null;
if (fs.existsSync(SMART_CACHE)) smartCache = fs.readJSONSync(SMART_CACHE);

function extractTokensFromResponse(response: any): number {
    if (!response) return 0;
    const usageCandidates = [
        response.usage,
        response.usageMetadata,
        response.response?.usage,
        response.result?.usage,
        response.output?.[0]?.usage,
        response.usage?.totalTokenCount,
    ];

    for (const u of usageCandidates) {
        if (!u) continue;
        if (typeof u === "number") return u;
        if (typeof u.totalTokenCount === "number") return u.totalTokenCount;
        if (typeof u.total_tokens === "number") return u.total_tokens;
        if (typeof u.total === "number") return u.total;
        if (
            typeof u.promptTokens === "number" &&
            typeof u.completionTokens === "number"
        )
            return u.promptTokens + u.completionTokens;
    }
    return 0;
}

function extractTextFromContentPiece(piece: any): string {
    if (!piece) return "";
    if (typeof piece === "string") return piece;
    if (typeof piece.text === "string") return piece.text;
    if (typeof piece.content === "string") return piece.content;
    if (piece.type === "output_text" && typeof piece.text === "string")
        return piece.text;
    if (Array.isArray(piece.content)) {
        return piece.content.map(extractTextFromContentPiece).join("\n");
    }
    try {
        return JSON.stringify(piece);
    } catch {
        return String(piece);
    }
}

function getGeminiClient() {
    if (geminiClient) return geminiClient;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey)
        throw new Error("GEMINI_API_KEY is required for Gemini API access");
    geminiClient = new GoogleGenAI({ apiKey });
    return geminiClient;
}

export async function callGemini(
    prompt: string,
    opts: { model?: string; maxTokens?: number; temperature?: number } = {}
): Promise<{ text: string; tokensUsed: number }> {
    const client = getGeminiClient();
    const model = "gemini-2.5-flash";
    const maxOutputTokens =
        typeof opts.maxTokens === "number" ? opts.maxTokens : 800;
    const temperature =
        typeof opts.temperature === "number" ? opts.temperature : 0.0;

    const request: any = {
        model,
        contents: prompt,
        config: { temperature, maxOutputTokens },
    };

    try {
        const response: any = await client.models.generateContent(request);

        if (typeof response?.text === "string" && response.text.length > 0) {
            const tokensUsed = extractTokensFromResponse(response);
            return { text: response.text, tokensUsed };
        }

        if (
            Array.isArray(response?.candidates) &&
            response.candidates.length > 0
        ) {
            const pieces = response.candidates.map((c: any) =>
                extractTextFromContentPiece(c.text ?? c.content ?? c)
            );
            const text = pieces.join("\n\n").trim();
            const tokensUsed = extractTokensFromResponse(response);
            return { text, tokensUsed };
        }

        if (Array.isArray(response?.results) && response.results.length > 0) {
            const pieces = response.results.map((r: any) =>
                extractTextFromContentPiece(r.text ?? r.output ?? r)
            );
            const text = pieces.join("\n\n").trim();
            const tokensUsed = extractTokensFromResponse(response);
            return { text, tokensUsed };
        }

        if (Array.isArray(response?.output) && response.output.length > 0) {
            const pieces = response.output.map((o: any) =>
                extractTextFromContentPiece(o.content ?? o)
            );
            const text = pieces.join("\n\n").trim();
            const tokensUsed = extractTokensFromResponse(response);
            return { text, tokensUsed };
        }

        const fallbackText =
            extractTextFromContentPiece(response.content ?? response) ||
            JSON.stringify(response);
        const tokensUsed = extractTokensFromResponse(response);
        return { text: fallbackText, tokensUsed };
    } catch (err: any) {
        const status = err?.status || err?.code || err?.statusCode || "";
        const msg = err?.message || JSON.stringify(err);
        console.error("Gemini API error:", { model, status, message: msg });
        throw new Error(
            `Gemini API error${status ? ` (${status})` : ""}: ${msg}`
        );
    }
}

export async function postSmartSearch(req: Request, res: Response) {
    try {
        const body = req.body || {};
        const query = (body.query || "").toString().trim();
        if (!query) return res.status(400).json({ error: "query required" });

        const filters = body.filters;
        const topK = Number(body.topK || 5);
        const namespace = body.namespace || undefined;
        const cacheKey = JSON.stringify({ query, filters, topK });

        if (body.useCache !== false && smartCache[cacheKey]) {
            return res.json({ ...smartCache[cacheKey], cached: true });
        }

        const {
            embeddingsClient,
            pineconeIndex,
            namespace: defaultNs,
        } = await ensureClients();
        if (!embeddingsClient || !pineconeIndex)
            return res.status(500).json({ error: "clients not initialized" });

        const qVecs = await embeddingsClient.embedDocuments([query]);
        const qVec = qVecs?.[0];
        if (!qVec || qVec.length === 0)
            return res.status(500).json({ error: "failed to embed query" });

        // retrieve chunk hits
        const queryTopK = Math.max(topK * 4, 20);
        const queryRequest = {
            vector: qVec,
            topK: queryTopK,
            includeMetadata: true,
            filter:
                filters && Object.keys(filters).length ? filters : undefined,
        };
        const reply = await pineconeIndex
            .namespace(namespace || defaultNs)
            .query(queryRequest);
        const matches = reply.matches || [];
        const parents = aggregateMatches(matches, topK);

        const selected: {
            parentId: string;
            score: number;
            title?: string;
            chunks: {
                id: string;
                score: number;
                metadata: any;
                text: string;
            }[];
        }[] = [];

        for (const p of parents.slice(0, topK)) {
            const matched = Array.isArray(p.matchedChunks)
                ? p.matchedChunks
                : [];

            const contextChunks = matched.slice(0, 5).map((c) => ({
                id: c.id,
                score: c.score ?? 0,
                metadata: c.metadata,
                text: (c.metadata?.text ?? "") as string,
            }));

            const item: {
                parentId: string;
                score: number;
                title?: string;
                chunks: {
                    id: string;
                    score: number;
                    metadata: any;
                    text: string;
                }[];
            } = {
                parentId: p.parentId,
                score: p.score,
                chunks: contextChunks,
            };

            if (p.title !== undefined) {
                item.title = p.title;
            }

            selected.push(item);
        }

        let prompt = `You are a helpful recipe assistant. The user asked: ${query}\n\nUse the following recipe contexts to answer succinctly.\n\n`;

        for (const [idx, sel] of selected.entries()) {
            prompt += `Context ${idx + 1} - Title: ${
                sel.title ?? "Untitled"
            }\n`;
            for (const c of sel.chunks) {
                const ingredients = Array.isArray(c.metadata?.ingredients)
                    ? c.metadata.ingredients
                    : [];
                prompt += `Ingredients: ${JSON.stringify(ingredients).slice(
                    0,
                    400
                )}\n`;
                prompt += `Instructions snippet: ${(
                    c.metadata?.text ?? ""
                ).slice(0, 500)}\n\n`;
            }
        }

        prompt +=
            "\nAnswer: Provide top recipe suggestions and concise steps. Output as JSON.";

        const synthOpts = body.synthesis || {
            maxTokens: 800,
            temperature: 0.0,
        };
        const llmResp = await callGemini(prompt, synthOpts);

        const respPayload = {
            answer: llmResp.text,
            selectedRecipes: selected,
            usage: {
                tokens: llmResp.tokensUsed,
                model: "gemini-2.5-flash (placeholder)",
            },
        };

        // cache result
        smartCache[cacheKey] = respPayload;
        fs.writeJSONSync(SMART_CACHE, smartCache);

        return res.json(respPayload);
    } catch (err) {
        console.error("smartSearchController error:", err);
        return res
            .status(500)
            .json({ error: "internal_error", detail: String(err) });
    }
}
