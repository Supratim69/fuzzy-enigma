import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { parse } from "csv-parse/sync";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

dotenv.config();

/* -------------------------
   Config / Env
   ------------------------- */
const CSV_PATH = process.env.CSV_PATH || "recipes_with_images.csv";
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENV =
    process.env.PINECONE_ENV || process.env.PINECONE_ENVIRONMENT;
const PINECONE_INDEX = process.env.PINECONE_INDEX;
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || "production";
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 200);
const UPsert_BATCH = Number(process.env.UPsert_BATCH || 100);
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE_CHARS || 2000);
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP || 200);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!PINECONE_API_KEY || !PINECONE_ENV || !PINECONE_INDEX || !GEMINI_API_KEY) {
    console.error(
        "Missing env vars. Set PINECONE_API_KEY, PINECONE_ENV (or PINECONE_ENVIRONMENT), PINECONE_INDEX, GEMINI_API_KEY"
    );
    process.exit(1);
}

function sha256(text: string) {
    return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function safeTrim(s: any) {
    if (s === undefined || s === null) return "";
    return String(s).trim();
}

/* chunk text into pieces with overlap, preserving words (cut at space when possible) */
function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const out: string[] = [];
    if (!text) return out;
    let start = 0;
    const n = text.length;
    while (start < n) {
        let end = Math.min(n, start + size);
        if (end < n) {
            // try to backtrack to the last whitespace to avoid cutting words
            const lastSpace = text.lastIndexOf(" ", end);
            if (lastSpace > start) end = lastSpace;
        }
        const chunk = text.slice(start, end).trim();
        if (chunk) out.push(chunk);
        start = end - overlap;
        if (start < 0) start = 0;
        // avoid infinite loop
        if (end === n) break;
    }
    return out;
}

/* Compose prefix used for each chunk: title + ingredients + tags */
function buildPrefix(row: any) {
    const title = safeTrim(
        row.RecipeName || row.TranslatedRecipeName || row.title || row.name
    );
    const rawIngredients = safeTrim(
        row.Ingredients ||
            row.TranslatedIngredients ||
            row.ingredients ||
            row.ingredient ||
            row.ingredient_list
    );
    const ingredients = rawIngredients
        .split(/[,;|\n]/)
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);

    const cuisine = safeTrim(row.Cuisine || row.cuisine || "");
    const course = safeTrim(row.Course || row.course || "");
    const diet = safeTrim(row.Diet || row.diet || "");
    const tags = [cuisine, course, diet].filter(Boolean).join(", ");

    const prefixParts = [];
    if (title) prefixParts.push(title);
    if (ingredients.length)
        prefixParts.push(`Ingredients: ${ingredients.join(", ")}`);
    if (tags) prefixParts.push(`Tags: ${tags}`);
    // keep prefix concise
    return prefixParts.join("\n") + (prefixParts.length ? "\n\n" : "");
}

/* Build full instructions string */
function getFullInstructions(row: any) {
    return safeTrim(
        row.Instructions ||
            row.TranslatedInstructions ||
            row.instructions ||
            row.directions ||
            ""
    );
}

/* -------------------------
   Files / caches
   ------------------------- */
const CACHE_DIR = path.join(process.cwd(), "ingest-cache");
fs.ensureDirSync(CACHE_DIR);
const FULL_RECIPES_FILE = path.join(CACHE_DIR, "full_recipes.json"); // parentId -> full recipe object
const CHECKPOINT_FILE = path.join(CACHE_DIR, "checkpoint.json");

let fullRecipes: Record<string, any> = {};
if (fs.existsSync(FULL_RECIPES_FILE)) {
    try {
        fullRecipes = fs.readJSONSync(FULL_RECIPES_FILE);
    } catch (e) {
        console.warn(
            "Failed to load existing full_recipes.json, starting fresh."
        );
        fullRecipes = {};
    }
}

let checkpoint: { lastProcessedRow: number } = { lastProcessedRow: -1 };
if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
        checkpoint = fs.readJSONSync(CHECKPOINT_FILE);
    } catch {
        checkpoint = { lastProcessedRow: -1 };
    }
}

/* -------------------------
   Read CSV
   ------------------------- */
if (!fs.existsSync(CSV_PATH)) {
    console.error("CSV not found at", CSV_PATH);
    process.exit(1);
}
const csvText = fs.readFileSync(CSV_PATH, "utf8");
const rows: any[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
});
console.info(
    `Loaded ${rows.length} rows from ${CSV_PATH}; checkpoint.lastProcessedRow=${checkpoint.lastProcessedRow}`
);

console.info("Initializing Gemini embeddings client...");
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
    apiKey: GEMINI_API_KEY,
});

console.info("Initializing Pinecone client...");
const pinecone = new PineconeClient();
const pineconeIndex = pinecone.Index(PINECONE_INDEX);
console.info("Connected to Pinecone index:", PINECONE_INDEX);

async function sampleEmbeddingCheck() {
    for (const r of rows) {
        const prefix = buildPrefix(r);
        const fullInstructions = getFullInstructions(r);
        const doc = (prefix + "\n" + fullInstructions).trim();
        if (doc.length > 0) {
            try {
                const sample = await embeddings.embedDocuments([doc]);
                console.info("Sample embedding length:", sample[0]?.length);
            } catch (err) {
                console.warn("Sample embedding check failed:", err);
            }
            break;
        }
    }
}
await sampleEmbeddingCheck();

/* -------------------------
   Ingest: build chunks, embed, upsert
   ------------------------- */
interface UpsertItem {
    id: string;
    values: number[];
    metadata: Record<string, any>;
}

async function runIngest() {
    console.info("Starting ingest loop...");
    const embedBatchTexts: string[] = [];
    const embedBatchMeta: {
        id: string;
        metadata: Record<string, any>;
        parentId: string;
    }[] = [];
    const upsertBuffer: UpsertItem[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
        if (idx <= checkpoint.lastProcessedRow) {
            // skip already-processed rows
            continue;
        }

        const row = rows[idx];
        // create a stable parentId
        const title = safeTrim(
            row.RecipeName || row.TranslatedRecipeName || row.title || row.name
        );
        const rawIngredients = safeTrim(
            row.Ingredients ||
                row.TranslatedIngredients ||
                row.ingredients ||
                row.ingredient ||
                row.ingredient_list
        );
        const parentId = (
            row.Srno ||
            row.id ||
            row.recipeId ||
            "rid-" + sha256(title + "|" + rawIngredients)
        ).toString();

        // save full recipe text/object for later retrieval
        const fullInstructions = getFullInstructions(row);
        const cuisine = safeTrim(row.Cuisine || row.cuisine || "");
        const course = safeTrim(row.Course || row.course || "");
        const diet = safeTrim(row.Diet || row.diet || "");
        const combinedTags = [cuisine, course, diet].filter(Boolean).join(", ");
        const recipeUrl = safeTrim(row.URL || row.url || "");
        const imageURL = safeTrim(row.ImageURL || row.imageUrl || "");

        const fullRecipeObj = {
            parentId,
            title,
            ingredients: rawIngredients,
            instructions: fullInstructions,
            tags: combinedTags,
            cuisine,
            course,
            diet,
            imageURL,
            recipeUrl,
            metadata: {
                prepTime: row.PrepTimeInMins
                    ? Number(row.PrepTimeInMins)
                    : undefined,
                cookTime: row.CookTimeInMins
                    ? Number(row.CookTimeInMins)
                    : undefined,
                servings: row.Servings ? Number(row.Servings) : undefined,
            },
        };
        // store/overwrite in local cache
        fullRecipes[parentId] = fullRecipeObj;

        // build prefix and chunk the full instructions (no truncation)
        const prefix = buildPrefix(row);
        const chunks = chunkText(
            fullInstructions || "",
            CHUNK_SIZE,
            CHUNK_OVERLAP
        );
        // if no instruction, still create one empty chunk so the recipe is represented
        const finalChunks = chunks.length ? chunks : [""];

        for (let ci = 0; ci < finalChunks.length; ci++) {
            const chunkText = finalChunks[ci];
            // compose page content: include prefix so chunk is self-contained
            const pageContent = (prefix + "\n" + chunkText).trim();
            const chunkId = `${parentId}#c${ci}`;

            const metadata: Record<string, any> = {
                parentId,
                chunkIndex: ci,
                totalChunks: finalChunks.length,
                title,
                tags: combinedTags,
                // keep ingredients as array for metadata filtering
                ingredients: rawIngredients
                    ? rawIngredients
                          .split(/[,;|\n]/)
                          .map((s: string) => s.trim().toLowerCase())
                          .filter(Boolean)
                    : [],
                source: "csv",
                prepTime: fullRecipeObj.metadata.prepTime,
                cookTime: fullRecipeObj.metadata.cookTime,
                servings: fullRecipeObj.metadata.servings,
                cuisine: cuisine,
                course: course,
                diet: diet,
                imageURL: imageURL,
            };

            embedBatchTexts.push(pageContent);
            embedBatchMeta.push({ id: chunkId, metadata, parentId });

            if (embedBatchTexts.length >= BATCH_SIZE) {
                await flushEmbedBatchAndUpsert(
                    embedBatchTexts,
                    embedBatchMeta,
                    upsertBuffer
                );
                embedBatchTexts.length = 0;
                embedBatchMeta.length = 0;
            }
        }

        if (idx % 50 === 0) {
            checkpoint.lastProcessedRow = idx;
            fs.writeJSONSync(CHECKPOINT_FILE, checkpoint);
            fs.writeJSONSync(FULL_RECIPES_FILE, fullRecipes);
            console.info(`Checkpoint saved at row ${idx}`);
        }
    }

    if (embedBatchTexts.length > 0) {
        await flushEmbedBatchAndUpsert(
            embedBatchTexts,
            embedBatchMeta,
            upsertBuffer
        );
    }
    if (upsertBuffer.length > 0) {
        await flushUpsertBuffer(upsertBuffer);
    }

    checkpoint.lastProcessedRow = rows.length - 1;
    fs.writeJSONSync(CHECKPOINT_FILE, checkpoint);
    fs.writeJSONSync(FULL_RECIPES_FILE, fullRecipes);
    console.info("Ingest finished. Final checkpoint saved.");
}

async function flushEmbedBatchAndUpsert(
    texts: string[],
    meta: { id: string; metadata: Record<string, any>; parentId: string }[],
    upsertBuffer: UpsertItem[]
) {
    console.info(`Embedding batch size=${texts.length}...`);
    // Defensive: ensure inputs align
    if (texts.length !== meta.length) {
        throw new Error("Internal mismatch between texts and meta arrays");
    }

    // Remove leading empty texts and mark them as skipped
    const nonEmptyTexts: string[] = [];
    const nonEmptyMeta: typeof meta = [];
    for (let i = 0; i < texts.length; i++) {
        const t = texts[i] || "";
        if (!t.trim()) {
            console.warn(
                `Skipping empty chunk for id=${meta[i]?.id || "unknown"}`
            );
            continue;
        }
        if (!meta[i]) {
            console.warn(`Skipping index ${i} due to missing metadata`);
            continue;
        }
        nonEmptyTexts.push(t);
        nonEmptyMeta.push(meta[i]!);
    }

    if (nonEmptyTexts.length === 0) {
        console.warn("All chunks empty in this embed batch; skipping.");
        return;
    }

    let vectors: number[][];
    try {
        vectors = await embeddings.embedDocuments(nonEmptyTexts);
    } catch (err) {
        console.error("Embedding API error, skipping this batch:", err);
        return;
    }

    // Validate vectors
    if (!Array.isArray(vectors) || vectors.length !== nonEmptyTexts.length) {
        console.error(
            "Embedding response shape unexpected. expected",
            nonEmptyTexts.length,
            "got",
            vectors?.length
        );
        return;
    }
    const lens = vectors.map((v) => (Array.isArray(v) ? v.length : 0));
    console.info("Embedding lengths sample:", lens.slice(0, 5));
    // optional: user-provided expected dim check
    const expectedDim = Number(process.env.EXPECTED_DIM || 0) || undefined;
    if (expectedDim && lens[0] !== expectedDim) {
        console.warn(
            `Embedding dimension ${lens[0]} != EXPECTED_DIM ${expectedDim}. Consider recreating index or setting EXPECTED_DIM.`
        );
    }

    // push to upsert buffer with metadata
    for (let i = 0; i < nonEmptyMeta.length; i++) {
        const metaItem = nonEmptyMeta[i];
        if (!metaItem) {
            console.warn(`Skipping index ${i} due to missing metadata`);
            continue;
        }
        const id = metaItem.id;
        const vector = vectors[i];
        if (!Array.isArray(vector) || vector.length === 0) {
            console.warn(`Skipping id=${id} due to empty vector`);
            continue;
        }
        upsertBuffer.push({
            id,
            values: vector,
            metadata: metaItem.metadata,
        });

        // flush upsertBuffer if large
        if (upsertBuffer.length >= UPsert_BATCH) {
            await flushUpsertBuffer(upsertBuffer);
        }
    }
}

/* -------------------------
   Flush upsert buffer to Pinecone (chunked)
   ------------------------- */
async function flushUpsertBuffer(buffer: UpsertItem[]) {
    if (!buffer.length) return;
    console.info(
        `Upserting ${buffer.length} vectors to Pinecone (namespace=${PINECONE_NAMESPACE}) ...`
    );
    // Pinecone upsert expects { vectors: [ { id, values, metadata } ] , namespace }
    const chunkSize = UPsert_BATCH;
    for (let i = 0; i < buffer.length; i += chunkSize) {
        const slice = buffer.slice(i, i + chunkSize);
        const vectors = slice.map((it) => ({
            id: it.id,
            values: it.values,
            metadata: it.metadata,
        }));
        try {
            await pineconeIndex.namespace(PINECONE_NAMESPACE).upsert(vectors);
            console.info(`  ✅ Upserted chunk ${i}..${i + slice.length - 1}`);
        } catch (err) {
            console.error("Upsert failed for chunk", i, "error:", err);
            // on failure, write failed chunk to disk for reprocessing
            const failedFile = path.join(
                CACHE_DIR,
                `failed_upsert_${Date.now()}.json`
            );
            fs.writeJSONSync(failedFile, { error: String(err), vectors });
            console.warn("Wrote failed upsert chunk to", failedFile);
        }
    }
    // clear buffer
    buffer.length = 0;
}

/* -------------------------
   Run
   ------------------------- */
runIngest()
    .then(() => {
        console.info("All done.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("Ingest failed:", err);
        // persist caches on error
        try {
            fs.writeJSONSync(CHECKPOINT_FILE, checkpoint);
            fs.writeJSONSync(FULL_RECIPES_FILE, fullRecipes);
        } catch (e) {
            console.error("Failed to persist caches on error", e);
        }
        process.exit(1);
    });
