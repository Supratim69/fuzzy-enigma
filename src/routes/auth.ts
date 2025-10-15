import { Router } from "express";
import { requireAuth } from "../middleware/manualAuth.js";
import {
    signUp,
    signIn,
    signOut,
    getSession,
    getProfile,
    updateProfile,
    getSessions,
    revokeSession,
    revokeOtherSessions,
    changePassword,
} from "../controllers/manualAuthController.js";

const router = Router();

// Manual authentication routes
router.post("/auth/sign-up/email", signUp);
router.post("/auth/sign-in/email", signIn);
router.post("/auth/sign-out", signOut);
router.get("/auth/session", getSession);
router.post("/auth/change-password", requireAuth, changePassword);

// Profile management endpoints
router.get("/auth/profile", requireAuth, getProfile);
router.put("/auth/profile", requireAuth, updateProfile);
router.get("/auth/sessions", requireAuth, getSessions);
router.delete("/auth/sessions/:sessionId", requireAuth, revokeSession);
router.delete("/auth/sessions", requireAuth, revokeOtherSessions);

export default router;
