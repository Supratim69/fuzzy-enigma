import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX;
const DEFAULT_NAMESPACE = process.env.PINECONE_NAMESPACE || "production";

let embeddingsClient: GoogleGenerativeAIEmbeddings | null = null;
let pineconeClient: PineconeClient | null = null;
let pineconeIndex: any = null;

export async function ensureClients() {
    if (!embeddingsClient) {
        embeddingsClient = new GoogleGenerativeAIEmbeddings({
            model: "text-embedding-004",
            apiKey: GEMINI_API_KEY!,
        });
    }
    if (!pineconeClient) {
        pineconeClient = new PineconeClient();
        pineconeIndex = pineconeClient.Index(PINECONE_INDEX!);
    }
    return { embeddingsClient, pineconeIndex, namespace: DEFAULT_NAMESPACE };
}
