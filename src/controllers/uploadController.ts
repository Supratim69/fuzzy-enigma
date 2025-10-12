import { type Request, type Response } from "express";
import AWS from "aws-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
    region: process.env.S3_REGION!,
});

const bucketName = process.env.S3_BUCKET!;

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient() {
    if (geminiClient) return geminiClient;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is required for Gemini API access");
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
    return geminiClient;
}

const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadImage(req: Request, res: Response) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const file = req.file;

        // Validate file type
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            return res.status(400).json({
                error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed",
            });
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return res.status(400).json({
                error: "File too large. Maximum size is 10MB",
            });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const extension = path.extname(file.originalname);
        const filename = `ingredients-${timestamp}${extension}`;

        // Upload to S3
        const uploadParams = {
            Bucket: bucketName,
            Key: filename,
            Body: file.buffer,
            ContentType: file.mimetype,
        };

        await s3.upload(uploadParams).promise();
        console.log(`File uploaded to S3: ${filename}`);

        // Get Gemini client and analyze image
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
        });

        const prompt = `You are a food vision expert. Identify all distinct edible ingredients visible in this image.
Respond as a JSON array of ingredient names in lowercase.
Example:
["tomato", "onion", "basil", "garlic"]`;

        const imagePart = {
            inlineData: {
                data: file.buffer.toString("base64"),
                mimeType: file.mimetype,
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = result.response;
        const text = response.text();

        // Parse the JSON response
        let ingredients: string[];
        try {
            ingredients = JSON.parse(text);
        } catch (parseError) {
            console.error("Failed to parse Gemini response as JSON:", text);
            // Try to extract JSON from the response if it's wrapped in markdown
            const jsonMatch = text.match(/\[.*\]/s);
            if (jsonMatch) {
                ingredients = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Invalid JSON response from Gemini");
            }
        }

        // Validate that the response is an array of strings
        if (
            !Array.isArray(ingredients) ||
            !ingredients.every((item) => typeof item === "string")
        ) {
            throw new Error("Invalid response format from Gemini");
        }

        return res.json({
            ingredients,
            filename,
            uploadedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Upload controller error:", error);
        return res.status(500).json({
            error: "internal_error",
            detail: String(error),
        });
    }
}
