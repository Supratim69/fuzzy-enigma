import fs from "fs-extra";
import dotenv from "dotenv";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_ENV =
    process.env.PINECONE_ENV || process.env.PINECONE_ENVIRONMENT!;
const PINECONE_INDEX = process.env.PINECONE_INDEX!;
const NAMESPACE = process.env.PINECONE_NAMESPACE || "production_v1";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY required");

const args = process.argv.slice(2);
const queryText = args[0] || "tomato onion pasta";
const TOPK = Number(args[1] || 6);

async function run() {
    const embeddings = new GoogleGenerativeAIEmbeddings({
        model: "text-embedding-004",
        apiKey: GEMINI_API_KEY!,
    });

    console.log("Embedding query:", queryText);
    const qVecs = await embeddings.embedDocuments([queryText]);
    const qVec = qVecs[0];
    if (!qVec || qVec.length === 0) {
        throw new Error(
            "Empty query embedding; check GEMINI_API_KEY and model"
        );
    }
    console.log("Query vector length:", qVec.length);

    // 3) Pinecone client
    const pinecone = new PineconeClient();
    const index = pinecone.Index(PINECONE_INDEX);

    // 4) Query Pinecone
    const queryRequest = {
        vector: qVec,
        topK: TOPK,
        includeMetadata: true,
    };

    const resp = await index.namespace(NAMESPACE).query(queryRequest);
    const matches = resp.matches || [];
    console.log(`Got ${matches.length} matches`);

    // 5) Group by parentId (if you used chunking)
    const grouped: Record<string, any[]> = {};
    for (const m of matches) {
        const meta = m.metadata || {};
        const parentId = String(
            meta.parentId || meta.parent_id || meta.parent || "unknown"
        );
        if (!grouped[parentId]) grouped[parentId] = [];
        grouped[parentId].push({ id: m.id, score: m.score, metadata: meta });
    }

    console.log("Top groups (parentId -> hits):");
    for (const [parentId, hits] of Object.entries(grouped)) {
        console.log("---", parentId, "hits:", hits.length);
        // print top hit metadata
        console.log(JSON.stringify(hits.slice(0, 3), null, 2));
    }

    // 6) (Optional) fetch full recipe from local cache
    const cachePath = "ingest-cache/full_recipes.json";
    if (fs.existsSync(cachePath)) {
        const full = fs.readJSONSync(cachePath);
        const topParent = Object.keys(grouped)[0];
        if (topParent && full[topParent]) {
            console.log("Full recipe (from cache) for top result:", topParent);
            console.log(
                JSON.stringify(full[topParent], null, 2).slice(0, 1000)
            ); // print prefix
        }
    } else {
        console.log("No local full_recipes.json found to fetch full recipe.");
    }

    process.exit(0);
}

run().catch((e) => {
    console.error("Query test failed:", e);
    process.exit(1);
});
