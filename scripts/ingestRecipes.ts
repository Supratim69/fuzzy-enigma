import fs from "fs-extra";
import crypto from "crypto";
import dotenv from "dotenv";
import { parse } from "csv-parse/sync";
import { Document } from "langchain/document";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";

dotenv.config();

const CSV_PATH = "recipes.csv";
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENV =
    process.env.PINECONE_ENV || process.env.PINECONE_ENVIRONMENT;
const PINECONE_INDEX = process.env.PINECONE_INDEX;
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || "production";
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 200);
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY;

if (!PINECONE_API_KEY || !PINECONE_ENV || !PINECONE_INDEX || !GOOGLE_API_KEY) {
    console.error(
        "Missing required env variables: set PINECONE_API_KEY, PINECONE_ENV (or PINECONE_ENVIRONMENT), PINECONE_INDEX, and GOOGLE_API_KEY."
    );
    process.exit(1);
}

function sha256(text: string) {
    return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function composeDocText(row: any) {
    const title = (
        row.RecipeName ||
        row.TranslatedRecipeName ||
        row.title ||
        row.name ||
        ""
    )
        .toString()
        .trim();

    const rawIngredients = (
        row.Ingredients ||
        row.TranslatedIngredients ||
        row.ingredients ||
        row.ingredient ||
        row.ingredient_list ||
        ""
    ).toString();

    const ingredients = rawIngredients
        .split(/[,;|\n]/)
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);

    const instructionsRaw = (
        row.Instructions ||
        row.TranslatedInstructions ||
        row.instructions ||
        row.directions ||
        ""
    )
        .toString()
        .trim();

    const instructions =
        instructionsRaw.length > 400
            ? instructionsRaw.slice(0, 400) + "..."
            : instructionsRaw;

    const tags = (
        row.Cuisine ||
        row.Course ||
        row.Diet ||
        row.tags ||
        row.cuisine ||
        ""
    )
        .toString()
        .trim();

    const doc = `${title}\nIngredients: ${ingredients.join(
        ", "
    )}\nInstructions: ${instructions}\nTags: ${tags}`;

    return {
        title,
        ingredients,
        instructions,
        tags,
        doc,
    };
}

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
console.info(`Loaded ${rows.length} rows from ${CSV_PATH}`);
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
    apiKey: GOOGLE_API_KEY,
});

const pinecone = new PineconeClient();

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    maxConcurrency: 5,
    namespace: PINECONE_NAMESPACE,
});

function buildDocumentsAndIds(rows: any[]) {
    const docs: Document[] = [];
    const ids: string[] = [];

    for (const row of rows) {
        const { title, ingredients, instructions, tags, doc } =
            composeDocText(row);
        const id = (
            row.Srno ||
            row.id ||
            row.recipeId ||
            "rid-" + sha256(title + "|" + ingredients.join(","))
        ).toString();

        const metadata: Record<string, any> = {
            title,
            ingredients,
            tags,
            source: "csv",
        };
        if (row.Cuisine) metadata.cuisine = row.Cuisine;
        if (row.Course) metadata.course = row.Course;
        if (row.Diet) metadata.diet = row.Diet;
        if (row.PrepTimeInMins)
            metadata.prepTime = Number(row.PrepTimeInMins) || undefined;
        if (row.CookTimeInMins)
            metadata.cookTime = Number(row.CookTimeInMins) || undefined;
        if (row.TotalTimeInMins)
            metadata.totalTime = Number(row.TotalTimeInMins) || undefined;
        if (row.Servings) metadata.servings = Number(row.Servings) || undefined;

        const document = new Document({
            pageContent: doc,
            metadata,
        });

        docs.push(document);
        ids.push(id);
    }

    return { docs, ids };
}

async function runIngest() {
    const { docs, ids } = buildDocumentsAndIds(rows);
    console.info("Built", docs.length, "documents; uploading in batches...");

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batchDocs = docs.slice(i, i + BATCH_SIZE);
        const batchIds = ids.slice(i, i + BATCH_SIZE);
        console.info(
            `Upserting batch ${i}..${i + batchDocs.length - 1} (size=${
                batchDocs.length
            })`
        );
        try {
            // sanity check: print a sample document before upsert
            if (i === 0 && batchDocs[0]) {
                console.log(
                    "🧩 Sample doc text:",
                    batchDocs[0].pageContent.slice(0, 200)
                );
            }

            // log embedding vector length for first batch only
            if (batchDocs[0]) {
                console.log("🔢 Computing test embedding...", embeddings);
                const testEmbedding = await embeddings.embedDocuments([
                    batchDocs[0].pageContent,
                ]);
                console.log(
                    "📏 Test embedding length (first doc):",
                    testEmbedding[0]?.length
                );
            }

            await vectorStore.addDocuments(batchDocs, { ids: batchIds });
            console.info(
                `✅ Batch ${i}-${
                    i + batchDocs.length - 1
                } upserted successfully`
            );
        } catch (err) {
            console.error(
                `❌ Failed batch ${i}-${i + batchDocs.length - 1}:`,
                err
            );
            // continue safely
        }
    }

    console.info(
        "Ingest complete. Documents upserted to Pinecone index:",
        PINECONE_INDEX
    );
}

runIngest()
    .then(() => {
        console.info("All done.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("Ingest failed:", err);
        process.exit(1);
    });
