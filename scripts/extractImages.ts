import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import fetch from "node-fetch";

dotenv.config();

/* -------------------------
   Config / Env
   ------------------------- */
const CSV_PATH = process.env.CSV_PATH || "recipes.csv";
const OUTPUT_CSV_PATH =
    process.env.OUTPUT_CSV_PATH || "recipes_with_images.csv";
const IMAGE_EXTRACTION_BATCH = Number(process.env.IMAGE_EXTRACTION_BATCH || 10);
const IMAGE_EXTRACTION_DELAY = Number(
    process.env.IMAGE_EXTRACTION_DELAY || 1000
);

/* -------------------------
   Cache setup
   ------------------------- */
const CACHE_DIR = path.join(process.cwd(), "image-extraction-cache");
fs.ensureDirSync(CACHE_DIR);
const IMAGE_CACHE_FILE = path.join(CACHE_DIR, "image_urls.json");
const PROGRESS_FILE = path.join(CACHE_DIR, "progress.json");

// Load existing caches
let imageUrlCache: Record<string, string> = {};
if (fs.existsSync(IMAGE_CACHE_FILE)) {
    try {
        imageUrlCache = fs.readJSONSync(IMAGE_CACHE_FILE);
        console.info(
            `Loaded ${Object.keys(imageUrlCache).length} cached image URLs`
        );
    } catch (e) {
        console.warn("Failed to load image URL cache, starting fresh.");
    }
}

let progress: { lastProcessedRow: number } = { lastProcessedRow: -1 };
if (fs.existsSync(PROGRESS_FILE)) {
    try {
        progress = fs.readJSONSync(PROGRESS_FILE);
        console.info(`Resuming from row ${progress.lastProcessedRow + 1}`);
    } catch {
        progress = { lastProcessedRow: -1 };
    }
}

function safeTrim(s: any) {
    if (s === undefined || s === null) return "";
    return String(s).trim();
}

// Rate limiting for image extraction
let lastImageRequestTime = 0;

async function extractImageFromRecipeURL(recipeUrl: string): Promise<string> {
    if (!recipeUrl || !recipeUrl.startsWith("http")) {
        return generateFallbackImageURL();
    }

    // Check cache first
    if (imageUrlCache[recipeUrl]) {
        return imageUrlCache[recipeUrl];
    }

    // Rate limiting - wait between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastImageRequestTime;
    if (timeSinceLastRequest < IMAGE_EXTRACTION_DELAY) {
        await new Promise((resolve) =>
            setTimeout(resolve, IMAGE_EXTRACTION_DELAY - timeSinceLastRequest)
        );
    }
    lastImageRequestTime = Date.now();

    try {
        console.info(`Extracting image from: ${recipeUrl}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(recipeUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        // Try multiple selectors to find recipe images
        const imagePatterns = [
            // Open Graph image
            /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
            // Twitter card image
            /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
            // Schema.org recipe image
            /<meta\s+itemprop=["']image["']\s+content=["']([^"']+)["']/i,
            // Common recipe image selectors
            /<img[^>]+class=["'][^"']*recipe[^"']*image[^"']*["'][^>]+src=["']([^"']+)["']/i,
            /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*recipe[^"']*image[^"']*["']/i,
            // Archana's Kitchen specific patterns
            /<img[^>]+class=["'][^"']*featured[^"']*image[^"']*["'][^>]+src=["']([^"']+)["']/i,
            /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*featured[^"']*image[^"']*["']/i,
            // Generic high-quality image patterns (look for larger images)
            /<img[^>]+src=["']([^"']+(?:recipe|food|dish)[^"']*\.(?:jpg|jpeg|png|webp))["']/i,
        ];

        let imageUrl = "";
        for (const pattern of imagePatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                imageUrl = match[1];
                break;
            }
        }

        // If no specific pattern matched, try to find any reasonable image
        if (!imageUrl) {
            const genericImagePattern =
                /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/gi;
            const matches = Array.from(html.matchAll(genericImagePattern));

            // Filter for likely recipe images (avoid icons, logos, etc.)
            const candidateImages = matches
                .map((match) => match[1])
                .filter((url): url is string => {
                    if (!url) return false;
                    const lowerUrl = url.toLowerCase();
                    return (
                        !lowerUrl.includes("logo") &&
                        !lowerUrl.includes("icon") &&
                        !lowerUrl.includes("avatar") &&
                        !lowerUrl.includes("social") &&
                        (lowerUrl.includes("recipe") ||
                            lowerUrl.includes("food") ||
                            lowerUrl.includes("dish") ||
                            url.length > 50)
                    ); // Prefer longer URLs (usually higher quality)
                });

            if (candidateImages.length > 0 && candidateImages[0]) {
                imageUrl = candidateImages[0];
            }
        }

        // Convert relative URLs to absolute
        if (imageUrl && !imageUrl.startsWith("http")) {
            try {
                const baseUrl = new URL(recipeUrl);
                imageUrl = new URL(imageUrl, baseUrl.origin).toString();
            } catch (urlError) {
                console.warn(`Failed to convert relative URL: ${imageUrl}`);
                imageUrl = "";
            }
        }

        // Validate the image URL
        if (imageUrl && imageUrl.startsWith("http")) {
            // Cache the result
            imageUrlCache[recipeUrl] = imageUrl;
            return imageUrl;
        }
    } catch (error) {
        console.warn(
            `Failed to extract image from ${recipeUrl}:`,
            error instanceof Error ? error.message : String(error)
        );
    }

    // Fallback to generated image
    const fallbackUrl = generateFallbackImageURL();
    imageUrlCache[recipeUrl] = fallbackUrl;
    return fallbackUrl;
}

function generateFallbackImageURL(): string {
    // Generate a random food-related Unsplash image
    const foodKeywords = [
        "food",
        "recipe",
        "cooking",
        "dish",
        "meal",
        "cuisine",
    ];
    const randomKeyword =
        foodKeywords[Math.floor(Math.random() * foodKeywords.length)];
    return `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&auto=format&q=80&${randomKeyword}`;
}

// Batch process image extractions with rate limiting
async function extractImagesInBatch(urls: string[]): Promise<string[]> {
    const results: string[] = [];

    console.info(
        `Extracting images for ${urls.length} URLs in batches of ${IMAGE_EXTRACTION_BATCH}...`
    );

    for (let i = 0; i < urls.length; i += IMAGE_EXTRACTION_BATCH) {
        const batch = urls.slice(i, i + IMAGE_EXTRACTION_BATCH);
        console.info(
            `Processing image batch ${
                Math.floor(i / IMAGE_EXTRACTION_BATCH) + 1
            }/${Math.ceil(urls.length / IMAGE_EXTRACTION_BATCH)}`
        );

        const batchPromises = batch.map((url) =>
            extractImageFromRecipeURL(url)
        );
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Save cache after each batch
        fs.writeJSONSync(IMAGE_CACHE_FILE, imageUrlCache);

        // Progress update
        console.info(
            `Completed ${Math.min(i + IMAGE_EXTRACTION_BATCH, urls.length)}/${
                urls.length
            } image extractions`
        );
    }

    return results;
}

async function processCSV() {
    // Read CSV
    if (!fs.existsSync(CSV_PATH)) {
        console.error("CSV not found at", CSV_PATH);
        process.exit(1);
    }

    console.info(`Reading CSV from: ${CSV_PATH}`);
    const csvText = fs.readFileSync(CSV_PATH, "utf8");
    const rows: any[] = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
    });

    console.info(`Loaded ${rows.length} rows from CSV`);

    // Check if ImageURL column already exists
    const hasImageColumn =
        rows.length > 0 && ("ImageURL" in rows[0] || "imageUrl" in rows[0]);

    if (hasImageColumn) {
        console.info("ImageURL column already exists in CSV");
        // Count how many already have images
        const existingImages = rows.filter((row) =>
            safeTrim(row.ImageURL || row.imageUrl || "")
        ).length;
        console.info(
            `${existingImages}/${rows.length} recipes already have image URLs`
        );

        if (existingImages === rows.length) {
            console.info("All recipes already have image URLs. Nothing to do.");
            return;
        }
    }

    // Process rows that need image extraction
    const startIdx = progress.lastProcessedRow + 1;
    console.info(`Starting image extraction from row ${startIdx + 1}...`);

    for (
        let chunkStart = startIdx;
        chunkStart < rows.length;
        chunkStart += IMAGE_EXTRACTION_BATCH * 5
    ) {
        const chunkEnd = Math.min(
            chunkStart + IMAGE_EXTRACTION_BATCH * 5,
            rows.length
        );
        const chunk = rows.slice(chunkStart, chunkEnd);

        console.info(
            `\n=== Processing chunk ${
                Math.floor(chunkStart / (IMAGE_EXTRACTION_BATCH * 5)) + 1
            }/${Math.ceil(
                (rows.length - startIdx) / (IMAGE_EXTRACTION_BATCH * 5)
            )} ===`
        );
        console.info(`Rows ${chunkStart + 1}-${chunkEnd} of ${rows.length}`);

        // Extract URLs from this chunk
        const urls = chunk.map((row) => safeTrim(row.URL || row.url || ""));

        // Extract images in batches
        const imageUrls = await extractImagesInBatch(urls);

        // Update rows with extracted image URLs
        for (let i = 0; i < chunk.length; i++) {
            const rowIndex = chunkStart + i;
            rows[rowIndex].ImageURL = imageUrls[i];
        }

        // Update progress
        progress.lastProcessedRow = chunkEnd - 1;
        fs.writeJSONSync(PROGRESS_FILE, progress);

        console.info(
            `✅ Completed chunk. Progress saved at row ${
                progress.lastProcessedRow + 1
            }`
        );

        // Save intermediate CSV every few chunks
        if (
            (chunkEnd - startIdx) % (IMAGE_EXTRACTION_BATCH * 20) === 0 ||
            chunkEnd === rows.length
        ) {
            console.info("💾 Saving intermediate CSV...");
            await saveCSV(rows);
        }
    }

    // Final save
    console.info("💾 Saving final CSV...");
    await saveCSV(rows);

    console.info("\n🎉 IMAGE EXTRACTION COMPLETED! 🎉");
    console.info(`✅ Processed ${rows.length} recipes`);
    console.info(
        `✅ Extracted ${Object.keys(imageUrlCache).length} unique images`
    );
    console.info(`✅ Output saved to: ${OUTPUT_CSV_PATH}`);
}

async function saveCSV(rows: any[]) {
    // Get all unique column names
    const allColumns = new Set<string>();
    rows.forEach((row) => {
        Object.keys(row).forEach((key) => allColumns.add(key));
    });

    // Ensure ImageURL is included
    allColumns.add("ImageURL");

    const columns = Array.from(allColumns);

    // Convert to CSV
    const csvOutput = stringify(rows, {
        header: true,
        columns: columns,
    });

    // Write to output file
    fs.writeFileSync(OUTPUT_CSV_PATH, csvOutput, "utf8");
    console.info(
        `CSV saved with ${rows.length} rows and ${columns.length} columns`
    );
}

// Run the process
processCSV()
    .then(() => {
        // Final cleanup
        fs.writeJSONSync(IMAGE_CACHE_FILE, imageUrlCache);
        progress.lastProcessedRow = -1; // Reset for next run
        fs.writeJSONSync(PROGRESS_FILE, progress);
        process.exit(0);
    })
    .catch((err) => {
        console.error("Image extraction failed:", err);
        // Save progress on error
        try {
            fs.writeJSONSync(IMAGE_CACHE_FILE, imageUrlCache);
            fs.writeJSONSync(PROGRESS_FILE, progress);
        } catch (e) {
            console.error("Failed to save progress on error", e);
        }
        process.exit(1);
    });
