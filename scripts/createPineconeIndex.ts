import dotenv from "dotenv";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

dotenv.config();

const PINECONE_INDEX = process.env.PINECONE_INDEX;
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || "production";

if (!PINECONE_INDEX) {
    console.error("Missing PINECONE_INDEX environment variable");
    process.exit(1);
}

async function createPineconeIndex() {
    const pinecone = new PineconeClient();

    try {
        // Check if index already exists
        const indexList = await pinecone.listIndexes();
        const existingIndex = indexList.indexes?.find(
            (index) => index.name === PINECONE_INDEX
        );

        if (existingIndex) {
            console.log("Index details:", existingIndex);
            return;
        }

        // Create the index
        await pinecone.createIndex({
            name: PINECONE_INDEX,
            dimension: 768, // Gemini text-embedding-004 dimension
            metric: "cosine",
            spec: {
                serverless: {
                    cloud: "aws",
                    region: "us-east-1",
                },
            },
        });


        // Wait a moment for the index to be ready
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 30;

        while (!isReady && attempts < maxAttempts) {
            try {
                const indexDescription = await pinecone.describeIndex(
                    PINECONE_INDEX
                );
                if (indexDescription.status?.ready) {
                    isReady = true;
                } else {
                    console.log(
                        `Index status: ${indexDescription.status?.state}, waiting...`
                    );
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    attempts++;
                }
            } catch (error) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                attempts++;
            }
        }

        if (!isReady) {
            console.warn(
                "⚠️ Index creation may still be in progress. You can check status manually."
            );
        }
    } catch (error) {
        console.error("❌ Failed to create Pinecone index:", error);
        process.exit(1);
    }
}

createPineconeIndex()
    .then(() => {
        console.log("Pinecone index setup completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
    });
