import { Router } from "express";
import { auth } from "../config/auth.js";
import { requireAuth } from "../middleware/auth.js";
import {
    getProfile,
    updateProfile,
    getSessions,
    revokeSession,
    revokeOtherSessions,
} from "../controllers/authController.js";

const router = Router();

// BetterAuth handler function
const handleBetterAuth = async (req: any, res: any, next: any) => {
    try {
        // Build the full URL for the request
        const protocol = req.protocol || "http";
        const host = req.get("host") || "localhost:4000";
        const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

        // Log the URL construction for debugging
        console.log(`[BetterAuth] URL Construction:`, {
            protocol,
            host,
            originalUrl: req.originalUrl,
            url: req.url,
            fullUrl,
        });

        console.log(`[BetterAuth] Processing: ${req.method} ${fullUrl}`);
        console.log(`[BetterAuth] Original URL: ${req.originalUrl}`);
        console.log(`[BetterAuth] URL: ${req.url}`);

        // Prepare headers, ensuring content-type is set for POST requests
        const headers: Record<string, string> = {};
        Object.keys(req.headers).forEach((key) => {
            const value = req.headers[key];
            if (typeof value === "string") {
                headers[key] = value;
            } else if (Array.isArray(value)) {
                headers[key] = value[0];
            }
        });

        // Ensure content-type is set for requests with body
        if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
            if (!headers["content-type"]) {
                headers["content-type"] = "application/json";
            }
        }

        const requestInit: RequestInit = {
            method: req.method,
            headers,
        };

        // Add body for methods that support it
        if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
            if (typeof req.body === "string") {
                requestInit.body = req.body;
            } else {
                requestInit.body = JSON.stringify(req.body);
            }
        }

        console.log(`[BetterAuth] ${req.method} ${fullUrl}`, {
            headers: Object.keys(headers),
            hasBody: !!requestInit.body,
            bodyLength:
                requestInit.body && typeof requestInit.body === "string"
                    ? requestInit.body.length
                    : "unknown",
        });

        const webRequest = new Request(fullUrl, requestInit);
        const response = await auth.handler(webRequest);

        if (response) {
            console.log(`[BetterAuth] Response: ${response.status}`);

            res.status(response.status);

            // Set headers
            response.headers.forEach((value, key) => {
                res.setHeader(key, value);
            });

            // Send response body
            const body = await response.text();
            console.log(`[BetterAuth] Response body length: ${body.length}`);

            if (body) {
                // Try to parse as JSON, fallback to text
                try {
                    const jsonBody = JSON.parse(body);
                    res.json(jsonBody);
                } catch {
                    res.send(body);
                }
            } else {
                res.end();
            }
        } else {
            console.log("[BetterAuth] No response from handler");
            res.status(404).json({ error: "Not found" });
        }
    } catch (error) {
        console.error("[BetterAuth] Handler error:", error);
        next(error);
    }
};

// Handle specific BetterAuth routes
router.post("/auth/sign-up/email", handleBetterAuth);
router.post("/auth/sign-in/email", handleBetterAuth);
router.post("/auth/sign-out", handleBetterAuth);
router.get("/auth/session", handleBetterAuth);
router.post("/auth/change-password", handleBetterAuth);
router.post("/auth/request-password-reset", handleBetterAuth);
router.post("/auth/reset-password", handleBetterAuth);
router.post("/auth/send-verification-email", handleBetterAuth);

// Additional auth endpoints for profile management
router.get("/auth/profile", requireAuth, getProfile);
router.put("/auth/profile", requireAuth, updateProfile);
router.get("/auth/sessions", requireAuth, getSessions);
router.delete("/auth/sessions/:sessionId", requireAuth, revokeSession);
router.delete("/auth/sessions", requireAuth, revokeOtherSessions);

export default router;
